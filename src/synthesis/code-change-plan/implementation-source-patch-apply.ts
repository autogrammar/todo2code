import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { assertPathWithinRoot } from '../../core/security.js';
import { assertGroundedGenerationMetadata } from '../../core/schema.js';
import {
  sha256,
  stableStringify,
} from '../../core/id.js';
import { ensureDir, pathExists, readJson, readText } from '../../core/io.js';
import { T2C_VERSION } from '../../version.js';
import { assertCodeChangeSourcePatch } from './implementation-source-patch.js';
import { normalizeUnifiedDiff } from './implementation-source-patch-diff.js';
import { IMPLEMENTATION_DIAGNOSTIC_CODES } from './implementation-diagnostics.js';
import type {
  CodeChangeFileAction,
  CodeChangeSourceApplyReceipt,
  CodeChangeSourceEdit,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchApproval,
  GroundedGenerationMetadata,
} from '../../core/types.js';

export interface ApplyCodeChangeSourcePatchOptions {
  root: string;
  patch: CodeChangeSourcePatch;
  approval: CodeChangeSourcePatchApproval;
  receiptPath: string;
  now?: Date;
}

export interface ApplyCodeChangeSourcePatchResult {
  applied: boolean;
  idempotent: boolean;
  receipt: CodeChangeSourceApplyReceipt;
}

interface NormalizedApplyCodeChangeSourcePatchRequest {
  root: string;
  patch: CodeChangeSourcePatch;
  approval: CodeChangeSourcePatchApproval;
  receiptPath: string;
  now?: Date;
}

interface SourcePatchApplyLock {
  path: string;
  lock: Awaited<ReturnType<typeof fs.open>>;
}

/**
 * Apply a fully-diffed source patch after explicit hash approval.
 *
 * Instruction-only edits (null unifiedDiff) are rejected. Paths must stay
 * relative and inside `root`. Re-applying with an existing matching receipt is
 * idempotent.
 */
export async function applyCodeChangeSourcePatch(
  options: ApplyCodeChangeSourcePatchOptions,
): Promise<ApplyCodeChangeSourcePatchResult> {
  const request = assertPatchApplicationRequest(options);
  const root = path.resolve(request.root);
  const receiptPath = await assertPathWithinRoot(root, path.resolve(request.receiptPath));
  await ensureDir(path.dirname(receiptPath));
  const lock = await acquireApplyLock(receiptPath);
  try {
    const idempotentResult = await readExistingReceipt(receiptPath, request.patch, root);
    if (idempotentResult) return idempotentResult;

    const prepared = await prepareSourceEdits(request.patch, root, receiptPath);
    const now = (request.now ?? new Date()).toISOString();
    const receipt = await applyPreparedEdits(prepared, request.patch, request.approval.actor.trim(), now, receiptPath);
    return { applied: true, idempotent: false, receipt };
  } finally {
    await lock.lock.close();
    await fs.unlink(lock.path).catch(() => undefined);
  }
}

async function readExistingReceipt(
  receiptPath: string,
  patch: CodeChangeSourcePatch,
  root: string,
): Promise<ApplyCodeChangeSourcePatchResult | null> {
  if (!(await pathExists(receiptPath))) return null;
  const existing = await readJson<CodeChangeSourceApplyReceipt>(receiptPath, 1024 * 1024);
  await assertExistingSourceReceipt(existing, patch, root);
  return { applied: false, idempotent: true, receipt: existing };
}

function assertPatchApplicationRequest(
  options: ApplyCodeChangeSourcePatchOptions,
): NormalizedApplyCodeChangeSourcePatchRequest {
  const patch = options.patch;
  assertCodeChangeSourcePatch(patch);
  assertPatchApprovalActor(options.approval);
  assertPatchApprovalHash(patch, options.approval);
  assertPatchEditsContainDiffs(patch);
  const request: NormalizedApplyCodeChangeSourcePatchRequest = {
    root: options.root,
    patch: options.patch,
    approval: options.approval,
    receiptPath: options.receiptPath,
  };
  if (options.now !== undefined) request.now = options.now;
  return request;
}

function assertPatchApprovalActor(approval: CodeChangeSourcePatchApproval): string {
  if (!approval) {
    throw new Error('Source patch approval object is required');
  }
  if (!approval.actor?.trim()) {
    throw new Error('Explicit source patch approval actor is required');
  }
  return approval.actor.trim();
}

function assertPatchApprovalHash(
  patch: CodeChangeSourcePatch,
  approval: CodeChangeSourcePatchApproval,
): void {
  if (approval.patchHash !== patch.patchHash) {
    throw new Error('Source patch approval hash does not match the patch');
  }
}

function assertPatchEditsContainDiffs(patch: CodeChangeSourcePatch): void {
  for (const edit of patch.edits) {
    if (edit.unifiedDiff === null) {
      throw new Error(`Source patch edit ${edit.path} has no unifiedDiff and cannot be applied`);
    }
  }
}

async function acquireApplyLock(receiptPath: string): Promise<SourcePatchApplyLock> {
  const lockPath = `${receiptPath}.t2c-apply.lock`;
  try {
    const lock = await fs.open(lockPath, 'wx');
    return { path: lockPath, lock };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Another source patch apply operation is in progress');
    }
    throw error;
  }
}

async function prepareSourceEdits(
  patch: CodeChangeSourcePatch,
  root: string,
  receiptPath: string,
): Promise<PreparedSourceEdit[]> {
  const prepared: PreparedSourceEdit[] = [];
  for (const edit of patch.edits) {
    const target = await prepareSourceEditTarget(edit, root, receiptPath);
    const before = target.existed ? await readText(target.absolute, 16 * 1024 * 1024) : '';
    const after = applyUnifiedDiffToText(before, edit.unifiedDiff!, target.relative);
    assertDeleteEditClearsAll(target.relative, edit.action, after);
    prepared.push({
      ...target,
      action: edit.action,
      before,
      after,
    });
  }
  return prepared;
}

interface SourcePatchEditTarget {
  relative: string;
  absolute: string;
  existed: boolean;
}

async function prepareSourceEditTarget(
  edit: CodeChangeSourceEdit,
  root: string,
  receiptPath: string,
): Promise<SourcePatchEditTarget> {
  const relative = edit.path.replace(/\\/g, '/');
  const absolute = await assertPathWithinRoot(root, path.resolve(root, relative));
  if (absolute === receiptPath) {
    throw new Error(`Source patch target collides with its receipt path: ${relative}`);
  }
  const existed = await pathExists(absolute);
  await assertSourcePatchTargetNotSymlink(absolute, existed, relative);
  validatePatchTargetForEdit(edit.action, relative, existed, edit.unifiedDiff!);
  return { relative, absolute, existed };
}

async function assertSourcePatchTargetNotSymlink(
  absolute: string,
  existed: boolean,
  relative: string,
): Promise<void> {
  if (!existed) return;
  if ((await fs.lstat(absolute)).isSymbolicLink()) {
    throw new Error(`Refusing to apply through a symlink: ${relative}`);
  }
}

function assertDeleteEditClearsAll(relative: string, action: CodeChangeFileAction, after: string): void {
  if (action === 'delete' && after !== '') {
    throw new Error(`Source patch delete diff must remove the complete file: ${relative}`);
  }
}

function validatePatchTargetForEdit(
  action: CodeChangeFileAction,
  relative: string,
  exists: boolean,
  unifiedDiff: string,
): void {
  if (action === 'create' && exists) throw new Error(`Source patch create target already exists: ${relative}`);
  if (action === 'delete' && !exists) throw new Error(`Source patch delete target does not exist: ${relative}`);
  if (action === 'modify' && !exists) {
    const fromEmpty = /(?:^|\n)---\s+\/dev\/null(?:\n|$)/.test(unifiedDiff)
      || /(?:^|\n)@@\s+-0(?:,0)?\s+\+/.test(unifiedDiff);
    if (!fromEmpty) throw new Error(`Source patch modify target does not exist: ${relative}`);
  }
}

async function applyPreparedEdits(
  prepared: PreparedSourceEdit[],
  patch: CodeChangeSourcePatch,
  approvedBy: string,
  now: string,
  receiptPath: string,
): Promise<CodeChangeSourceApplyReceipt> {
  const changed: PreparedSourceEdit[] = [];
  try {
    await writePreparedEdits(prepared, changed);
    const receipt = buildPatchApplyReceipt(prepared, patch, approvedBy, now);
    assertSourceApplyReceipt(receipt, patch);
    // The receipt is part of the transaction: without it a retry could apply
    // the same approved patch again. Roll files back if persisting it fails.
    await atomicWriteRaw(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    return receipt;
  } catch (error) {
    const rollbackErrors = await rollbackPreparedEdits(changed);
    if (rollbackErrors.length) {
      throw new Error(`Source patch apply failed (${String(error)}); rollback also failed: ${rollbackErrors.join('; ')}`);
    }
    throw error;
  }
}

async function writePreparedEdits(prepared: PreparedSourceEdit[], changed: PreparedSourceEdit[]): Promise<void> {
  for (const edit of prepared) {
    if (edit.action === 'delete') await fs.unlink(edit.absolute);
    else await atomicWriteRaw(edit.absolute, edit.after);
    changed.push(edit);
  }
}

function buildPatchApplyReceipt(
  prepared: PreparedSourceEdit[],
  patch: CodeChangeSourcePatch,
  approvedBy: string,
  now: string,
): CodeChangeSourceApplyReceipt {
  const fileHashesAfter = Object.fromEntries(prepared
    .map((edit): [string, string] => [edit.relative, sha256(edit.after)])
    .sort(([left], [right]) => left.localeCompare(right)));
  return {
    schemaVersion: 't2c.code-change-source-apply-receipt/v1',
    patchId: patch.id,
    patchHash: patch.patchHash,
    planId: patch.planId,
    approvedBy,
    approvedAt: now,
    appliedAt: now,
    appliedPaths: prepared.map((edit) => edit.relative).sort(),
    fileHashesAfter,
    generation: deterministicGeneration(now, 't2c/code-change-source-apply'),
  };
}

async function rollbackPreparedEdits(changes: PreparedSourceEdit[]): Promise<string[]> {
  const rollbackErrors: string[] = [];
  for (const edit of [...changes].reverse()) {
    try {
      if (edit.existed) await atomicWriteRaw(edit.absolute, edit.before);
      else await fs.unlink(edit.absolute).catch((failure: NodeJS.ErrnoException) => {
        if (failure.code !== 'ENOENT') throw failure;
      });
    } catch (rollbackError) {
      rollbackErrors.push(`${edit.relative}: ${String(rollbackError)}`);
    }
  }
  return rollbackErrors;
}

interface PreparedSourceEdit {
  relative: string;
  absolute: string;
  action: CodeChangeFileAction;
  before: string;
  after: string;
  existed: boolean;
}

async function assertExistingSourceReceipt(
  receipt: CodeChangeSourceApplyReceipt,
  patch: CodeChangeSourcePatch,
  root: string,
): Promise<void> {
  try {
    assertSourceApplyReceipt(receipt, patch);
  } catch {
    throw new Error('A different or invalid source patch receipt already exists at the receipt path');
  }
  for (const edit of patch.edits) {
    const relative = edit.path.replace(/\\/g, '/');
    const absolute = await assertPathWithinRoot(root, path.resolve(root, relative));
    const exists = await pathExists(absolute);
    if (edit.action === 'delete') {
      if (exists) throw new Error(`Applied source patch state changed after receipt: ${relative}`);
      continue;
    }
    if (!exists || (await fs.lstat(absolute)).isSymbolicLink()) {
      throw new Error(`Applied source patch state changed after receipt: ${relative}`);
    }
    const current = await readText(absolute, 16 * 1024 * 1024);
    if (receipt.fileHashesAfter[relative] !== sha256(current)) {
      throw new Error(`Applied source patch state changed after receipt: ${relative}`);
    }
  }
}

function assertSourceApplyReceipt(receipt: CodeChangeSourceApplyReceipt, patch: CodeChangeSourcePatch): void {
  validateSourceApplyReceiptShape(receipt);
  validateSourceApplyReceiptIdentity(receipt, patch);
  validateSourceApplyReceiptTimestamps(receipt);
  validateSourceApplyReceiptPathHashes(receipt, patch);
  validateSourceApplyReceiptGeneration(receipt);
}

function validateSourceApplyReceiptShape(receipt: CodeChangeSourceApplyReceipt): void {
  exactSourcePatchKeys(receipt as unknown as Record<string, unknown>, [
    'schemaVersion', 'patchId', 'patchHash', 'planId', 'approvedBy', 'approvedAt',
    'appliedAt', 'appliedPaths', 'fileHashesAfter', 'generation',
  ], 'Code change source apply receipt');
}

function validateSourceApplyReceiptIdentity(
  receipt: CodeChangeSourceApplyReceipt,
  patch: CodeChangeSourcePatch,
): void {
  if (receipt.schemaVersion !== 't2c.code-change-source-apply-receipt/v1'
    || receipt.patchId !== patch.id
    || receipt.patchHash !== patch.patchHash
    || receipt.planId !== patch.planId) {
    throw new Error('Code change source apply receipt does not match its patch');
  }
}

function validateSourceApplyReceiptTimestamps(receipt: CodeChangeSourceApplyReceipt): void {
  if (!receipt.approvedBy.trim()) throw new Error('Code change source apply receipt approvedBy is required');
  if (!Number.isFinite(Date.parse(receipt.approvedAt)) || !Number.isFinite(Date.parse(receipt.appliedAt))) {
    throw new Error('Code change source apply receipt timestamps must be ISO date-times');
  }
}

function validateSourceApplyReceiptPathHashes(
  receipt: CodeChangeSourceApplyReceipt,
  patch: CodeChangeSourcePatch,
): void {
  const expectedPaths = patch.edits.map((edit) => edit.path).sort();
  exactSourcePatchSet(receipt.appliedPaths, expectedPaths, 'receipt appliedPaths');
  const hashPaths = Object.keys(receipt.fileHashesAfter).sort();
  exactSourcePatchSet(hashPaths, expectedPaths, 'receipt fileHashesAfter paths');
  if (Object.values(receipt.fileHashesAfter).some((value) => !/^[a-f0-9]{64}$/.test(value))) {
    throw new Error('Code change source apply receipt file hashes must be SHA-256');
  }
}

function validateSourceApplyReceiptGeneration(receipt: CodeChangeSourceApplyReceipt): void {
  assertGroundedGenerationMetadata(receipt.generation, 'Code change source apply receipt generation');
  if (receipt.generation.generatedAt !== receipt.appliedAt
    || receipt.generation.generator !== 't2c/code-change-source-apply') {
    throw new Error('Code change source apply receipt generation does not match the apply operation');
  }
}

async function atomicWriteRaw(target: string, content: string): Promise<void> {
  await ensureDir(path.dirname(target));
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await fs.writeFile(temporary, content, 'utf8');
    await fs.rename(temporary, target);
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
}

/**
 * Apply a single-file unified diff to a text buffer.
 * Supports standard hunks with space/+/− prefixes. Throws on context mismatch.
 */
export function applyUnifiedDiffToText(base: string, diff: string, expectedPath: string): string {
  const baseLines = splitKeep(base);
  const hunks = parseUnifiedDiffIntoHunks(diff, expectedPath);
  const output = applyUnifiedDiffHunks(baseLines, expectedPath, hunks);
  // Reconstruct text. Files without a trailing newline end without an empty last segment.
  return joinAppliedText(base.endsWith('\n'), output);
}

function joinAppliedText(baseEndsWithNewline: boolean, lines: string[]): string {
  if (baseEndsWithNewline || lines.length === 0) return `${lines.join('\n')}${lines.length ? '\n' : ''}`;
  return lines.join('\n');
}

interface ParsedUnifiedDiffHunk {
  oldStart: number;
  oldCount: number;
  newCount: number;
  lines: string[];
}

function parseUnifiedDiffIntoHunks(diff: string, expectedPath: string): ParsedUnifiedDiffHunk[] {
  const normalizedDiff = normalizeUnifiedDiff(diff, expectedPath);
  const context = createEmptyUnifiedDiffContext();
  for (const line of parseUnifiedDiffLines(normalizedDiff)) {
    applyUnifiedDiffLineToContext(context, line, expectedPath);
  }
  return finalizeUnifiedDiffContext(context, expectedPath);
}

interface UnifiedDiffParsingContext {
  current: ParsedUnifiedDiffHunk | null;
  hunks: ParsedUnifiedDiffHunk[];
}

function createEmptyUnifiedDiffContext(): UnifiedDiffParsingContext {
  return { current: null, hunks: [] };
}

function parseUnifiedDiffLines(diff: string): string[] {
  return diff.split('\n');
}

function finalizeUnifiedDiffContext(
  context: UnifiedDiffParsingContext,
  expectedPath: string,
): ParsedUnifiedDiffHunk[] {
  if (context.current) {
    context.hunks.push(context.current);
    context.current = null;
  }
  if (!context.hunks.length) {
    throw new Error(`Unified diff for ${expectedPath} contains no hunks`);
  }
  return context.hunks;
}

function applyUnifiedDiffLineToContext(
  context: UnifiedDiffParsingContext,
  line: string,
  expectedPath: string,
): void {
  const header = parseUnifiedDiffHeader(line);
  if (header) {
    if (context.current) {
      context.hunks.push(context.current);
    }
    context.current = header;
    return;
  }
  if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
    return;
  }
  if (!context.current) {
    if (line === '') return;
    throw new Error(`Unified diff for ${expectedPath} has content outside hunks`);
  }
  // Blank lines without a unified-diff prefix separate hunks in some emitters.
  if (line === '') return;
  context.current.lines.push(line);
}

function parseUnifiedDiffHeader(line: string): ParsedUnifiedDiffHunk | null {
  const match = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
  if (!match) return null;
  return buildParsedUnifiedDiffHunk(match);
}

function buildParsedUnifiedDiffHunk(match: RegExpMatchArray): ParsedUnifiedDiffHunk {
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] === undefined ? 1 : Number(match[2]),
    newCount: match[4] === undefined ? 1 : Number(match[4]),
    lines: [],
  };
}

interface UnifiedDiffCursor {
  position: number;
}

function applyUnifiedDiffHunks(
  baseLines: string[],
  expectedPath: string,
  hunks: ParsedUnifiedDiffHunk[],
): string[] {
  const cursor: UnifiedDiffCursor = { position: 0 };
  const output: string[] = [];
  for (const hunk of hunks) {
    applyUnifiedDiffHunk(baseLines, expectedPath, cursor, output, hunk);
  }
  appendRemainingBaseLines(baseLines, cursor, output);
  return output;
}

function applyUnifiedDiffHunk(
  baseLines: string[],
  expectedPath: string,
  cursor: UnifiedDiffCursor,
  output: string[],
  hunk: ParsedUnifiedDiffHunk,
): void {
  const oldIndex = Math.max(0, hunk.oldStart - 1);
  if (oldIndex < cursor.position) throw new Error(`Unified diff for ${expectedPath} has overlapping or unordered hunks`);
  validateHunkCounts(expectedPath, hunk);
  copyBaseLinesToCursor(baseLines, expectedPath, cursor, output, oldIndex);
  for (const line of hunk.lines) {
    if (line.startsWith('\\')) continue; // "\ No newline at end of file"
    applyUnifiedDiffLine(expectedPath, line, cursor, baseLines, output);
  }
}

function copyBaseLinesToCursor(
  baseLines: string[],
  expectedPath: string,
  cursor: UnifiedDiffCursor,
  output: string[],
  targetIndex: number,
): void {
  while (cursor.position < targetIndex) {
    if (cursor.position >= baseLines.length) throw new Error(`Unified diff for ${expectedPath} ran past end of file`);
    output.push(baseLines[cursor.position]!);
    cursor.position += 1;
  }
}

function appendRemainingBaseLines(
  baseLines: string[],
  cursor: UnifiedDiffCursor,
  output: string[],
): void {
  while (cursor.position < baseLines.length) {
    output.push(baseLines[cursor.position]!);
    cursor.position += 1;
  }
}

function validateHunkCounts(expectedPath: string, hunk: ParsedUnifiedDiffHunk): void {
  const oldCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('-')).length;
  const newCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('+')).length;
  if (oldCount !== hunk.oldCount || newCount !== hunk.newCount) {
    throw new Error(`Unified diff hunk counts do not match its header for ${expectedPath}`);
  }
}

function applyUnifiedDiffLine(
  expectedPath: string,
  line: string,
  cursor: UnifiedDiffCursor,
  baseLines: string[],
  output: string[],
): void {
  const mark = line[0];
  const body = line.slice(1);
  if (line === '') {
    throw new Error(`Unified diff for ${expectedPath} has an unprefixed hunk line`);
  }
  if (mark === ' ') {
    applyUnifiedDiffContextLine(expectedPath, body, cursor, baseLines, output);
    return;
  }
  if (mark === '-') {
    applyUnifiedDiffDeletionLine(expectedPath, body, cursor, baseLines);
    return;
  }
  if (mark === '+') {
    applyUnifiedDiffAdditionLine(body, output);
    return;
  }
  throw new Error(`Unified diff for ${expectedPath} has unsupported hunk line`);
}

function applyUnifiedDiffContextLine(
  expectedPath: string,
  body: string,
  cursor: UnifiedDiffCursor,
  baseLines: string[],
  output: string[],
): void {
  if (baseLines[cursor.position] !== body) {
    throw new Error(`Unified diff context mismatch for ${expectedPath} at line ${cursor.position + 1}`);
  }
  output.push(baseLines[cursor.position]!);
  cursor.position += 1;
}

function applyUnifiedDiffDeletionLine(
  expectedPath: string,
  body: string,
  cursor: UnifiedDiffCursor,
  baseLines: string[],
): void {
  if (baseLines[cursor.position] !== body) {
    throw new Error(`Unified diff deletion mismatch for ${expectedPath} at line ${cursor.position + 1}`);
  }
  cursor.position += 1;
}

function applyUnifiedDiffAdditionLine(body: string, output: string[]): void {
  output.push(body);
}

function splitKeep(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines;
}

function exactSourcePatchKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${name} keys must be exactly: ${wanted.join(', ')}`);
  }
}

function exactSourcePatchSet(actual: string[], expected: string[], name: string): void {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (left.length !== right.length || left.some((item, index) => item !== right[index])) {
    throw new Error(`Source patch ${name} do not match the plan`);
  }
}

function deterministicGeneration(generatedAt: string, generator: string): GroundedGenerationMetadata {
  return {
    generator,
    generatorVersion: '1',
    runtimeVersion: T2C_VERSION,
    generatedAt,
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    model: null,
    provider: null,
    responseId: null,
    configurationFingerprint: sha256(stableStringify({
      generator,
      generatorVersion: '1',
      codes: [...IMPLEMENTATION_DIAGNOSTIC_CODES].sort(),
    })),
    reason: null,
  };
}
