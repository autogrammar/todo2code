import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  createCodeChangePlanHash,
  createCodeChangePlanId,
} from '../../core/id.js';
import {
  assertCodeChangePlans,
  assertConclusions,
  assertIntentGraph,
} from '../../core/schema.js';
import type {
  CodeChangePlan,
  Diagnostic,
  DiagnosticReport,
  IntentGraph,
  IntentRecord,
  IntentTarget,
  Conclusion,
  TodoProposal,
} from '../../core/types.js';
import {
  collectImplementationDiagnostics,
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
import {
  deterministicGeneration,
  uniqueSorted,
} from './implementation-helpers-shared.js';

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
  generation: ReturnType<typeof deterministicGeneration>;
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

function buildChanges(
  target: IntentTarget,
  records: IntentRecord[],
  diagnostic: Diagnostic,
  pathExistsInRepository?: (relativePath: string) => boolean,
): ReturnType<typeof buildPlanSemantic>['changes'] {
  const symbols = uniqueSorted(target.symbols);
  const sourceIntents = uniqueSorted(records.map((record) => record.statement.text));
  const rationale = sourceIntents.length
    ? `Implement the source intent: ${sourceIntents.join(' | ')}`
    : diagnostic.detail || `Address ${diagnostic.code}.`;

  if (target.paths.length) {
    const changes: ReturnType<typeof buildPlanSemantic>['changes'] = [];
    for (const declared of uniqueSorted(target.paths)) {
      const normalized = declared.replace(/\\/g, '/');
      const exists = pathExistsInRepository?.(normalized);
      if (exists === false && !normalized.includes('/')) continue;
      const action: 'create' | 'modify' | 'delete' = exists === false ? 'create' : 'modify';
      changes.push({ path: normalized, action, symbols, rationale });
    }
    return changes;
  }

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
