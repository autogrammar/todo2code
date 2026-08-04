import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  createCodeChangePlanHash,
  createCodeChangePlanId,
  sha256,
  stableStringify,
} from '../../core/id.js';
import {
  assertCodeChangeAcceptance,
  assertCodeChangePlanForAcceptance,
  assertCodeChangePlans,
  assertConclusions,
  assertIntentGraph,
} from '../../core/schema.js';
import type {
  CodeChangeAcceptance,
  CodeChangeCloseResult,
  CodeChangeFile,
  CodeChangeFileAction,
  CodeChangePlan,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchSet,
  Conclusion,
  Diagnostic,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentRecord,
  IntentTarget,
  TodoProposal,
} from '../../core/types.js';
import { diagnoseGraph } from '../../graph/diagnostics.js';
import { T2C_VERSION } from '../../version.js';
import {
  collectImplementationDiagnostics,
  IMPLEMENTATION_DIAGNOSTIC_CODES,
} from './implementation-diagnostics.js';
import {
  indexConclusionsByDiagnostic,
  indexProposalsByDiagnostic,
} from './implementation-indexing.js';
import { collectTarget } from './implementation-targets.js';
import {
  buildPlanEvidence,
  buildPlanSemantic,
  type CodeChangePlanSemanticDraft,
} from './implementation-semantic.js';

export {
  createCodeChangeSourcePatch,
  assertCodeChangeSourcePatch,
  createCodeChangeSourcePatchSet,
  assertCodeChangeSourcePatchSet,
  type CreateCodeChangeSourcePatchOptions,
} from './implementation-source-patch.js';
export {
  createCodeChangeReviewPatch,
  assertCodeChangeReviewPatch,
  renderCodeChangeReviewMarkdown,
  type CreateCodeChangeReviewOptions,
  type CreatedCodeChangeReview,
} from './implementation-review.js';
export {
  applyCodeChangeSourcePatch,
  applyUnifiedDiffToText,
  type ApplyCodeChangeSourcePatchOptions,
  type ApplyCodeChangeSourcePatchResult,
} from './implementation-source-patch-apply.js';

export { isUsefulCodeChangePath } from '../code-change-path.js';

export interface ProposeCodeChangePlansOptions {
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
  conclusions?: Conclusion[];
  proposals?: TodoProposal[];
  generatedAt?: string;
  /** Limit how many plans are materialised from open diagnostics. Default 50. */
  maxPlans?: number;
  /**
   * Repository probe used to tell `create` from `modify`. Injected rather than
   * read here so plan synthesis stays pure and deterministic; when omitted the
   * plan cannot know and keeps the conservative `modify`.
   * See {@link createRepositoryPathProbe}.
   */
  pathExists?: (relativePath: string) => boolean;
}

export interface ProposeCodeChangePlansResult {
  schemaVersion: 't2c.code-change-plan-set/v1';
  plans: CodeChangePlan[];
  generatedAt: string;
  graphFingerprint: string;
  sourceDiagnosticCount: number;
  generation: GroundedGenerationMetadata;
}

export interface EvaluateCodeChangeAcceptanceOptions {
  plan: CodeChangePlan;
  /** Graph and diagnostics that the plan was grounded on. */
  before: { graph: IntentGraph; diagnostics: DiagnosticReport };
  /** Graph after an attempted implementation (re-extracted and re-linked). */
  afterGraph: IntentGraph;
  /** Optional precomputed after diagnostics; derived when omitted. */
  afterDiagnostics?: DiagnosticReport;
  evaluatedAt?: string;
}

export interface CloseCodeChangesOptions {
  plans: CodeChangePlan[];
  before: { graph: IntentGraph; diagnostics: DiagnosticReport };
  afterGraph: IntentGraph;
  afterDiagnostics?: DiagnosticReport;
  evaluatedAt?: string;
}

/**
 * Build grounded code-change plans from open implementation diagnostics.
 *
 * One plan is produced per diagnostic that can name at least one target path
 * (from the diagnostic's records or a matching TODO proposal). The runtime
 * never invents file paths and never marks work complete.
 */
export function proposeCodeChangePlans(options: ProposeCodeChangePlansOptions): ProposeCodeChangePlansResult {
  assertIntentGraph(options.graph);
  assertConclusions([], { graph: options.graph, diagnostics: options.diagnostics });
  const generatedAt = parseIsoDateTime(options.generatedAt);
  const maxPlans = parseMaxPlans(options.maxPlans);
  const context = buildPlanContext(options);
  const candidates = collectImplementationDiagnostics(options.diagnostics);

  const plans = buildPlansForCandidates(candidates, context, generatedAt, maxPlans);
  assertCodeChangePlans(plans, {
    graph: options.graph,
    diagnostics: options.diagnostics,
    conclusions: context.conclusions,
    proposals: context.proposals,
  });
  return buildPlanSetResult(options.graph.fingerprint, generatedAt, candidates.length, plans);
}

function buildPlansForCandidates(
  candidates: Diagnostic[],
  context: PlanContext,
  generatedAt: string,
  maxPlans: number,
): CodeChangePlan[] {
  const plans: CodeChangePlan[] = [];
  for (const diagnostic of candidates) {
    if (plans.length >= maxPlans) break;
    const plan = createPlanForDiagnostic(diagnostic, context, generatedAt);
    if (plan) plans.push(plan);
  }
  return plans;
}

function buildPlanSetResult(
  graphFingerprint: string,
  generatedAt: string,
  sourceDiagnosticCount: number,
  plans: CodeChangePlan[],
): ProposeCodeChangePlansResult {
  return {
    schemaVersion: 't2c.code-change-plan-set/v1',
    plans,
    generatedAt,
    graphFingerprint,
    sourceDiagnosticCount,
    generation: deterministicGeneration(generatedAt, 't2c/code-change-plan-set'),
  };
}

function parseIsoDateTime(value?: string): string {
  const generatedAt = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error('generatedAt must be an ISO date-time');
  }
  return generatedAt;
}

function parseMaxPlans(value: number | undefined): number {
  const maxPlans = value ?? 50;
  if (!Number.isInteger(maxPlans) || maxPlans < 1 || maxPlans > 500) {
    throw new Error('maxPlans must be an integer between 1 and 500');
  }
  return maxPlans;
}

interface PlanContext {
  graph: IntentGraph;
  recordsById: Map<string, IntentRecord>;
  proposalsByDiagnostic: Map<string, TodoProposal[]>;
  conclusionsByDiagnostic: Map<string, Conclusion[]>;
  conclusions: Conclusion[];
  proposals: TodoProposal[];
  pathExists?: (relativePath: string) => boolean;
}

function buildPlanContext(options: ProposeCodeChangePlansOptions): PlanContext {
  const conclusions = options.conclusions ?? [];
  const proposals = options.proposals ?? [];
  const context: PlanContext = {
    graph: options.graph,
    recordsById: new Map(options.graph.records.map((record) => [record.id, record])),
    proposalsByDiagnostic: indexProposalsByDiagnostic(proposals),
    conclusionsByDiagnostic: indexConclusionsByDiagnostic(conclusions),
    conclusions,
    proposals,
  };
  if (options.pathExists) {
    context.pathExists = options.pathExists;
  }
  return context;
}

function findRelatedRecords(
  diagnostic: Diagnostic,
  recordsById: Map<string, IntentRecord>,
): IntentRecord[] {
  return diagnostic.recordIds
    .map((id) => recordsById.get(id))
    .filter((record): record is IntentRecord => Boolean(record));
}

function createPlanForDiagnostic(
  diagnostic: Diagnostic,
  context: PlanContext,
  generatedAt: string,
): CodeChangePlan | null {
  const relatedRecords = findRelatedRecords(diagnostic, context.recordsById);
  if (!relatedRecords.length) return null;

  const matchingProposals = context.proposalsByDiagnostic.get(diagnostic.id) ?? [];
  const matchingConclusions = context.conclusionsByDiagnostic.get(diagnostic.id) ?? [];
  const target = collectTarget(relatedRecords, matchingProposals);
  const changes = buildChanges(target, relatedRecords, diagnostic, context.pathExists);
  if (!changes.length) return null;

  const evidence = buildPlanEvidence(context.graph.fingerprint, diagnostic.id, relatedRecords, matchingConclusions, matchingProposals);
  const confidence = confidenceForDiagnostic(diagnostic, matchingProposals);
  const semantic = buildPlanSemantic(diagnostic, relatedRecords, target, changes, evidence);
  return buildPlanResult(generatedAt, confidence, semantic);
}

function confidenceForDiagnostic(
  diagnostic: Diagnostic,
  matchingProposals: TodoProposal[],
): number {
  return confidenceFor(diagnostic, matchingProposals);
}

function buildPlanResult(
  generatedAt: string,
  confidence: number,
  semantic: CodeChangePlanSemanticDraft,
): CodeChangePlan {
  return {
    schemaVersion: 't2c.code-change-plan/v1',
    id: createCodeChangePlanId(semantic),
    planHash: createCodeChangePlanHash(semantic),
    status: 'proposed',
    createdAt: generatedAt,
    confidence,
    generation: deterministicGeneration(generatedAt, 't2c/code-change-plan'),
    ...semantic,
  };
}

/**
 * Build the repository probe for {@link ProposeCodeChangePlansOptions.pathExists}.
 *
 * A path that escapes the analysed root is reported as existing, so an unusual
 * value degrades to today's conservative `modify` instead of instructing an
 * executor to create a file outside the repository.
 */
export function createRepositoryPathProbe(root: string): (relativePath: string) => boolean {
  const base = path.resolve(root);
  return (relativePath: string): boolean => {
    const absolute = path.resolve(base, relativePath);
    if (absolute !== base && !absolute.startsWith(base + path.sep)) return true;
    return existsSync(absolute);
  };
}

/**
 * Re-diagnose an after graph and decide whether the plan's targeted
 * diagnostics cleared without introducing new blocking findings.
 *
 * Diagnostic IDs are content-bound, so a still-open finding on the same
 * records keeps the same ID. Cleared findings simply disappear.
 */

export function evaluateCodeChangeAcceptance(
  options: EvaluateCodeChangeAcceptanceOptions,
): CodeChangeAcceptance {
  assertIntentGraph(options.before.graph);
  assertIntentGraph(options.afterGraph);
  assertConclusions([], options.before);
  assertCodeChangePlanForAcceptance(options.plan, options.before);

  const context = buildAcceptanceContext(options);
  const reasons = buildAcceptanceReasons(context.remainingDiagnosticIds, context.newBlockingDiagnosticIds);
  const accepted = isAcceptancePassed(context);
  appendAcceptanceGateReason(reasons, accepted);

  const acceptance = buildAcceptanceResult(options, context, reasons, accepted);
  assertCodeChangeAcceptance(acceptance, {
    plan: options.plan,
    before: options.before,
    after: { graph: options.afterGraph, diagnostics: context.afterDiagnostics },
  });
  return acceptance;
}

interface AcceptanceContext {
  afterDiagnostics: DiagnosticReport;
  beforeDiagnosticIds: Set<string>;
  afterDiagnosticIds: string[];
  clearedDiagnosticIds: string[];
  remainingDiagnosticIds: string[];
  newBlockingDiagnosticIds: string[];
  evaluatedAt: string;
}

function buildAcceptanceContext(options: EvaluateCodeChangeAcceptanceOptions): AcceptanceContext {
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const afterDiagnostics = options.afterDiagnostics ?? diagnoseGraph(options.afterGraph, evaluatedAt);
  assertConclusions([], { graph: options.afterGraph, diagnostics: afterDiagnostics });

  const beforeDiagnosticIds = new Set(options.before.diagnostics.diagnostics.map((item) => item.id));
  const afterById = new Map(afterDiagnostics.diagnostics.map((item) => [item.id, item]));
  const afterDiagnosticIds = [...afterById.keys()].sort();
  const targetedDiagnosticIds = options.plan.evidence.diagnosticIds;

  return {
    afterDiagnostics,
    beforeDiagnosticIds,
    afterDiagnosticIds,
    clearedDiagnosticIds: targetedDiagnosticIds.filter((id) => !afterById.has(id)).sort(),
    remainingDiagnosticIds: targetedDiagnosticIds.filter((id) => afterById.has(id)).sort(),
    newBlockingDiagnosticIds: afterDiagnostics.diagnostics
      .filter((item) => item.severity === 'blocking' && !beforeDiagnosticIds.has(item.id))
      .map((item) => item.id)
      .sort(),
    evaluatedAt,
  };
}

function buildAcceptanceReasons(
  remainingDiagnosticIds: string[],
  newBlockingDiagnosticIds: string[],
): string[] {
  const reasons: string[] = [];
  if (remainingDiagnosticIds.length) {
    reasons.push(`Targeted diagnostics still open: ${remainingDiagnosticIds.join(', ')}.`);
  } else {
    reasons.push('All targeted diagnostics cleared after re-analysis.');
  }
  if (newBlockingDiagnosticIds.length) {
    reasons.push(`New blocking diagnostics appeared: ${newBlockingDiagnosticIds.join(', ')}.`);
  } else {
    reasons.push('No new blocking diagnostics appeared.');
  }
  return reasons;
}

function isAcceptancePassed(context: AcceptanceContext): boolean {
  return context.remainingDiagnosticIds.length === 0 && context.newBlockingDiagnosticIds.length === 0;
}

function appendAcceptanceGateReason(reasons: string[], accepted: boolean): void {
  if (accepted) {
    reasons.push('Acceptance gate passed; human approval is still required before DONE.');
  } else {
    reasons.push('Acceptance gate failed.');
  }
}

function buildAcceptanceResult(
  options: EvaluateCodeChangeAcceptanceOptions,
  context: AcceptanceContext,
  reasons: string[],
  accepted: boolean,
): CodeChangeAcceptance {
  return {
    schemaVersion: 't2c.code-change-acceptance/v1',
    planId: options.plan.id,
    planHash: options.plan.planHash,
    beforeGraphFingerprint: options.before.graph.fingerprint,
    afterGraphFingerprint: options.afterGraph.fingerprint,
    beforeDiagnosticIds: [...context.beforeDiagnosticIds].sort(),
    afterDiagnosticIds: context.afterDiagnosticIds,
    clearedDiagnosticIds: context.clearedDiagnosticIds,
    remainingDiagnosticIds: context.remainingDiagnosticIds,
    newBlockingDiagnosticIds: context.newBlockingDiagnosticIds,
    accepted,
    reasons: uniqueSorted(reasons),
    evaluatedAt: context.evaluatedAt,
    generation: deterministicGeneration(context.evaluatedAt, 't2c/code-change-acceptance'),
  };
}

/** Evaluate a plan set under one timestamp without applying changes or marking DONE. */
export function closeCodeChanges(options: CloseCodeChangesOptions): CodeChangeCloseResult {
  const context = buildCloseCodeChangeContext(options);
  const acceptances = options.plans.map((plan) => evaluateCodeChangeAcceptance({
    plan,
    before: options.before,
    afterGraph: options.afterGraph,
    afterDiagnostics: context.afterDiagnostics,
    evaluatedAt: context.evaluatedAt,
  }));
  const acceptedCount = acceptances.filter((item) => item.accepted).length;
  return buildCloseResult(options, context.evaluatedAt, acceptances, acceptedCount);
}

interface CloseCodeChangeContext {
  evaluatedAt: string;
  afterDiagnostics: DiagnosticReport;
}

function buildCloseCodeChangeContext(options: CloseCodeChangesOptions): CloseCodeChangeContext {
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(evaluatedAt))) throw new Error('evaluatedAt must be an ISO date-time');
  assertIntentGraph(options.before.graph);
  assertIntentGraph(options.afterGraph);
  assertConclusions([], options.before);
  const afterDiagnostics = options.afterDiagnostics ?? diagnoseGraph(options.afterGraph, evaluatedAt);
  assertConclusions([], { graph: options.afterGraph, diagnostics: afterDiagnostics });
  ensureClosePlanIdsAreUnique(options.plans);
  return { evaluatedAt, afterDiagnostics };
}

function ensureClosePlanIdsAreUnique(plans: CodeChangePlan[]): void {
  const planIds = plans.map((plan) => plan.id);
  if (new Set(planIds).size !== planIds.length) {
    throw new Error('Code change close plans must have unique ids');
  }
}

function buildCloseResult(
  options: CloseCodeChangesOptions,
  evaluatedAt: string,
  acceptances: CodeChangeAcceptance[],
  acceptedCount: number,
): CodeChangeCloseResult {
  return {
    schemaVersion: 't2c.code-change-close-result/v1',
    evaluatedAt,
    graphFingerprintBefore: options.before.graph.fingerprint,
    graphFingerprintAfter: options.afterGraph.fingerprint,
    planCount: options.plans.length,
    acceptedCount,
    rejectedCount: options.plans.length - acceptedCount,
    allAccepted: options.plans.length > 0 && acceptedCount === options.plans.length,
    acceptances,
    generation: deterministicGeneration(evaluatedAt, 't2c/code-change-close-result'),
  };
}
function buildChanges(
  target: IntentTarget,
  records: IntentRecord[],
  diagnostic: Diagnostic,
  pathExistsInRepository?: (relativePath: string) => boolean,
): CodeChangeFile[] {
  const symbols = uniqueSorted(target.symbols);
  // The diagnostic explains why evidence is missing; it is not necessarily an
  // implementation instruction. Reusing its generic remediation here produced
  // contradictory tickets such as “replace magic number 50” followed by
  // “provide a missing function”. The lossless source declaration is the work
  // to perform, while the diagnostic remains available in the plan evidence.
  const sourceIntents = uniqueSorted(records.map((record) => record.statement.text));
  const rationale = sourceIntents.length
    ? `Implement the source intent: ${sourceIntents.join(' | ')}`
    : diagnostic.detail || `Address ${diagnostic.code}.`;

  if (target.paths.length) {
    const changes: CodeChangeFile[] = [];
    for (const declared of uniqueSorted(target.paths)) {
      const normalized = declared.replace(/\\/g, '/');
      const exists = pathExistsInRepository?.(normalized);
      // A path without a directory is shorthand that never said *where* the
      // file belongs. Creating one at the repository root invents a location:
      // measured across seven foreign repositories this proposed `__init__.py`
      // beside 22 real ones, `pyproject.toml` beside 32, and files named after
      // prose fragments such as `it.md`. The diagnostic still reports the gap;
      // only the invented instruction is withheld.
      if (exists === false && !normalized.includes('/')) continue;
      // Documentation routinely plans files that do not exist yet (a target
      // repository's `docs/ARCHITECTURE.md`). Telling an executor to modify
      // them is an instruction it cannot follow, and `apply-source-patch`
      // rejects a create edit whose target already exists, so the two actions
      // must not be guessed.
      const action: CodeChangeFileAction = exists === false ? 'create' : 'modify';
      changes.push({ path: normalized, action, symbols, rationale });
    }
    return changes;
  }

  // Without a path the plan cannot safely name a source file. Skip rather than invent.
  return [];
}

function confidenceFor(diagnostic: Diagnostic, proposals: TodoProposal[]): number {
  if (proposals.length) {
    return Math.min(0.92, Math.max(...proposals.map((item) => item.confidence)));
  }
  if (diagnostic.severity === 'blocking') return 0.88;
  if (diagnostic.severity === 'review_required') return 0.8;
  return 0.72;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort();
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

