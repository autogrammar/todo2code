import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from '../core/id.js';
import type {
  CodeChangeFileAction,
  CodeChangeSourceApplyReceipt,
  CodeChangeSourcePatch,
} from '../core/types.js';
import { ensureDir, pathExists, readJson, readText } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import { assertGroundedGenerationMetadata } from '../core/schema.js';
import {
  deterministicGeneration,
  exactSourcePatchKeys,
  exactSourcePatchSet,
  normalizeUnifiedDiff,
  splitKeep,
} from './code-change-plan-helpers.js';
import { assertCodeChangeSourcePatch } from './code-change-plan-source-patch.js';
import type { ApplyCodeChangeSourcePatchOptions, ApplyCodeChangeSourcePatchResult } from './code-change-plan-types.js';

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
  // #lizard forgives
  assertCodeChangeSourcePatch(options.patch);
  if (!options.approval?.actor?.trim()) throw new Error('Explicit source patch approval actor is required');
  if (options.approval.patchHash !== options.patch.patchHash) {
    throw new Error('Source patch approval hash does not match the patch');
  }
  for (const edit of options.patch.edits) {
    if (edit.unifiedDiff === null) {
      throw new Error(`Source patch edit ${edit.path} has no unifiedDiff and cannot be applied`);
    }
  }

  const root = path.resolve(options.root);
  const receiptPath = await assertPathWithinRoot(root, path.resolve(options.receiptPath));
  const lockPath = `${receiptPath}.t2c-apply.lock`;
  await ensureDir(path.dirname(receiptPath));
  let lock: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    lock = await fs.open(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Another source patch apply operation is in progress');
    }
    throw error;
  }

  try {
    if (await pathExists(receiptPath)) {
      const existing = await readJson<CodeChangeSourceApplyReceipt>(receiptPath, 1024 * 1024);
      await assertExistingSourceReceipt(existing, options.patch, root);
      return { applied: false, idempotent: true, receipt: existing };
    }

    const prepared: PreparedSourceEdit[] = [];
    for (const edit of options.patch.edits) {
      const relative = edit.path.replace(/\\/g, '/');
      const absolute = await assertPathWithinRoot(root, path.resolve(root, relative));
      if (absolute === receiptPath) {
        throw new Error(`Source patch target collides with its receipt path: ${relative}`);
      }
      const exists = await pathExists(absolute);
      if (exists && (await fs.lstat(absolute)).isSymbolicLink()) {
        throw new Error(`Refusing to apply through a symlink: ${relative}`);
      }
      if (edit.action === 'create' && exists) throw new Error(`Source patch create target already exists: ${relative}`);
      if (edit.action === 'delete' && !exists) throw new Error(`Source patch delete target does not exist: ${relative}`);
      if (edit.action === 'modify' && !exists) {
        const fromEmpty = /(?:^|\n)---\s+\/dev\/null(?:\n|$)/.test(edit.unifiedDiff!)
          || /(?:^|\n)@@\s+-0(?:,0)?\s+\+/.test(edit.unifiedDiff!);
        if (!fromEmpty) throw new Error(`Source patch modify target does not exist: ${relative}`);
      }
      const before = exists ? await readText(absolute, 16 * 1024 * 1024) : '';
      const after = applyUnifiedDiffToText(before, edit.unifiedDiff!, relative);
      if (edit.action === 'delete' && after !== '') {
        throw new Error(`Source patch delete diff must remove the complete file: ${relative}`);
      }
      prepared.push({ relative, absolute, action: edit.action, before, after, existed: exists });
    }

    const changed: PreparedSourceEdit[] = [];
    try {
      for (const edit of prepared) {
        if (edit.action === 'delete') await fs.unlink(edit.absolute);
        else await atomicWriteRaw(edit.absolute, edit.after);
        changed.push(edit);
      }
      const now = (options.now ?? new Date()).toISOString();
      const fileHashesAfter = Object.fromEntries(prepared
        .map((edit): [string, string] => [edit.relative, sha256(edit.after)])
        .sort(([left], [right]) => left.localeCompare(right)));
      const receipt: CodeChangeSourceApplyReceipt = {
        schemaVersion: 't2c.code-change-source-apply-receipt/v1',
        patchId: options.patch.id,
        patchHash: options.patch.patchHash,
        planId: options.patch.planId,
        approvedBy: options.approval.actor.trim(),
        approvedAt: now,
        appliedAt: now,
        appliedPaths: prepared.map((edit) => edit.relative).sort(),
        fileHashesAfter,
        generation: deterministicGeneration(now, 't2c/code-change-source-apply'),
      };
      assertSourceApplyReceipt(receipt, options.patch);
      await atomicWriteRaw(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      return { applied: true, idempotent: false, receipt };
    } catch (error) {
      const rollbackErrors: string[] = [];
      for (const edit of [...changed].reverse()) {
        try {
          if (edit.existed) await atomicWriteRaw(edit.absolute, edit.before);
          else await fs.unlink(edit.absolute).catch((failure: NodeJS.ErrnoException) => {
            if (failure.code !== 'ENOENT') throw failure;
          });
        } catch (rollbackError) {
          rollbackErrors.push(`${edit.relative}: ${String(rollbackError)}`);
        }
      }
      if (rollbackErrors.length) {
        throw new Error(`Source patch apply failed (${String(error)}); rollback also failed: ${rollbackErrors.join('; ')}`);
      }
      throw error;
    }
  } finally {
    await lock.close();
    await fs.unlink(lockPath).catch(() => undefined);
  }
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
  exactSourcePatchKeys(receipt as unknown as Record<string, unknown>, [
    'schemaVersion', 'patchId', 'patchHash', 'planId', 'approvedBy', 'approvedAt',
    'appliedAt', 'appliedPaths', 'fileHashesAfter', 'generation',
  ], 'Code change source apply receipt');
  if (receipt.schemaVersion !== 't2c.code-change-source-apply-receipt/v1'
    || receipt.patchId !== patch.id || receipt.patchHash !== patch.patchHash || receipt.planId !== patch.planId) {
    throw new Error('Code change source apply receipt does not match its patch');
  }
  if (!receipt.approvedBy.trim()) throw new Error('Code change source apply receipt approvedBy is required');
  if (!Number.isFinite(Date.parse(receipt.approvedAt)) || !Number.isFinite(Date.parse(receipt.appliedAt))) {
    throw new Error('Code change source apply receipt timestamps must be ISO date-times');
  }
  const expectedPaths = patch.edits.map((edit) => edit.path).sort();
  exactSourcePatchSet(receipt.appliedPaths, expectedPaths, 'receipt appliedPaths');
  const hashPaths = Object.keys(receipt.fileHashesAfter).sort();
  exactSourcePatchSet(hashPaths, expectedPaths, 'receipt fileHashesAfter paths');
  if (Object.values(receipt.fileHashesAfter).some((value) => !/^[a-f0-9]{64}$/.test(value))) {
    throw new Error('Code change source apply receipt file hashes must be SHA-256');
  }
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
  // #lizard forgives
  const normalizedDiff = normalizeUnifiedDiff(diff, expectedPath);
  const baseLines = splitKeep(base);
  const diffLines = normalizedDiff.split('\n');
  const hunks: Array<{ oldStart: number; oldCount: number; newCount: number; lines: string[] }> = [];
  let current: { oldStart: number; oldCount: number; newCount: number; lines: string[] } | null = null;
  for (const line of diffLines) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
      continue;
    }
    const header = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
    if (header) {
      if (current) hunks.push(current);
      current = {
        oldStart: Number(header[1]),
        oldCount: header[2] === undefined ? 1 : Number(header[2]),
        newCount: header[4] === undefined ? 1 : Number(header[4]),
        lines: [],
      };
      continue;
    }
    if (!current) {
      if (line === '') continue;
      throw new Error(`Unified diff for ${expectedPath} has content outside hunks`);
    }
    if (line === '') continue;
    current.lines.push(line);
  }
  if (current) hunks.push(current);
  if (!hunks.length) throw new Error(`Unified diff for ${expectedPath} contains no hunks`);

  let cursor = 0;
  const output: string[] = [];
  for (const hunk of hunks) {
    const oldIndex = Math.max(0, hunk.oldStart - 1);
    if (oldIndex < cursor) throw new Error(`Unified diff for ${expectedPath} has overlapping or unordered hunks`);
    const oldCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('-')).length;
    const newCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('+')).length;
    if (oldCount !== hunk.oldCount || newCount !== hunk.newCount) {
      throw new Error(`Unified diff hunk counts do not match its header for ${expectedPath}`);
    }
    while (cursor < oldIndex) {
      if (cursor >= baseLines.length) throw new Error(`Unified diff for ${expectedPath} ran past end of file`);
      output.push(baseLines[cursor]!);
      cursor += 1;
    }
    for (const line of hunk.lines) {
      if (line.startsWith('\\')) continue;
      const mark = line[0];
      const body = line.slice(1);
      if (mark === ' ') {
        if (baseLines[cursor] !== body) {
          throw new Error(`Unified diff context mismatch for ${expectedPath} at line ${cursor + 1}`);
        }
        output.push(baseLines[cursor]!);
        cursor += 1;
      } else if (mark === '-') {
        if (baseLines[cursor] !== body) {
          throw new Error(`Unified diff deletion mismatch for ${expectedPath} at line ${cursor + 1}`);
        }
        cursor += 1;
      } else if (mark === '+') {
        output.push(body);
      } else if (line === '') {
        throw new Error(`Unified diff for ${expectedPath} has an unprefixed hunk line`);
      } else {
        throw new Error(`Unified diff for ${expectedPath} has unsupported hunk line`);
      }
    }
  }
  while (cursor < baseLines.length) {
    output.push(baseLines[cursor]!);
    cursor += 1;
  }
  if (base.endsWith('\n') || output.length === 0) return `${output.join('\n')}${output.length ? '\n' : ''}`;
  return output.join('\n');
}
