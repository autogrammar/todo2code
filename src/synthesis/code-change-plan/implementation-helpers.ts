import { randomUUID } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createCodeChangePlanHash,
  createCodeChangePlanId,
  createCodeChangeSourcePatchHash,
  createCodeChangeSourcePatchId,
  sha256,
  stableStringify,
} from '../../core/id.js';
import { ensureDir, pathExists, readJson, readText } from '../../core/io.js';
import { assertPathWithinRoot } from '../../core/security.js';
import {
  assertCodeChangeAcceptance,
  assertCodeChangePlanForAcceptance,
  assertCodeChangePlans,
  assertCodeChangePlansForReview,
  assertConclusions,
  assertGroundedGenerationMetadata,
  assertIntentGraph,
} from '../../core/schema.js';
import type {
  CodeChangeAcceptance,
  CodeChangeCloseResult,
  CodeChangeFile,
  CodeChangeFileAction,
  CodeChangePlan,
  CodeChangeReviewPatch,
  CodeChangeSourceApplyReceipt,
  CodeChangeSourceEdit,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchApproval,
  CodeChangeSourcePatchSet,
  Conclusion,
  Diagnostic,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentRecord,
  IntentTarget,
  TodoPriority,
  TodoProposal,
} from '../../core/types.js';
import { normalizeTarget } from '../../core/target.js';
import { diagnoseGraph } from '../../graph/diagnostics.js';
import { T2C_VERSION } from '../../version.js';
import { isUsefulCodeChangePath } from '../code-change-path.js';

export { isUsefulCodeChangePath } from '../code-change-path.js';

const IMPLEMENTATION_DIAGNOSTIC_CODES = new Set([
  'PLANNED_NOT_IMPLEMENTED',
  'CHANGELOG_WITHOUT_IMPLEMENTATION',
]);

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
  return {
    graph: options.graph,
    recordsById: new Map(options.graph.records.map((record) => [record.id, record])),
    proposalsByDiagnostic: indexProposalsByDiagnostic(proposals),
    conclusionsByDiagnostic: indexConclusionsByDiagnostic(conclusions),
    conclusions,
    proposals,
    pathExists: options.pathExists,
  };
}

function collectImplementationDiagnostics(report: DiagnosticReport): Diagnostic[] {
  return report.diagnostics
    .filter((diagnostic) => IMPLEMENTATION_DIAGNOSTIC_CODES.has(diagnostic.code))
    // A released CHANGELOG entry is an audit signal; an open TODO is an
    // explicit request for work.  With a bounded plan set, sorting only by
    // content id allowed historical release notes to consume every slot and
    // hide the repository's actual backlog from autonomous executors.
    .sort((left, right) => implementationDiagnosticRank(left)
      - implementationDiagnosticRank(right) || left.id.localeCompare(right.id));
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

interface CodeChangePlanSemanticDraft {
  title: string;
  description: string;
  priority: TodoPriority;
  target: IntentTarget;
  acceptanceCriteria: string[];
  changes: CodeChangeFile[];
  risk: CodeChangePlan['risk'];
  rollback: string;
  evidence: {
    graphFingerprint: string;
    recordIds: string[];
    diagnosticIds: string[];
    conclusionIds: string[];
    proposalIds: string[];
  };
}

function buildPlanEvidence(
  graphFingerprint: string,
  diagnosticId: string,
  relatedRecords: IntentRecord[],
  matchingConclusions: Conclusion[],
  matchingProposals: TodoProposal[],
): CodeChangePlanSemanticDraft['evidence'] {
  return {
    graphFingerprint,
    recordIds: uniqueSorted(relatedRecords.map((record) => record.id)),
    diagnosticIds: [diagnosticId],
    conclusionIds: uniqueSorted(matchingConclusions.map((item) => item.id)),
    proposalIds: uniqueSorted(matchingProposals.map((item) => item.id)),
  };
}

function buildPlanSemantic(
  diagnostic: Diagnostic,
  relatedRecords: IntentRecord[],
  target: IntentTarget,
  changes: CodeChangeFile[],
  evidence: CodeChangePlanSemanticDraft['evidence'],
): CodeChangePlanSemanticDraft {
  return {
    title: titleFor(diagnostic, relatedRecords),
    description: descriptionFor(diagnostic, relatedRecords, target),
    priority: priorityFor(diagnostic),
    target,
    acceptanceCriteria: acceptanceCriteriaFor(diagnostic, target),
    changes,
    risk: riskFor(diagnostic, changes),
    rollback: rollbackFor(changes),
    evidence,
  };
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

function implementationDiagnosticRank(diagnostic: Diagnostic): number {
  return diagnostic.code === 'PLANNED_NOT_IMPLEMENTED' ? 0 : 1;
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
function indexProposalsByDiagnostic(proposals: TodoProposal[]): Map<string, TodoProposal[]> {
  const index = new Map<string, TodoProposal[]>();
  for (const proposal of proposals) {
    for (const diagnosticId of proposal.diagnosticIds) {
      const list = index.get(diagnosticId) ?? [];
      list.push(proposal);
      index.set(diagnosticId, list);
    }
  }
  return index;
}

function indexConclusionsByDiagnostic(conclusions: Conclusion[]): Map<string, Conclusion[]> {
  const index = new Map<string, Conclusion[]>();
  for (const conclusion of conclusions) {
    for (const diagnosticId of conclusion.diagnosticIds) {
      const list = index.get(diagnosticId) ?? [];
      list.push(conclusion);
      index.set(diagnosticId, list);
    }
  }
  return index;
}

function collectTarget(records: IntentRecord[], proposals: TodoProposal[]): IntentTarget {
  const target = collectTargetComponents(records, proposals);
  return finalizeTarget(target);
}

function collectTargetComponents(
  records: IntentRecord[],
  proposals: TodoProposal[],
): {
  paths: Set<string>;
  symbols: Set<string>;
  tickets: Set<string>;
  versions: Set<string>;
} {
  const paths = new Set<string>();
  const symbols = new Set<string>();
  const tickets = new Set<string>();
  const versions = new Set<string>();
  for (const source of records) {
    addTargetEntries(source.statement.target, paths, symbols, tickets, versions);
  }
  for (const proposal of proposals) {
    addTargetEntries(proposal.target, paths, symbols, tickets, versions);
  }
  return { paths, symbols, tickets, versions };
}

function addTargetEntries(
  target: IntentTarget,
  paths: Set<string>,
  symbols: Set<string>,
  tickets: Set<string>,
  versions: Set<string>,
): void {
  for (const value of target.paths) paths.add(value);
  for (const value of target.symbols) symbols.add(value);
  for (const value of target.tickets) tickets.add(value);
  for (const value of target.versions) versions.add(value);
}

function finalizeTarget(target: {
  paths: Set<string>;
  symbols: Set<string>;
  tickets: Set<string>;
  versions: Set<string>;
}): IntentTarget {
  const paths = [...target.paths].filter(isUsefulCodeChangePath);
  const symbols = [...target.symbols];
  const tickets = [...target.tickets];
  const versions = [...target.versions];
  return normalizeTarget({
    paths,
    symbols,
    tickets,
    versions,
  });
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

function titleFor(diagnostic: Diagnostic, records: IntentRecord[]): string {
  const record = records[0];
  const object = record?.statement.object?.trim();
  // `inferObject` removes the verb selected by the action classifier. In a
  // compound sentence a later high-precedence verb can win (`verify` before
  // `implement`), leaving the original leading imperative inside `object` and
  // a broken fragment after the removed verb. The source statement is the
  // lossless title whenever that mismatch is visible.
  if (object && startsWithImperative(object) && record?.statement.text.trim()) {
    return record.statement.text.trim().replace(/[.!?]+$/, '');
  }
  if (object) return `Implement ${object}`;
  return diagnostic.title.trim() || `Resolve ${diagnostic.code}`;
}

function startsWithImperative(value: string): boolean {
  return /^(?:add|build|change|configure|create|delete|document|fix|implement|preserve|refactor|remove|test|update|validate|verify)\b/i.test(value)
    || /^(?:dodać|dodac|naprawić|naprawic|przetestować|przetestowac|usunąć|usunac|utworzyć|utworzyc|wdrożyć|wdrozyc|zmienić|zmienic|zweryfikować|zweryfikowac)\b/i.test(value);
}

function descriptionFor(
  diagnostic: Diagnostic,
  records: IntentRecord[],
  target: IntentTarget,
): string {
  const parts = [
    diagnostic.detail.trim(),
    records[0] ? `Source intent: ${records[0].statement.text.trim()}` : '',
    target.paths.length ? `Paths: ${target.paths.join(', ')}.` : '',
    target.symbols.length ? `Symbols: ${target.symbols.join(', ')}.` : '',
    target.tickets.length ? `Tickets: ${target.tickets.join(', ')}.` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

function acceptanceCriteriaFor(diagnostic: Diagnostic, target: IntentTarget): string[] {
  const criteria = [
    `Re-run todo2code link+diagnose and clear diagnostic ${diagnostic.id} (${diagnostic.code}).`,
    'Do not introduce new blocking diagnostics.',
  ];
  if (target.paths.length) {
    criteria.push(`Touch only the declared paths: ${uniqueSorted(target.paths).join(', ')}.`);
  }
  if (target.symbols.length) {
    criteria.push(`Provide AST evidence for symbols: ${uniqueSorted(target.symbols).join(', ')}.`);
  }
  return uniqueSorted(criteria);
}

function priorityFor(diagnostic: Diagnostic): TodoPriority {
  if (diagnostic.severity === 'blocking') return 'P0';
  if (diagnostic.severity === 'review_required') return 'P1';
  if (diagnostic.severity === 'warning') return 'P2';
  return 'P3';
}

function confidenceFor(diagnostic: Diagnostic, proposals: TodoProposal[]): number {
  if (proposals.length) {
    return Math.min(0.92, Math.max(...proposals.map((item) => item.confidence)));
  }
  if (diagnostic.severity === 'blocking') return 0.88;
  if (diagnostic.severity === 'review_required') return 0.8;
  return 0.72;
}

function riskFor(diagnostic: Diagnostic, changes: CodeChangeFile[]): CodeChangePlan['risk'] {
  const level = diagnostic.severity === 'blocking' ? 'high'
    : diagnostic.severity === 'review_required' ? 'medium'
      : 'low';
  const reasons = [
    `Derived from ${diagnostic.severity} diagnostic ${diagnostic.id}.`,
    `Touches ${changes.length} declared ${changes.length === 1 ? 'path' : 'paths'}.`,
  ];
  return { level, reasons: uniqueSorted(reasons) };
}

function rollbackFor(changes: CodeChangeFile[]): string {
  return `Revert the proposed changes to ${uniqueSorted(changes.map((item) => item.path)).join(', ')} and re-run todo2code diagnostics.`;
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

export interface CreateCodeChangeReviewOptions {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  createdAt?: string;
}

export interface CreatedCodeChangeReview {
  markdown: string;
  artifact: CodeChangeReviewPatch;
}

/**
 * Render a stable, reviewable Markdown brief for grounded code-change plans.
 *
 * This is not a source patch and is never applied to the tree. It exists so
 * humans and agents share one hash-bound artifact that lists exact paths,
 * acceptance criteria, evidence IDs, risk and rollback instructions.
 */
export function createCodeChangeReviewPatch(
  options: CreateCodeChangeReviewOptions,
): CreatedCodeChangeReview {
  const context = buildCodeChangeReviewContext(options);
  const markdown = buildCodeChangeReviewMarkdown(context);
  const artifact = buildCodeChangeReviewArtifact(context, markdown);
  assertCodeChangeReviewPatch(artifact);
  return { markdown, artifact };
}

interface CodeChangeReviewContext {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  createdAt: string;
}

function buildCodeChangeReviewContext(options: CreateCodeChangeReviewOptions): CodeChangeReviewContext {
  if (typeof options.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(options.graphFingerprint)) {
    throw new Error('graphFingerprint must be a SHA-256 hex digest');
  }
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('createdAt must be an ISO date-time');
  assertCodeChangePlansForReview(options.plans, options.graphFingerprint);
  return {
    plans: sortCodeChangeReviewPlans(options.plans),
    graphFingerprint: options.graphFingerprint,
    createdAt,
  };
}

function sortCodeChangeReviewPlans(plans: CodeChangePlan[]): CodeChangePlan[] {
  return [...plans].sort((left, right) =>
    priorityRank(left.priority) - priorityRank(right.priority) || left.id.localeCompare(right.id));
}

function buildCodeChangeReviewMarkdown(context: CodeChangeReviewContext): string {
  return renderCodeChangeReviewMarkdown(context.plans, context.graphFingerprint);
}

function buildCodeChangeReviewArtifact(
  context: CodeChangeReviewContext,
  markdown: string,
): CodeChangeReviewPatch {
  return {
    schemaVersion: 't2c.code-change-review/v1',
    createdAt: context.createdAt,
    graphFingerprint: context.graphFingerprint,
    planIds: context.plans.map((plan) => plan.id),
    planHashes: context.plans.map((plan) => plan.planHash),
    renderedPatchHash: sha256(markdown),
    generation: deterministicGeneration(context.createdAt, 't2c/code-change-review'),
  };
}

export function renderCodeChangeReviewMarkdown(
  plans: CodeChangePlan[],
  graphFingerprint: string,
): string {
  const lines = buildCodeChangeReviewMarkdownLines(plans, graphFingerprint);
  return lines.join('\n');
}

function buildCodeChangeReviewMarkdownLines(
  plans: CodeChangePlan[],
  graphFingerprint: string,
): string[] {
  const lines = [
    '<!-- t2c.code-change-review/v1 -->',
    '# todo2code proposed code changes',
    '',
    'This document is a grounded **review brief**, not an auto-applied source patch.',
    'Implement the listed paths in a normal branch, re-run the pipeline, then',
    '`t2c evaluate-code-change`. Acceptance still requires human/CI approval before DONE.',
    '',
    `Graph fingerprint: \`${graphFingerprint}\``,
    '',
  ];
  if (!plans.length) {
    lines.push('_No grounded code-change plans. Open diagnostics either cleared or lack repository paths._', '');
    return lines;
  }
  let currentPriority: CodeChangePlan['priority'] | null = null;
  for (const plan of plans) {
    currentPriority = appendPriorityHeader(lines, currentPriority, plan);
    appendPlanDetails(lines, plan);
  }
  appendAfterImplementationSection(lines);
  return lines;
}

function appendPriorityHeader(
  lines: string[],
  currentPriority: CodeChangePlan['priority'] | null,
  plan: CodeChangePlan,
): CodeChangePlan['priority'] {
  if (plan.priority === currentPriority) return currentPriority;
  if (currentPriority !== null) lines.push('');
  lines.push(`## ${plan.priority}`, '');
  return plan.priority;
}

function appendPlanDetails(lines: string[], plan: CodeChangePlan): void {
  lines.push(`### ${inline(plan.title)} (\`${plan.id}\`)`, '');
  lines.push(`- Plan hash: \`${plan.planHash}\``);
  lines.push(`- Risk: **${plan.risk.level}** — ${plan.risk.reasons.map(inline).join('; ')}`);
  lines.push(`- Confidence: ${plan.confidence.toFixed(2)}`);
  lines.push(`- Description: ${inline(plan.description)}`);
  appendPlanChanges(lines, plan);
  lines.push('- Acceptance criteria:');
  for (const criterion of plan.acceptanceCriteria) lines.push(`  - [ ] ${inline(criterion)}`);
  lines.push(`- Diagnostics: ${renderIds(plan.evidence.diagnosticIds)}`);
  lines.push(`- Evidence records: ${renderIds(plan.evidence.recordIds)}`);
  if (plan.evidence.proposalIds.length) lines.push(`- TODO proposals: ${renderIds(plan.evidence.proposalIds)}`);
  if (plan.evidence.conclusionIds.length) lines.push(`- Conclusions: ${renderIds(plan.evidence.conclusionIds)}`);
  lines.push(`- Rollback: ${inline(plan.rollback)}`);
  lines.push('');
}

function appendPlanChanges(lines: string[], plan: CodeChangePlan): void {
  lines.push('- Changes:');
  for (const change of plan.changes) {
    const symbols = change.symbols.length ? ` symbols: ${change.symbols.map((item) => `\`${item}\``).join(', ')}` : '';
    lines.push(`  - \`${change.action}\` \`${change.path}\`${symbols}`);
    lines.push(`    - ${inline(change.rationale)}`);
  }
}

function appendAfterImplementationSection(lines: string[]): void {
  lines.push('## After implementation', '');
  lines.push('1. Re-run `t2c pipeline` (or extract + link + diagnose) on the changed tree.');
  lines.push('2. `t2c evaluate-code-change <plan.json> --before-graph … --after-graph … --out acceptance.json`.');
  lines.push('3. Require `accepted=true` and human/CI review before marking work DONE.');
  lines.push('');
}

export function assertCodeChangeReviewPatch(value: unknown): asserts value is CodeChangeReviewPatch {
  const artifact = assertSourcePatchObject(value, 'Code change review patch must be an object');
  validateReviewPatchKeys(artifact);
  assertCodeChangeReviewPatchSchema(artifact);
  assertCodeChangeReviewPatchPlanCollections(artifact);
  assertCodeChangeReviewPatchGeneration(artifact);
}

function validateReviewPatchKeys(artifact: Record<string, unknown>): void {
  const required = [
    'schemaVersion', 'createdAt', 'graphFingerprint', 'planIds', 'planHashes',
    'renderedPatchHash', 'generation',
  ];
  for (const key of required) {
    if (!(key in artifact)) throw new Error(`Code change review patch is missing: ${key}`);
  }
}

function assertCodeChangeReviewPatchSchema(artifact: Record<string, unknown>): void {
  assertReviewPatchSchemaVersion(artifact);
  assertReviewPatchDateFields(artifact);
  assertReviewPatchIds(artifact);
}

function assertReviewPatchSchemaVersion(artifact: Record<string, unknown>): void {
  if (artifact.schemaVersion !== 't2c.code-change-review/v1') {
    throw new Error('Unsupported code change review schemaVersion');
  }
}

function assertReviewPatchDateFields(artifact: Record<string, unknown>): void {
  if (typeof artifact.createdAt !== 'string' || Number.isNaN(Date.parse(artifact.createdAt))) {
    throw new Error('Code change review createdAt must be an ISO date-time');
  }
  if (typeof artifact.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.graphFingerprint)) {
    throw new Error('Code change review graphFingerprint must be SHA-256');
  }
  if (typeof artifact.renderedPatchHash !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.renderedPatchHash)) {
    throw new Error('Code change review renderedPatchHash must be SHA-256');
  }
}

function assertReviewPatchIds(artifact: Record<string, unknown>): void {
  if (!Array.isArray(artifact.planIds) || !artifact.planIds.every((id) => typeof id === 'string' && /^CPLAN-[a-f0-9]{20}$/.test(id))) {
    throw new Error('Code change review planIds must be CPLAN ids');
  }
  if (!Array.isArray(artifact.planHashes) || !artifact.planHashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) {
    throw new Error('Code change review planHashes must be SHA-256 digests');
  }
}

function assertCodeChangeReviewPatchPlanCollections(artifact: Record<string, unknown>): void {
  if (artifact.planIds.length !== artifact.planHashes.length) {
    throw new Error('Code change review planIds and planHashes must have equal length');
  }
  if (new Set(artifact.planIds as string[]).size !== (artifact.planIds as string[]).length) {
    throw new Error('Code change review planIds must be unique');
  }
}

function assertCodeChangeReviewPatchGeneration(artifact: Record<string, unknown>): void {
  assertGroundedGenerationMetadata(artifact.generation, 'Code change review generation');
  const generation = artifact.generation as GroundedGenerationMetadata;
  if (generation.generatedAt !== artifact.createdAt) {
    throw new Error('Code change review generation.generatedAt must match createdAt');
  }
  if (generation.generator !== 't2c/code-change-review') {
    throw new Error('Code change review generation.generator must be t2c/code-change-review');
  }
}

function priorityRank(priority: TodoPriority): number {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 } as const)[priority];
}

function inline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderIds(ids: string[]): string {
  return ids.length ? ids.map((id) => `\`${id}\``).join(', ') : '_none_';
}

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

export function assertCodeChangeSourcePatch(
  value: unknown,
  plan?: CodeChangePlan,
): asserts value is CodeChangeSourcePatch {
  const patch = assertCodeChangeSourcePatchObject(value, plan);
  validateSourcePatchSchema(patch);
  validateSourcePatchIdentifiers(patch);
  const editPaths = validateSourcePatchEdits(patch);
  validateSourcePatchHashAndId(patch);
  validateSourcePatchGeneration(patch);
  if (plan) {
    validateSourcePatchAgainstPlan(patch, plan, editPaths);
  }
}

function assertCodeChangeSourcePatchObject(value: unknown, plan?: CodeChangePlan): CodeChangeSourcePatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch must be an object');
  }
  const patch = value as CodeChangeSourcePatch;
  exactSourcePatchKeys(patch as unknown as Record<string, unknown>, [
    'schemaVersion', 'id', 'patchHash', 'status', 'createdAt', 'planId', 'planHash',
    'graphFingerprint', 'diagnosticIds', 'recordIds', 'edits', 'acceptanceCriteria', 'generation',
  ], 'Source patch');
  if (plan !== undefined && typeof patch.planId === 'string' && patch.id) {
    if (patch.planId !== plan.id) {
      throw new Error('Source patch is not bound to the supplied plan');
    }
  }
  return patch;
}

function validateSourcePatchSchema(patch: CodeChangeSourcePatch): void {
  if (patch.schemaVersion !== 't2c.code-change-source-patch/v1') {
    throw new Error('Unsupported code change source patch schemaVersion');
  }
  if (typeof patch.createdAt !== 'string' || Number.isNaN(Date.parse(patch.createdAt))) {
    throw new Error('Source patch createdAt must be an ISO date-time');
  }
  if (patch.status !== 'proposed') throw new Error('Source patch status must be proposed');
  if (!Array.isArray(patch.edits) || patch.edits.length === 0) {
    throw new Error('Source patch edits must be a non-empty array');
  }
}

function validateSourcePatchIdentifiers(patch: CodeChangeSourcePatch): void {
  if (typeof patch.id !== 'string' || !/^SPATCH-[a-f0-9]{20}$/.test(patch.id)) {
    throw new Error('Source patch id must match SPATCH-<20 hex>');
  }
  if (typeof patch.patchHash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.patchHash)) {
    throw new Error('Source patch patchHash must be SHA-256');
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
  assertSourcePatchIds(patch.diagnosticIds, /^DIAG-[a-f0-9]{20}$/, 'diagnosticIds');
  assertSourcePatchIds(patch.recordIds, /^INT-[A-Z]+-[a-f0-9]{20}$/, 'recordIds');
  assertSourcePatchStrings(patch.acceptanceCriteria, 'acceptanceCriteria', false);
}

function validateSourcePatchEdits(patch: CodeChangeSourcePatch): Set<string> {
  return collectSourcePatchEditPathActions(patch.edits);
}

function collectSourcePatchEditPathActions(edits: CodeChangeSourceEdit[]): Set<string> {
  const paths = new Set<string>();
  for (const edit of edits) {
    const editContext = validateSourcePatchEdit(edit, paths);
    paths.add(editContext.pathActionKey);
  }
  return paths;
}

interface SourcePatchEditValidationContext {
  pathActionKey: string;
}

function validateSourcePatchEdit(
  edit: CodeChangeSourceEdit,
  seen: Set<string>,
): SourcePatchEditValidationContext {
  const normalizedEdit = assertSourcePatchEditObject(edit);
  const normalizedPath = normalizeSourcePatchEditPath(normalizedEdit.path);
  validateSourcePatchEditBody(normalizedEdit, normalizedPath);
  validateSourcePatchEditDiff(normalizedEdit.unifiedDiff, normalizedPath);
  assertUniqueSourcePatchEditPathAction(seen, normalizedPath, normalizedEdit.action);
  const pathActionKey = `${normalizedPath}::${normalizedEdit.action}`;
  return { pathActionKey };
}

function assertSourcePatchEditObject(edit: CodeChangeSourceEdit | unknown): {
  path: unknown;
  action: unknown;
  symbols: unknown;
  instruction: unknown;
  unifiedDiff: string | null;
} {
  if (!edit || typeof edit !== 'object') throw new Error('Source patch edit must be an object');
  exactSourcePatchKeys(edit as unknown as Record<string, unknown>, [
    'path', 'action', 'symbols', 'instruction', 'unifiedDiff',
  ], 'Source patch edit');
  return edit as {
    path: unknown;
    action: unknown;
    symbols: unknown;
    instruction: unknown;
    unifiedDiff: string | null;
  };
}

function validateSourcePatchEditBody(
  edit: {
    path: unknown;
    action: unknown;
    symbols: unknown;
    instruction: unknown;
    unifiedDiff: string | null;
  },
  normalizedPath: string,
): void {
  ensureSourcePatchEditAction(edit.action);
  ensureSourcePatchEditInstruction(edit.instruction);
  assertSourcePatchStrings(edit.symbols, `edits[${normalizedPath}].symbols`, true);
}

function validateSourcePatchEditDiff(unifiedDiff: string | null, normalizedPath: string): void {
  if (unifiedDiff === null) return;
  if (typeof unifiedDiff !== 'string') {
    throw new Error(`Source patch unifiedDiff for ${normalizedPath} must be string or null`);
  }
  normalizeUnifiedDiff(unifiedDiff, normalizedPath);
}

function assertUniqueSourcePatchEditPathAction(
  seen: Set<string>,
  normalizedPath: string,
  action: unknown,
): void {
  const pathActionKey = `${normalizedPath}::${action}`;
  if (seen.has(pathActionKey)) throw new Error(`Duplicate source patch edit for ${normalizedPath}`);
}

function normalizeSourcePatchEditPath(pathValue: unknown): string {
  const normalizedPath = (typeof pathValue === 'string' ? pathValue.trim() : '').replace(/\\/g, '/');
  if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
    throw new Error(`Source patch edit path is not a relative repository path: ${normalizedPath}`);
  }
  return normalizedPath;
}

function ensureSourcePatchEditAction(action: unknown): void {
  if (!['create', 'modify', 'delete'].includes(action as string) || typeof action !== 'string') {
    throw new Error(`Source patch edit action is unsupported: ${String(action)}`);
  }
}

function ensureSourcePatchEditInstruction(instruction: unknown): void {
  if (typeof instruction !== 'string' || !instruction.trim()) {
    throw new Error('Source patch edit instruction must be non-blank');
  }
}

function validateSourcePatchHashAndId(patch: CodeChangeSourcePatch): void {
  const expectedHash = createCodeChangeSourcePatchHash(patch);
  if (patch.patchHash !== expectedHash) {
    throw new Error(`Source patch patchHash does not match semantic content: expected ${expectedHash}`);
  }
  if (patch.id !== createCodeChangeSourcePatchId(patch)) {
    throw new Error('Source patch id does not match semantic content');
  }
}

function validateSourcePatchGeneration(patch: CodeChangeSourcePatch): void {
  assertGroundedGenerationMetadata(patch.generation, 'Source patch generation');
  if (patch.generation.generatedAt !== patch.createdAt) {
    throw new Error('Source patch generation.generatedAt must match createdAt');
  }
  if (patch.generation.generator !== 't2c/code-change-source-patch') {
    throw new Error('Source patch generation.generator must be t2c/code-change-source-patch');
  }
}

function validateSourcePatchAgainstPlan(
  patch: CodeChangeSourcePatch,
  plan: CodeChangePlan,
  editPaths: Set<string>,
): void {
  assertSourcePatchPlanBinding(patch, plan);
  const expectedChanges = collectExpectedPlanChanges(plan);
  validateSourcePatchEditsAgainstPlan(patch, plan, expectedChanges);
  validateSourcePatchEvidence(patch, plan, expectedChanges, editPaths);
}

function assertSourcePatchPlanBinding(patch: CodeChangeSourcePatch, plan: CodeChangePlan): void {
  if (patch.planHash !== plan.planHash) throw new Error('Source patch is not bound to the supplied plan');
  if (patch.graphFingerprint !== plan.evidence.graphFingerprint) {
    throw new Error('Source patch graphFingerprint does not match the plan');
  }
}

function collectExpectedPlanChanges(plan: CodeChangePlan): Map<string, CodeChangeFileAction> {
  return new Map(plan.changes.map((item) => [
    item.path.replace(/\\/g, '/'), item.action,
  ]));
}

function validateSourcePatchEditsAgainstPlan(
  patch: CodeChangeSourcePatch,
  plan: CodeChangePlan,
  expectedChanges: Map<string, CodeChangeFileAction>,
): void {
  const allowed = new Set(plan.target.paths.map((item) => item.replace(/\\/g, '/')));
  for (const edit of patch.edits) {
    const editPath = edit.path.replace(/\\/g, '/');
    if (!allowed.has(editPath)) {
      throw new Error(`Source patch path ${edit.path} is outside plan target.paths`);
    }
    if (expectedChanges.get(editPath) !== edit.action) {
      throw new Error(`Source patch action for ${edit.path} does not match the plan`);
    }
  }
}

function validateSourcePatchEvidence(
  patch: CodeChangeSourcePatch,
  plan: CodeChangePlan,
  expectedChangePaths: Map<string, CodeChangeFileAction>,
  editPaths: Set<string>,
): void {
  const actualEditPaths = [...editPaths].map((item) => item.split('::')[0]);
  const expectedPaths = [...expectedChangePaths.keys()];
  exactSourcePatchSet(actualEditPaths, expectedPaths, 'edit paths');
  exactSourcePatchSet(patch.diagnosticIds, plan.evidence.diagnosticIds, 'diagnosticIds');
  exactSourcePatchSet(patch.recordIds, plan.evidence.recordIds, 'recordIds');
  exactSourcePatchSet(patch.acceptanceCriteria, plan.acceptanceCriteria, 'acceptanceCriteria');
}

export function assertCodeChangeSourcePatchSet(
  value: unknown,
  plans?: CodeChangePlan[],
): asserts value is CodeChangeSourcePatchSet {
  const set = assertSourcePatchSetObject(value);
  const context = createSourcePatchSetValidationContext(plans);
  validateSourcePatchSetSchema(set);
  validateSourcePatchSetPatches(set, context);
  validateSourcePatchSetGeneration(set);
}

interface SourcePatchSetValidationContext {
  plansById: Map<string, CodeChangePlan>;
  expectedPlanIds: string[] | null;
}

function createSourcePatchSetValidationContext(plans?: CodeChangePlan[]): SourcePatchSetValidationContext {
  const expectedPlanIds = plans?.map((plan) => plan.id) ?? null;
  return {
    plansById: new Map((plans ?? []).map((plan) => [plan.id, plan])),
    expectedPlanIds,
  };
}

function assertSourcePatchObject(value: unknown, objectLabel: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(objectLabel);
  }
  return value as Record<string, unknown>;
}

function assertSourcePatchSetObject(value: unknown): CodeChangeSourcePatchSet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch set must be an object');
  }
  const set = value as CodeChangeSourcePatchSet;
  exactSourcePatchKeys(set as unknown as Record<string, unknown>, [
    'schemaVersion', 'generatedAt', 'graphFingerprint', 'patches', 'generation',
  ], 'Source patch set');
  return set;
}

function validateSourcePatchSetSchema(set: CodeChangeSourcePatchSet): void {
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
}

function validateSourcePatchSetPatches(
  set: CodeChangeSourcePatchSet,
  context: SourcePatchSetValidationContext,
): void {
  const patchIds = new Set<string>();
  for (const patch of set.patches) {
    validateSetPatchAndTrackDuplicates(set, patch, context, patchIds);
  }
  validateSetPatchesPlanCoverage(set, context.expectedPlanIds);
}

function validateSetPatchAndTrackDuplicates(
  set: CodeChangeSourcePatchSet,
  patch: CodeChangeSourcePatch,
  context: SourcePatchSetValidationContext,
  patchIds: Set<string>,
): void {
  const expectedPlan = context.plansById.get(patch.planId);
  assertCodeChangeSourcePatch(patch, expectedPlan);
  validateSetPatchGraphFingerprint(set, patch);
  assertUniqueSetPatchId(patchIds, patch.id);
  patchIds.add(patch.id);
}

function validateSetPatchGraphFingerprint(
  set: CodeChangeSourcePatchSet,
  patch: CodeChangeSourcePatch,
): void {
  if (patch.graphFingerprint !== set.graphFingerprint) {
    throw new Error(`Source patch ${patch.id} graphFingerprint does not match its set`);
  }
}

function assertUniqueSetPatchId(
  patchIds: Set<string>,
  patchId: string,
): void {
  if (patchIds.has(patchId)) throw new Error(`Duplicate source patch id: ${patchId}`);
}

function validateSetPatchesPlanCoverage(
  set: CodeChangeSourcePatchSet,
  expectedPlanIds: string[] | null,
): void {
  if (!expectedPlanIds) return;
  exactSourcePatchSet(set.patches.map((patch) => patch.planId), expectedPlanIds, 'planIds');
}

function validateSourcePatchSetGeneration(set: CodeChangeSourcePatchSet): void {
  assertGroundedGenerationMetadata(set.generation, 'Source patch set generation');
  if (set.generation.generatedAt !== set.generatedAt) {
    throw new Error('Source patch set generation.generatedAt must match generatedAt');
  }
  if (set.generation.generator !== 't2c/code-change-source-patch-set') {
    throw new Error('Source patch set generation.generator must be t2c/code-change-source-patch-set');
  }
}

function exactSourcePatchKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${name} keys must be exactly: ${wanted.join(', ')}`);
  }
}

function assertSourcePatchIds(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0
    || value.some((item) => typeof item !== 'string' || !pattern.test(item))) {
    throw new Error(`Source patch ${name} must be a non-empty array of valid IDs`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

function assertSourcePatchStrings(value: unknown, name: string, emptyAllowed: boolean): asserts value is string[] {
  if (!Array.isArray(value) || (!emptyAllowed && value.length === 0)
    || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`Source patch ${name} must contain ${emptyAllowed ? 'only ' : ''}non-blank strings`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

function exactSourcePatchSet(actual: string[], expected: string[], name: string): void {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (left.length !== right.length || left.some((item, index) => item !== right[index])) {
    throw new Error(`Source patch ${name} do not match the plan`);
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

/**
 * Validate a single-file unified diff body.
 * Accepts optional `--- a/path` / `+++ b/path` headers and rejects foreign paths.
 */
function normalizeUnifiedDiff(diff: string, expectedPath: string): string {
  const normalized = normalizeUnifiedDiffText(diff, expectedPath);
  validateUnifiedDiffBody(normalized, expectedPath);
  validateUnifiedDiffPathHeaders(normalized, expectedPath);
  return normalized;
}

function normalizeUnifiedDiffText(diff: string, expectedPath: string): string {
  const normalized = diff.replace(/\r\n/g, '\n');
  if (!normalized.trim()) throw new Error(`Unified diff for ${expectedPath} is empty`);
  if (normalized.includes('\0')) throw new Error(`Unified diff for ${expectedPath} contains NUL bytes`);
  return normalized;
}

function validateUnifiedDiffBody(diff: string, expectedPath: string): void {
  if (/(?:api[_-]?key|secret|password|private[_-]?key)\s*[:=]\s*['"]?[^'"\s]{8,}/i.test(diff)) {
    throw new Error(`Unified diff for ${expectedPath} appears to contain a secret assignment`);
  }
}

function validateUnifiedDiffPathHeaders(diff: string, expectedPath: string): void {
  for (const header of extractUnifiedDiffHeaders(diff)) {
    validateUnifiedDiffHeaderPath(header, expectedPath);
  }
}

function extractUnifiedDiffHeaders(diff: string): string[] {
  return [...diff.matchAll(/^(?:---|\+\+\+)\s+(?:[ab]\/)?(.+)$/gm)].map((match) => match[1]!.trim());
}

function validateUnifiedDiffHeaderPath(header: string, expectedPath: string): void {
  if (header === '/dev/null') return;
  const normalizedPath = normalizeUnifiedDiffHeaderPath(header);
  assertUnifiedDiffHeaderPathSafety(normalizedPath, expectedPath);
}

function normalizeUnifiedDiffHeaderPath(header: string): string {
  return header.replace(/\\/g, '/').trim();
}

function assertUnifiedDiffHeaderPathSafety(normalizedPath: string, expectedPath: string): void {
  if (isUnifiedDiffTraversalHeader(normalizedPath)) {
    throw new Error(`Unified diff for ${expectedPath} uses a non-repository path header: ${normalizedPath}`);
  }
  if (!matchesUnifiedDiffExpectedHeader(normalizedPath, expectedPath)) {
    const bare = normalizedHeaderPathCandidate(normalizedPath);
    const stripped = stripLeadingDiffPrefix(bare);
    if (stripped !== expectedPath) {
      throw new Error(`Unified diff for ${expectedPath} references foreign path: ${normalizedPath}`);
    }
  }
}

function isUnifiedDiffTraversalHeader(normalizedPath: string): boolean {
  return normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..');
}

function matchesUnifiedDiffExpectedHeader(normalizedPath: string, expectedPath: string): boolean {
  return normalizedPath === expectedPath
    || normalizedPath === `a/${expectedPath}`
    || normalizedPath === `b/${expectedPath}`;
}

function normalizedHeaderPathCandidate(normalizedPath: string): string {
  return normalizedPath.split('\t')[0] ?? normalizedPath;
}

function stripLeadingDiffPrefix(pathValue: string): string {
  return pathValue.replace(/^[ab]\//, '');
}

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
  const patch = assertCodeChangeSourcePatchAndActorAndEdits(options.patch, options.approval);
  assertPatchApprovalActor(options.approval);
  assertPatchApprovalHash(options.patch, options.approval);
  assertPatchEditsContainDiffs(patch);
  return {
    root: options.root,
    patch: options.patch,
    approval: options.approval,
    receiptPath: options.receiptPath,
    now: options.now,
  };
}

function assertCodeChangeSourcePatchAndActorAndEdits(
  patch: CodeChangeSourcePatch,
  approval: CodeChangeSourcePatchApproval,
): CodeChangeSourcePatch {
  assertCodeChangeSourcePatch(patch);
  if (!approval) {
    throw new Error('Source patch approval object is required');
  }
  return patch;
}

function assertPatchApprovalActor(approval: CodeChangeSourcePatchApproval): string {
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
