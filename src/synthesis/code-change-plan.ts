import { createCodeChangePlanHash, createCodeChangePlanId, sha256, stableStringify } from '../core/id.js';
import {
  assertCodeChangeAcceptance,
  assertCodeChangePlanForAcceptance,
  assertCodeChangePlans,
  assertConclusions,
  assertIntentGraph,
} from '../core/schema.js';
import type {
  CodeChangeAcceptance,
  CodeChangeFile,
  CodeChangePlan,
  Conclusion,
  Diagnostic,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentRecord,
  IntentTarget,
  TodoPriority,
  TodoProposal,
} from '../core/types.js';
import { normalizeTarget } from '../core/target.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { T2C_VERSION } from '../version.js';

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
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('generatedAt must be an ISO date-time');
  const maxPlans = options.maxPlans ?? 50;
  if (!Number.isInteger(maxPlans) || maxPlans < 1 || maxPlans > 500) {
    throw new Error('maxPlans must be an integer between 1 and 500');
  }
  const conclusions = options.conclusions ?? [];
  const proposals = options.proposals ?? [];
  const recordsById = new Map(options.graph.records.map((record) => [record.id, record]));
  const proposalsByDiagnostic = indexProposalsByDiagnostic(proposals);
  const conclusionsByDiagnostic = indexConclusionsByDiagnostic(conclusions);

  const candidates = options.diagnostics.diagnostics
    .filter((diagnostic) => IMPLEMENTATION_DIAGNOSTIC_CODES.has(diagnostic.code))
    .sort((left, right) => left.id.localeCompare(right.id));

  const plans: CodeChangePlan[] = [];
  for (const diagnostic of candidates) {
    if (plans.length >= maxPlans) break;
    const relatedRecords = diagnostic.recordIds
      .map((id) => recordsById.get(id))
      .filter((record): record is IntentRecord => Boolean(record));
    if (!relatedRecords.length) continue;

    const matchingProposals = proposalsByDiagnostic.get(diagnostic.id) ?? [];
    const matchingConclusions = conclusionsByDiagnostic.get(diagnostic.id) ?? [];
    const target = collectTarget(relatedRecords, matchingProposals);
    const changes = buildChanges(target, relatedRecords, diagnostic);
    if (!changes.length) continue;

    const generation = deterministicGeneration(generatedAt, 't2c/code-change-plan');
    const evidence = {
      graphFingerprint: options.graph.fingerprint,
      recordIds: uniqueSorted(relatedRecords.map((record) => record.id)),
      diagnosticIds: [diagnostic.id],
      conclusionIds: uniqueSorted(matchingConclusions.map((item) => item.id)),
      proposalIds: uniqueSorted(matchingProposals.map((item) => item.id)),
    };
    const semantic = {
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
    const planHash = createCodeChangePlanHash(semantic);
    const plan: CodeChangePlan = {
      schemaVersion: 't2c.code-change-plan/v1',
      id: createCodeChangePlanId(semantic),
      planHash,
      status: 'proposed',
      createdAt: generatedAt,
      ...semantic,
      confidence: confidenceFor(diagnostic, matchingProposals),
      generation,
    };
    plans.push(plan);
  }

  assertCodeChangePlans(plans, {
    graph: options.graph,
    diagnostics: options.diagnostics,
    conclusions,
    proposals,
  });

  return {
    schemaVersion: 't2c.code-change-plan-set/v1',
    plans,
    generatedAt,
    graphFingerprint: options.graph.fingerprint,
    sourceDiagnosticCount: candidates.length,
    generation: deterministicGeneration(generatedAt, 't2c/code-change-plan-set'),
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

  const afterDiagnostics = options.afterDiagnostics ?? diagnoseGraph(
    options.afterGraph,
    options.evaluatedAt ?? new Date().toISOString(),
  );
  assertConclusions([], { graph: options.afterGraph, diagnostics: afterDiagnostics });

  const beforeIds = new Set(options.before.diagnostics.diagnostics.map((item) => item.id));
  const afterById = new Map(afterDiagnostics.diagnostics.map((item) => [item.id, item]));
  const afterIds = [...afterById.keys()].sort();
  const targeted = options.plan.evidence.diagnosticIds;
  const clearedDiagnosticIds = targeted.filter((id) => !afterById.has(id)).sort();
  const remainingDiagnosticIds = targeted.filter((id) => afterById.has(id)).sort();
  const newBlockingDiagnosticIds = afterDiagnostics.diagnostics
    .filter((item) => item.severity === 'blocking' && !beforeIds.has(item.id))
    .map((item) => item.id)
    .sort();

  const reasons: string[] = [];
  if (remainingDiagnosticIds.length) {
    reasons.push(
      `Targeted diagnostics still open: ${remainingDiagnosticIds.join(', ')}.`,
    );
  } else {
    reasons.push('All targeted diagnostics cleared after re-analysis.');
  }
  if (newBlockingDiagnosticIds.length) {
    reasons.push(
      `New blocking diagnostics appeared: ${newBlockingDiagnosticIds.join(', ')}.`,
    );
  } else {
    reasons.push('No new blocking diagnostics appeared.');
  }

  const accepted = remainingDiagnosticIds.length === 0 && newBlockingDiagnosticIds.length === 0;
  if (accepted) {
    reasons.push('Acceptance gate passed; human approval is still required before DONE.');
  } else {
    reasons.push('Acceptance gate failed.');
  }

  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const acceptance: CodeChangeAcceptance = {
    schemaVersion: 't2c.code-change-acceptance/v1',
    planId: options.plan.id,
    planHash: options.plan.planHash,
    beforeGraphFingerprint: options.before.graph.fingerprint,
    afterGraphFingerprint: options.afterGraph.fingerprint,
    beforeDiagnosticIds: [...beforeIds].sort(),
    afterDiagnosticIds: afterIds,
    clearedDiagnosticIds,
    remainingDiagnosticIds,
    newBlockingDiagnosticIds,
    accepted,
    reasons: uniqueSorted(reasons),
    evaluatedAt,
    generation: deterministicGeneration(evaluatedAt, 't2c/code-change-acceptance'),
  };
  assertCodeChangeAcceptance(acceptance, {
    plan: options.plan,
    before: options.before,
    after: { graph: options.afterGraph, diagnostics: afterDiagnostics },
  });
  return acceptance;
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
  const paths = new Set<string>();
  const symbols = new Set<string>();
  const tickets = new Set<string>();
  const versions = new Set<string>();
  for (const record of records) {
    for (const path of record.statement.target.paths) paths.add(path);
    for (const symbol of record.statement.target.symbols) symbols.add(symbol);
    for (const ticket of record.statement.target.tickets) tickets.add(ticket);
    for (const version of record.statement.target.versions) versions.add(version);
  }
  for (const proposal of proposals) {
    for (const path of proposal.target.paths) paths.add(path);
    for (const symbol of proposal.target.symbols) symbols.add(symbol);
    for (const ticket of proposal.target.tickets) tickets.add(ticket);
    for (const version of proposal.target.versions) versions.add(version);
  }
  return normalizeTarget({
    paths: [...paths],
    symbols: [...symbols],
    tickets: [...tickets],
    versions: [...versions],
  });
}

function buildChanges(
  target: IntentTarget,
  records: IntentRecord[],
  diagnostic: Diagnostic,
): CodeChangeFile[] {
  const symbols = uniqueSorted(target.symbols);
  const rationale = diagnostic.suggestedAction?.trim()
    || diagnostic.detail
    || `Address ${diagnostic.code} for ${records.map((record) => record.statement.object).join(', ')}.`;

  if (target.paths.length) {
    return uniqueSorted(target.paths).map((path) => ({
      path: path.replace(/\\/g, '/'),
      action: 'modify' as const,
      symbols,
      rationale,
    }));
  }

  // Without a path the plan cannot safely name a source file. Skip rather than invent.
  return [];
}

function titleFor(diagnostic: Diagnostic, records: IntentRecord[]): string {
  const object = records[0]?.statement.object?.trim();
  if (object) return `Implement ${object}`;
  return diagnostic.title.trim() || `Resolve ${diagnostic.code}`;
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
