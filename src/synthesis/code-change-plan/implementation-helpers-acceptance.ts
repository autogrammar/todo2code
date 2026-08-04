import { assertCodeChangeAcceptance, assertConclusions, assertCodeChangePlanForAcceptance, assertIntentGraph } from '../../core/schema.js';
import type {
  CodeChangeAcceptance,
  CodeChangePlan,
  Diagnostic,
  DiagnosticReport,
  IntentGraph,
} from '../../core/types.js';
import { diagnoseGraph } from '../../graph/diagnostics.js';
import {
  deterministicGeneration,
  uniqueSorted,
} from './implementation-helpers-shared.js';

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
