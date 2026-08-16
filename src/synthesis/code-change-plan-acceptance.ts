import {
  assertCodeChangeAcceptance,
  assertCodeChangePlanForAcceptance,
  assertConclusions,
  assertIntentGraph,
} from '../core/schema.js';
import type { CodeChangeAcceptance, CodeChangeCloseResult } from '../core/types.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { deterministicGeneration, uniqueSorted } from './code-change-plan-helpers.js';
import type { CloseCodeChangesOptions, EvaluateCodeChangeAcceptanceOptions } from './code-change-plan-types.js';

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

/** Evaluate a plan set under one timestamp without applying changes or marking DONE. */
export function closeCodeChanges(options: CloseCodeChangesOptions): CodeChangeCloseResult {
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(evaluatedAt))) throw new Error('evaluatedAt must be an ISO date-time');
  assertIntentGraph(options.before.graph);
  assertIntentGraph(options.afterGraph);
  assertConclusions([], options.before);
  const afterDiagnostics = options.afterDiagnostics ?? diagnoseGraph(options.afterGraph, evaluatedAt);
  assertConclusions([], { graph: options.afterGraph, diagnostics: afterDiagnostics });
  const planIds = options.plans.map((plan) => plan.id);
  if (new Set(planIds).size !== planIds.length) throw new Error('Code change close plans must have unique ids');

  const acceptances = options.plans.map((plan) => evaluateCodeChangeAcceptance({
    plan,
    before: options.before,
    afterGraph: options.afterGraph,
    afterDiagnostics,
    evaluatedAt,
  }));
  const acceptedCount = acceptances.filter((item) => item.accepted).length;
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
