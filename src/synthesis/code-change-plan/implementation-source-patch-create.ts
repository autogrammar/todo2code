import {
  createCodeChangeSourcePatchHash,
  createCodeChangeSourcePatchId,
  sha256,
  stableStringify,
} from '../../core/id.js';
import { assertCodeChangePlansForReview } from '../../core/schema.js';
import { T2C_VERSION } from '../../version.js';
import { IMPLEMENTATION_DIAGNOSTIC_CODES } from './implementation-diagnostics.js';
import { normalizeUnifiedDiff } from './implementation-source-patch-diff.js';
import type {
  CodeChangeFile,
  CodeChangePlan,
  CodeChangeSourceEdit,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchSet,
  GroundedGenerationMetadata,
} from '../../core/types.js';
import {
  assertCodeChangeSourcePatch,
  assertCodeChangeSourcePatchSet,
} from './implementation-source-patch-assert.js';

export interface CreateCodeChangeSourcePatchOptions {
  plan: CodeChangePlan;
  /** Optional per-path unified diffs keyed by relative repository path. */
  unifiedDiffs?: Record<string, string>;
  createdAt?: string;
}

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
  const context = buildSourcePatchContext(options);
  const edits = buildSourcePatchEdits(context);
  const semantic = buildSourcePatchSemantic(context, edits);
  const patchHash = createCodeChangeSourcePatchHash(semantic);
  const patch: CodeChangeSourcePatch = {
    schemaVersion: 't2c.code-change-source-patch/v1',
    id: createCodeChangeSourcePatchId(semantic),
    patchHash,
    status: 'proposed',
    createdAt: context.createdAt,
    ...semantic,
    generation: deterministicGeneration(context.createdAt, 't2c/code-change-source-patch'),
  };
  assertCodeChangeSourcePatch(patch, context.plan);
  return patch;
}

interface SourcePatchCreationContext {
  plan: CodeChangePlan;
  createdAt: string;
  allowedPaths: Set<string>;
  diffs: Record<string, string>;
}

function buildSourcePatchContext(options: CreateCodeChangeSourcePatchOptions): SourcePatchCreationContext {
  const { plan, unifiedDiffs = {} } = options;
  const graphFingerprint = plan?.evidence?.graphFingerprint;
  assertCodeChangePlansForReview(
    [plan],
    typeof graphFingerprint === 'string' ? graphFingerprint : '',
  );
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('createdAt must be an ISO date-time');
  const allowedPaths = collectPlanTargetPaths(plan.target.paths);
  validateUnifiedDiffsBelongToPlan(plan.id, unifiedDiffs, allowedPaths);
  return { plan, createdAt, allowedPaths, diffs: unifiedDiffs };
}

function collectPlanTargetPaths(paths: string[]): Set<string> {
  return new Set(paths.map((item) => item.replace(/\\/g, '/')));
}

function validateUnifiedDiffsBelongToPlan(
  planId: string,
  diffs: Record<string, string>,
  allowedPaths: Set<string>,
): void {
  for (const diffPath of Object.keys(diffs)) {
    const normalizedPath = diffPath.replace(/\\/g, '/');
    if (!allowedPaths.has(normalizedPath)) {
      throw new Error(`Unified diff path ${normalizedPath} is not declared by plan ${planId}`);
    }
  }
}

function buildSourcePatchEdits(context: SourcePatchCreationContext): CodeChangeSourceEdit[] {
  const edits: CodeChangeSourceEdit[] = context.plan.changes
    .map((change) => buildSourcePatchEdit(context, change))
    .sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  if (!edits.length) throw new Error(`Plan ${context.plan.id} has no editable paths`);
  return edits;
}

function buildSourcePatchEdit(
  context: SourcePatchCreationContext,
  change: CodeChangeFile,
): CodeChangeSourceEdit {
  const path = change.path.replace(/\\/g, '/');
  if (!context.allowedPaths.has(path)) {
    throw new Error(`Edit path ${path} is not present in plan target.paths`);
  }
  const rawDiff = context.diffs[path];
  const unifiedDiff = rawDiff === undefined ? null : normalizeUnifiedDiff(rawDiff, path);
  return {
    path,
    action: change.action,
    symbols: uniqueSorted(change.symbols),
    instruction: instructionFor(change, context.plan),
    unifiedDiff,
  };
}

function buildSourcePatchSemantic(
  context: SourcePatchCreationContext,
  edits: CodeChangeSourceEdit[],
): Omit<CodeChangeSourcePatch, 'schemaVersion' | 'id' | 'status' | 'createdAt' | 'patchHash' | 'generation'> {
  return {
    planId: context.plan.id,
    planHash: context.plan.planHash,
    graphFingerprint: context.plan.evidence.graphFingerprint,
    diagnosticIds: uniqueSorted(context.plan.evidence.diagnosticIds),
    recordIds: uniqueSorted(context.plan.evidence.recordIds),
    edits,
    acceptanceCriteria: uniqueSorted(context.plan.acceptanceCriteria),
  };
}

export function createCodeChangeSourcePatchSet(options: {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  unifiedDiffsByPlanId?: Record<string, Record<string, string>>;
  generatedAt?: string;
}): CodeChangeSourcePatchSet {
  const context = normalizePatchSetOptions(options);
  const patches = buildPatchesForSet(context);
  const result = buildSourcePatchSet(context, patches);
  assertCodeChangeSourcePatchSet(result, options.plans);
  return result;
}

interface SourcePatchSetBuildContext {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  generatedAt: string;
  unifiedDiffsByPlanId: Record<string, Record<string, string>>;
}

function normalizePatchSetOptions(
  options: {
    plans: CodeChangePlan[];
    graphFingerprint: string;
    unifiedDiffsByPlanId?: Record<string, Record<string, string>>;
    generatedAt?: string;
  },
): SourcePatchSetBuildContext {
  if (typeof options.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(options.graphFingerprint)) {
    throw new Error('graphFingerprint must be a SHA-256 hex digest');
  }
  assertCodeChangePlansForReview(options.plans, options.graphFingerprint);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  return {
    plans: options.plans,
    graphFingerprint: options.graphFingerprint,
    generatedAt,
    unifiedDiffsByPlanId: options.unifiedDiffsByPlanId ?? {},
  };
}

function buildPatchesForSet(context: SourcePatchSetBuildContext): CodeChangeSourcePatch[] {
  return [...context.plans]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((plan) => createCodeChangeSourcePatch({
      plan,
      createdAt: context.generatedAt,
      ...(context.unifiedDiffsByPlanId[plan.id] ? { unifiedDiffs: context.unifiedDiffsByPlanId[plan.id] } : {}),
    }));
}

function buildSourcePatchSet(
  context: SourcePatchSetBuildContext,
  patches: CodeChangeSourcePatch[],
): CodeChangeSourcePatchSet {
  return {
    schemaVersion: 't2c.code-change-source-patch-set/v1',
    generatedAt: context.generatedAt,
    graphFingerprint: context.graphFingerprint,
    patches,
    generation: deterministicGeneration(context.generatedAt, 't2c/code-change-source-patch-set'),
  };
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort();
}
