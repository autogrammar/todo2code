import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sha256, stableStringify } from '../core/id.js';
import { ensureDir, pathExists, readJson, readText, writeJson, writeText } from '../core/io.js';
import type {
  DiagnosticReport,
  IntentGraph,
  PipelineStageAudit,
  TodoApplyReceipt,
  TodoApplyResult,
  TodoPatchApproval,
  TodoPatchArtifact,
  TodoProposal,
} from '../core/types.js';
import type { TodoProposalValidationResult } from './validation.js';

const HASH = /^[a-f0-9]{64}$/;
const PROPOSAL_ID = /^TPROP-[a-f0-9]{20}$/;
const RECORD_ID = /^INT-[A-Z]+-[a-f0-9]{20}$/;

export interface CreateTodoPatchOptions {
  todoPath: string;
  todoContent: string;
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
  proposals: TodoProposal[];
  validation: TodoProposalValidationResult;
  synthesisAudit: PipelineStageAudit;
  createdAt?: string;
}

export interface CreatedTodoPatch {
  markdown: string;
  artifact: TodoPatchArtifact;
}

export interface WriteTodoPatchOptions extends CreateTodoPatchOptions {
  directory: string;
  patchName?: string;
  auditName?: string;
}

export interface WrittenTodoPatch extends CreatedTodoPatch {
  patchPath: string;
  auditPath: string;
}

export interface ApplyTodoPatchOptions {
  todoPath: string;
  patchPath: string;
  auditPath: string;
  receiptPath: string;
  approval?: TodoPatchApproval;
  now?: Date;
}

export function diagnosticReportFingerprint(report: DiagnosticReport): string {
  return sha256(stableStringify({
    schemaVersion: report.schemaVersion,
    graphFingerprint: report.graphFingerprint,
    diagnostics: [...report.diagnostics].sort((left, right) => left.id.localeCompare(right.id)),
    counts: report.counts,
  }));
}

export function createTodoPatch(options: CreateTodoPatchOptions): CreatedTodoPatch {
  if (options.diagnostics.graphFingerprint !== options.graph.fingerprint) {
    throw new Error('Diagnostic report does not describe the supplied graph');
  }
  const proposalById = new Map(options.proposals.map((proposal) => [proposal.id, proposal]));
  if (proposalById.size !== options.proposals.length) throw new Error('TODO proposal IDs must be unique');
  const selected = options.validation.newProposalIds.map((id) => {
    const proposal = proposalById.get(id);
    if (!proposal) throw new Error(`Validation references unknown new proposal ${id}`);
    return proposal;
  });
  if (new Set(options.validation.newProposalIds).size !== options.validation.newProposalIds.length) {
    throw new Error('Validation newProposalIds must be unique');
  }
  const orderedSelected = options.validation.orderedProposalIds.filter((id) => options.validation.newProposalIds.includes(id));
  if (!sameArray(orderedSelected, options.validation.newProposalIds)) {
    throw new Error('Validation newProposalIds must preserve dependency-first order');
  }
  const markdown = renderTodoPatchMarkdown(selected, options.graph.fingerprint);
  const artifact: TodoPatchArtifact = {
    schemaVersion: 't2c.todo-patch/v1',
    createdAt: (options.createdAt ?? new Date().toISOString()),
    sourceTodo: {
      path: normalizePath(options.todoPath),
      contentHash: sha256(options.todoContent),
    },
    graphFingerprint: options.graph.fingerprint,
    diagnosticsFingerprint: diagnosticReportFingerprint(options.diagnostics),
    selectedProposalIds: [...options.validation.newProposalIds],
    duplicateProposalIds: [...options.validation.duplicateProposalIds].sort(),
    duplicates: options.validation.duplicates.map((duplicate) => ({
      proposalId: duplicate.proposalId,
      existingRecordIds: [...duplicate.existingRecordIds].sort(),
      basis: [...duplicate.basis].sort(),
    })).sort((left, right) => left.proposalId.localeCompare(right.proposalId)),
    synthesisAudit: structuredClone(options.synthesisAudit),
    renderedPatchHash: sha256(markdown),
  };
  assertTodoPatchArtifact(artifact);
  return { markdown, artifact };
}

export function renderTodoPatchMarkdown(proposals: TodoProposal[], graphFingerprint: string): string {
  const lines = [
    '<!-- t2c.todo-patch/v1 -->',
    '# todo2code proposed TODO changes',
    '',
    `Graph fingerprint: \`${graphFingerprint}\``,
    '',
  ];
  if (!proposals.length) {
    lines.push('_No new TODO proposals. Existing duplicates were omitted._', '');
    return lines.join('\n');
  }
  let currentPriority: TodoProposal['priority'] | null = null;
  for (const proposal of proposals) {
    if (proposal.priority !== currentPriority) {
      if (currentPriority !== null) lines.push('');
      currentPriority = proposal.priority;
      lines.push(`## ${proposal.priority}`, '');
    }
    lines.push(`- [ ] ${inline(proposal.title)} (\`${proposal.id}\`)`);
    lines.push(`  - Description: ${inline(proposal.description)}`);
    lines.push('  - Acceptance criteria:');
    for (const criterion of proposal.acceptanceCriteria) lines.push(`    - [ ] ${inline(criterion)}`);
    lines.push(`  - Targets: ${renderTargets(proposal)}`);
    lines.push(`  - Dependencies: ${renderIds(proposal.dependencies)}`);
    lines.push(`  - Conclusions: ${renderIds(proposal.conclusionIds)}`);
    lines.push(`  - Diagnostics: ${renderIds(proposal.diagnosticIds)}`);
    lines.push(`  - Evidence records: ${renderIds(proposal.recordIds)}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function writeTodoPatchArtifacts(options: WriteTodoPatchOptions): Promise<WrittenTodoPatch> {
  const created = createTodoPatch(options);
  const patchPath = path.join(options.directory, options.patchName ?? 'TODO.patch');
  const auditPath = path.join(options.directory, options.auditName ?? 'TODO.patch.json');
  await Promise.all([writeText(patchPath, created.markdown), writeJson(auditPath, created.artifact)]);
  return { ...created, patchPath, auditPath };
}

export async function applyTodoPatch(options: ApplyTodoPatchOptions): Promise<TodoApplyResult> {
  const [patchMarkdown, artifact] = await Promise.all([
    readText(options.patchPath, 4 * 1024 * 1024),
    readJson<TodoPatchArtifact>(options.auditPath, 4 * 1024 * 1024),
  ]);
  assertTodoPatchArtifact(artifact);
  if (sha256(patchMarkdown) !== artifact.renderedPatchHash) throw new Error('TODO patch content hash does not match its audit');
  assertApproval(options.approval, artifact.renderedPatchHash);

  const lockPath = `${options.todoPath}.t2c-apply.lock`;
  await ensureDir(path.dirname(options.todoPath));
  let lock: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    lock = await fs.open(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Another TODO patch apply operation is in progress');
    throw error;
  }
  try {
    const current = await readText(options.todoPath, 16 * 1024 * 1024);
    if (await pathExists(options.receiptPath)) {
      const receipt = await readJson<TodoApplyReceipt>(options.receiptPath, 1024 * 1024);
      assertReceipt(receipt, artifact, sha256(current));
      return { applied: false, idempotent: true, receipt };
    }

    const now = (options.now ?? new Date()).toISOString();
    const currentHash = sha256(current);
    let result = current;
    let applied = false;
    let recovered = false;
    if (currentHash === artifact.sourceTodo.contentHash) {
      if (artifact.selectedProposalIds.length) {
        result = appendPatch(current, patchMarkdown);
        await atomicWrite(options.todoPath, result);
        applied = true;
      }
    } else if (artifact.selectedProposalIds.length && wasAlreadyAppended(current, patchMarkdown, artifact.sourceTodo.contentHash)) {
      recovered = true;
    } else {
      throw new Error('Source TODO changed after the patch was rendered');
    }

    const receipt: TodoApplyReceipt = {
      schemaVersion: 't2c.todo-apply-receipt/v1',
      patchHash: artifact.renderedPatchHash,
      sourceTodoHash: artifact.sourceTodo.contentHash,
      resultTodoHash: sha256(result),
      selectedProposalIds: [...artifact.selectedProposalIds],
      approvedBy: options.approval!.actor.trim(),
      approvedAt: now,
      appliedAt: now,
    };
    await atomicWrite(options.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    return { applied, idempotent: recovered || !artifact.selectedProposalIds.length, receipt };
  } finally {
    await lock.close();
    await fs.unlink(lockPath).catch(() => undefined);
  }
}

export function assertTodoPatchArtifact(value: unknown): asserts value is TodoPatchArtifact {
  const artifact = object(value, 'TODO patch artifact');
  exactKeys(artifact, [
    'schemaVersion', 'createdAt', 'sourceTodo', 'graphFingerprint', 'diagnosticsFingerprint',
    'selectedProposalIds', 'duplicateProposalIds', 'duplicates', 'synthesisAudit', 'renderedPatchHash',
  ], 'TODO patch artifact');
  if (artifact.schemaVersion !== 't2c.todo-patch/v1') throw new Error('Unsupported TODO patch schemaVersion');
  isoDate(artifact.createdAt, 'TODO patch createdAt');
  hash(artifact.graphFingerprint, 'TODO patch graphFingerprint');
  hash(artifact.diagnosticsFingerprint, 'TODO patch diagnosticsFingerprint');
  hash(artifact.renderedPatchHash, 'TODO patch renderedPatchHash');
  const sourceTodo = object(artifact.sourceTodo, 'TODO patch sourceTodo');
  exactKeys(sourceTodo, ['path', 'contentHash'], 'TODO patch sourceTodo');
  nonBlank(sourceTodo.path, 'TODO patch sourceTodo.path');
  hash(sourceTodo.contentHash, 'TODO patch sourceTodo.contentHash');
  uniqueIds(artifact.selectedProposalIds, PROPOSAL_ID, 'TODO patch selectedProposalIds');
  uniqueIds(artifact.duplicateProposalIds, PROPOSAL_ID, 'TODO patch duplicateProposalIds');
  const selected = new Set(artifact.selectedProposalIds as string[]);
  const duplicates = new Set(artifact.duplicateProposalIds as string[]);
  if ([...selected].some((id) => duplicates.has(id))) throw new Error('TODO patch selected and duplicate proposal IDs must be disjoint');
  if (!Array.isArray(artifact.duplicates)) throw new Error('TODO patch duplicates must be an array');
  const classified = new Set<string>();
  for (const raw of artifact.duplicates) {
    const duplicate = object(raw, 'TODO patch duplicate classification');
    exactKeys(duplicate, ['proposalId', 'existingRecordIds', 'basis'], 'TODO patch duplicate classification');
    if (typeof duplicate.proposalId !== 'string' || !PROPOSAL_ID.test(duplicate.proposalId)) throw new Error('Invalid duplicate proposal ID');
    if (classified.has(duplicate.proposalId)) throw new Error(`Duplicate classification for ${duplicate.proposalId}`);
    classified.add(duplicate.proposalId);
    uniqueIds(duplicate.existingRecordIds, RECORD_ID, `TODO patch duplicate ${duplicate.proposalId} existingRecordIds`, true);
    uniqueStrings(duplicate.basis, `TODO patch duplicate ${duplicate.proposalId} basis`, true);
  }
  if (!sameArray([...classified].sort(), [...duplicates].sort())) throw new Error('TODO patch duplicate classifications do not match duplicateProposalIds');
  object(artifact.synthesisAudit, 'TODO patch synthesisAudit');
}

function assertApproval(approval: TodoPatchApproval | undefined, patchHash: string): asserts approval is TodoPatchApproval {
  if (!approval) throw new Error('Explicit TODO patch approval is required');
  nonBlank(approval.actor, 'TODO patch approval actor');
  if (approval.patchHash !== patchHash) throw new Error('TODO patch approval hash does not match the rendered patch');
}

function assertReceipt(receipt: TodoApplyReceipt, artifact: TodoPatchArtifact, currentHash: string): void {
  if (receipt.schemaVersion !== 't2c.todo-apply-receipt/v1') throw new Error('Unsupported TODO apply receipt schemaVersion');
  if (receipt.patchHash !== artifact.renderedPatchHash || receipt.sourceTodoHash !== artifact.sourceTodo.contentHash) {
    throw new Error('TODO apply receipt does not belong to this patch');
  }
  if (receipt.resultTodoHash !== currentHash) throw new Error('TODO changed after the patch was applied');
  if (!sameArray(receipt.selectedProposalIds, artifact.selectedProposalIds)) throw new Error('TODO apply receipt proposal IDs do not match');
  nonBlank(receipt.approvedBy, 'TODO apply receipt approvedBy');
  isoDate(receipt.approvedAt, 'TODO apply receipt approvedAt');
  isoDate(receipt.appliedAt, 'TODO apply receipt appliedAt');
}

async function atomicWrite(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  const existing = await fs.stat(filePath).catch(() => null);
  const handle = await fs.open(temporary, 'wx');
  try {
    if (existing) await handle.chmod(existing.mode);
    await handle.writeFile(value, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

function appendPatch(todo: string, patchMarkdown: string): string {
  const separator = todo.endsWith('\n') ? '\n' : '\n\n';
  return `${todo}${separator}${patchMarkdown}`;
}

function wasAlreadyAppended(current: string, patchMarkdown: string, sourceHash: string): boolean {
  for (const separator of ['\n', '\n\n']) {
    const suffix = `${separator}${patchMarkdown}`;
    if (current.endsWith(suffix) && sha256(current.slice(0, -suffix.length)) === sourceHash) return true;
  }
  return false;
}

function renderTargets(proposal: TodoProposal): string {
  const groups = [
    ['paths', proposal.target.paths], ['symbols', proposal.target.symbols], ['tickets', proposal.target.tickets],
    ['versions', proposal.target.versions],
  ] as const;
  const rendered = groups.filter(([, values]) => values.length)
    .map(([name, values]) => `${name}: ${values.map((value) => `\`${inline(value)}\``).join(', ')}`);
  return rendered.length ? rendered.join('; ') : '_none_';
}

function renderIds(ids: string[]): string {
  return ids.length ? ids.map((id) => `\`${id}\``).join(', ') : '_none_';
}

function inline(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/`/g, '\\`');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], name: string): void {
  const expected = new Set(keys);
  const missing = keys.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !expected.has(key));
  if (missing.length) throw new Error(`${name} is missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`${name} has unsupported fields: ${extra.join(', ')}`);
}

function nonBlank(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-blank string`);
}

function hash(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !HASH.test(value)) throw new Error(`${name} must be SHA-256`);
}

function isoDate(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${name} must be an ISO date-time`);
}

function uniqueIds(value: unknown, pattern: RegExp, name: string, nonEmpty = false): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !pattern.test(item))) {
    throw new Error(`${name} must contain valid IDs`);
  }
  if (nonEmpty && !value.length) throw new Error(`${name} must not be empty`);
  if (new Set(value).size !== value.length) throw new Error(`${name} must contain unique IDs`);
}

function uniqueStrings(value: unknown, name: string, nonEmpty = false): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${name} must contain non-blank strings`);
  }
  if (nonEmpty && !value.length) throw new Error(`${name} must not be empty`);
  if (new Set(value).size !== value.length) throw new Error(`${name} must contain unique values`);
}
