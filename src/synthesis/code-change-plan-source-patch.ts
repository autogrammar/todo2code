import { createCodeChangeSourcePatchHash, createCodeChangeSourcePatchId } from '../core/id.js';
import type {
  CodeChangeFile,
  CodeChangePlan,
  CodeChangeSourceEdit,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchSet,
} from '../core/types.js';
import {
  assertCodeChangePlansForReview,
  assertGroundedGenerationMetadata,
} from '../core/schema.js';
import {
  assertSourcePatchIds,
  assertSourcePatchStrings,
  deterministicGeneration,
  exactSourcePatchKeys,
  exactSourcePatchSet,
  normalizeUnifiedDiff,
  uniqueSorted,
} from './code-change-plan-helpers.js';
import type { CreateCodeChangeSourcePatchOptions } from './code-change-plan-types.js';

/**
 * Build a structured source-edit proposal from one grounded code-change plan.
 *
 * Deterministic by default: each planned file gets an imperative instruction.
 * Callers may attach a unified diff per path; the runtime validates path headers
 * and rejects traversal / host paths. Nothing is written to the working tree.
 */
export function createCodeChangeSourcePatch(
  options: CreateCodeChangeSourcePatchOptions,
): CodeChangeSourcePatch {
  const plan = options.plan;
  const graphFingerprint = plan?.evidence?.graphFingerprint;
  assertCodeChangePlansForReview(
    [plan],
    typeof graphFingerprint === 'string' ? graphFingerprint : '',
  );
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('createdAt must be an ISO date-time');
  const allowed = new Set(plan.target.paths.map((path) => path.replace(/\\/g, '/')));
  const diffs = options.unifiedDiffs ?? {};
  for (const path of Object.keys(diffs)) {
    const normalized = path.replace(/\\/g, '/');
    if (!allowed.has(normalized)) {
      throw new Error(`Unified diff path ${normalized} is not declared by plan ${plan.id}`);
    }
  }
  const edits: CodeChangeSourceEdit[] = [...plan.changes]
    .map((change) => {
      const path = change.path.replace(/\\/g, '/');
      if (!allowed.has(path)) {
        throw new Error(`Edit path ${path} is not present in plan target.paths`);
      }
      const rawDiff = diffs[path];
      const unifiedDiff = rawDiff === undefined ? null : normalizeUnifiedDiff(rawDiff, path);
      return {
        path,
        action: change.action,
        symbols: uniqueSorted(change.symbols),
        instruction: instructionFor(change, plan),
        unifiedDiff,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  if (!edits.length) throw new Error(`Plan ${plan.id} has no editable paths`);

  const semantic = {
    planId: plan.id,
    planHash: plan.planHash,
    graphFingerprint: plan.evidence.graphFingerprint,
    diagnosticIds: uniqueSorted(plan.evidence.diagnosticIds),
    recordIds: uniqueSorted(plan.evidence.recordIds),
    edits,
    acceptanceCriteria: uniqueSorted(plan.acceptanceCriteria),
  };
  const patchHash = createCodeChangeSourcePatchHash(semantic);
  const patch: CodeChangeSourcePatch = {
    schemaVersion: 't2c.code-change-source-patch/v1',
    id: createCodeChangeSourcePatchId(semantic),
    patchHash,
    status: 'proposed',
    createdAt,
    ...semantic,
    generation: deterministicGeneration(createdAt, 't2c/code-change-source-patch'),
  };
  assertCodeChangeSourcePatch(patch, plan);
  return patch;
}

export function createCodeChangeSourcePatchSet(options: {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  unifiedDiffsByPlanId?: Record<string, Record<string, string>>;
  generatedAt?: string;
}): CodeChangeSourcePatchSet {
  if (typeof options.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(options.graphFingerprint)) {
    throw new Error('graphFingerprint must be a SHA-256 hex digest');
  }
  assertCodeChangePlansForReview(options.plans, options.graphFingerprint);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const patches = [...options.plans]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((plan) => createCodeChangeSourcePatch({
      plan,
      createdAt: generatedAt,
      ...(options.unifiedDiffsByPlanId?.[plan.id]
        ? { unifiedDiffs: options.unifiedDiffsByPlanId[plan.id] }
        : {}),
    }));
  const result: CodeChangeSourcePatchSet = {
    schemaVersion: 't2c.code-change-source-patch-set/v1',
    generatedAt,
    graphFingerprint: options.graphFingerprint,
    patches,
    generation: deterministicGeneration(generatedAt, 't2c/code-change-source-patch-set'),
  };
  assertCodeChangeSourcePatchSet(result, options.plans);
  return result;
}

export function assertCodeChangeSourcePatch(
  value: unknown,
  plan?: CodeChangePlan,
): asserts value is CodeChangeSourcePatch {
  // #lizard forgives
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch must be an object');
  }
  const patch = value as CodeChangeSourcePatch;
  exactSourcePatchKeys(patch as unknown as Record<string, unknown>, [
    'schemaVersion', 'id', 'patchHash', 'status', 'createdAt', 'planId', 'planHash',
    'graphFingerprint', 'diagnosticIds', 'recordIds', 'edits', 'acceptanceCriteria', 'generation',
  ], 'Source patch');
  if (patch.schemaVersion !== 't2c.code-change-source-patch/v1') {
    throw new Error('Unsupported code change source patch schemaVersion');
  }
  if (typeof patch.id !== 'string' || !/^SPATCH-[a-f0-9]{20}$/.test(patch.id)) {
    throw new Error('Source patch id must match SPATCH-<20 hex>');
  }
  if (typeof patch.patchHash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.patchHash)) {
    throw new Error('Source patch patchHash must be SHA-256');
  }
  if (patch.status !== 'proposed') throw new Error('Source patch status must be proposed');
  if (typeof patch.createdAt !== 'string' || Number.isNaN(Date.parse(patch.createdAt))) {
    throw new Error('Source patch createdAt must be an ISO date-time');
  }
  if (typeof patch.planId !== 'string' || !/^CPLAN-[a-f0-9]{20}$/.test(patch.planId)) {
    throw new Error('Source patch planId must match CPLAN-<20 hex>');
  }
  if (typeof patch.planHash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.planHash)) {
    throw new Error('Source patch planHash must be SHA-256');
  }
  if (typeof patch.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(patch.graphFingerprint)) {
    throw new Error('Source patch graphFingerprint must be SHA-256');
  }
  if (!Array.isArray(patch.edits) || patch.edits.length === 0) {
    throw new Error('Source patch edits must be a non-empty array');
  }
  assertSourcePatchIds(patch.diagnosticIds, /^DIAG-[a-f0-9]{20}$/, 'diagnosticIds');
  assertSourcePatchIds(patch.recordIds, /^INT-[A-Z]+-[a-f0-9]{20}$/, 'recordIds');
  assertSourcePatchStrings(patch.acceptanceCriteria, 'acceptanceCriteria', false);
  const paths = new Set<string>();
  for (const edit of patch.edits) {
    if (!edit || typeof edit !== 'object') throw new Error('Source patch edit must be an object');
    exactSourcePatchKeys(edit as unknown as Record<string, unknown>, [
      'path', 'action', 'symbols', 'instruction', 'unifiedDiff',
    ], 'Source patch edit');
    const path = edit.path?.trim().replace(/\\/g, '/') ?? '';
    if (!path || path.startsWith('/') || path.split('/').includes('..')) {
      throw new Error(`Source patch edit path is not a relative repository path: ${path}`);
    }
    if (!['create', 'modify', 'delete'].includes(edit.action)) {
      throw new Error(`Source patch edit action is unsupported: ${String(edit.action)}`);
    }
    if (typeof edit.instruction !== 'string' || !edit.instruction.trim()) {
      throw new Error('Source patch edit instruction must be non-blank');
    }
    assertSourcePatchStrings(edit.symbols, `edits[${path}].symbols`, true);
    if (edit.unifiedDiff !== null) {
      if (typeof edit.unifiedDiff !== 'string') throw new Error('Source patch unifiedDiff must be string or null');
      normalizeUnifiedDiff(edit.unifiedDiff, path);
    }
    const key = `${path}::${edit.action}`;
    if (paths.has(key)) throw new Error(`Duplicate source patch edit for ${path}`);
    paths.add(key);
  }
  const expectedHash = createCodeChangeSourcePatchHash(patch);
  if (patch.patchHash !== expectedHash) {
    throw new Error(`Source patch patchHash does not match semantic content: expected ${expectedHash}`);
  }
  if (patch.id !== createCodeChangeSourcePatchId(patch)) {
    throw new Error('Source patch id does not match semantic content');
  }
  assertGroundedGenerationMetadata(patch.generation, 'Source patch generation');
  if (patch.generation.generatedAt !== patch.createdAt) {
    throw new Error('Source patch generation.generatedAt must match createdAt');
  }
  if (patch.generation.generator !== 't2c/code-change-source-patch') {
    throw new Error('Source patch generation.generator must be t2c/code-change-source-patch');
  }
  if (plan) {
    if (patch.planId !== plan.id || patch.planHash !== plan.planHash) {
      throw new Error('Source patch is not bound to the supplied plan');
    }
    if (patch.graphFingerprint !== plan.evidence.graphFingerprint) {
      throw new Error('Source patch graphFingerprint does not match the plan');
    }
    const allowed = new Set(plan.target.paths.map((item) => item.replace(/\\/g, '/')));
    const expectedChanges = new Map(plan.changes.map((item) => [
      item.path.replace(/\\/g, '/'), item.action,
    ]));
    for (const edit of patch.edits) {
      const editPath = edit.path.replace(/\\/g, '/');
      if (!allowed.has(editPath)) {
        throw new Error(`Source patch path ${edit.path} is outside plan target.paths`);
      }
      if (expectedChanges.get(editPath) !== edit.action) {
        throw new Error(`Source patch action for ${edit.path} does not match the plan`);
      }
    }
    exactSourcePatchSet(patch.edits.map((item) => item.path.replace(/\\/g, '/')), [...expectedChanges.keys()], 'edit paths');
    exactSourcePatchSet(patch.diagnosticIds, plan.evidence.diagnosticIds, 'diagnosticIds');
    exactSourcePatchSet(patch.recordIds, plan.evidence.recordIds, 'recordIds');
    exactSourcePatchSet(patch.acceptanceCriteria, plan.acceptanceCriteria, 'acceptanceCriteria');
  }
}

export function assertCodeChangeSourcePatchSet(
  value: unknown,
  plans?: CodeChangePlan[],
): asserts value is CodeChangeSourcePatchSet {
  // #lizard forgives
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch set must be an object');
  }
  const set = value as CodeChangeSourcePatchSet;
  exactSourcePatchKeys(set as unknown as Record<string, unknown>, [
    'schemaVersion', 'generatedAt', 'graphFingerprint', 'patches', 'generation',
  ], 'Source patch set');
  if (set.schemaVersion !== 't2c.code-change-source-patch-set/v1') {
    throw new Error('Unsupported code change source patch set schemaVersion');
  }
  if (typeof set.generatedAt !== 'string' || Number.isNaN(Date.parse(set.generatedAt))) {
    throw new Error('Source patch set generatedAt must be an ISO date-time');
  }
  if (typeof set.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(set.graphFingerprint)) {
    throw new Error('Source patch set graphFingerprint must be SHA-256');
  }
  if (!Array.isArray(set.patches)) throw new Error('Source patch set patches must be an array');
  const plansById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const patchIds = new Set<string>();
  for (const patch of set.patches) {
    assertCodeChangeSourcePatch(patch, plans ? plansById.get(patch.planId) : undefined);
    if (patch.graphFingerprint !== set.graphFingerprint) {
      throw new Error(`Source patch ${patch.id} graphFingerprint does not match its set`);
    }
    if (patchIds.has(patch.id)) throw new Error(`Duplicate source patch id: ${patch.id}`);
    patchIds.add(patch.id);
  }
  if (plans) exactSourcePatchSet(set.patches.map((patch) => patch.planId), plans.map((plan) => plan.id), 'planIds');
  assertGroundedGenerationMetadata(set.generation, 'Source patch set generation');
  if (set.generation.generatedAt !== set.generatedAt) {
    throw new Error('Source patch set generation.generatedAt must match generatedAt');
  }
  if (set.generation.generator !== 't2c/code-change-source-patch-set') {
    throw new Error('Source patch set generation.generator must be t2c/code-change-source-patch-set');
  }
}

function instructionFor(change: CodeChangeFile, plan: CodeChangePlan): string {
  const symbols = change.symbols.length
    ? ` Focus on symbols: ${change.symbols.join(', ')}.`
    : '';
  const criteria = plan.acceptanceCriteria.length
    ? ` Acceptance: ${plan.acceptanceCriteria.join(' ')}`
    : '';
  return `${change.action} \`${change.path}\`. ${change.rationale.trim()}.${symbols}${criteria}`.replace(/\s+/g, ' ').trim();
}
