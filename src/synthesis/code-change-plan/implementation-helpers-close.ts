import { assertCodeChangePlansForReview } from '../../core/schema.js';
import { diagnoseGraph } from '../../graph/diagnostics.js';
import type {
  CodeChangeCloseResult,
  CodeChangePlan,
  DiagnosticReport,
  IntentGraph,
} from '../../core/types.js';
import {
  evaluateCodeChangeAcceptance,
} from './implementation-helpers-acceptance.js';
import { deterministicGeneration } from './implementation-helpers-shared.js';

export interface CloseCodeChangesOptions {
  plans: CodeChangePlan[];
  before: { graph: IntentGraph; diagnostics: DiagnosticReport };
  afterGraph: IntentGraph;
  afterDiagnostics?: DiagnosticReport;
  evaluatedAt?: string;
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
  assertCodeChangePlansForReview(options.plans, options.afterGraph.fingerprint);
  const afterDiagnostics = options.afterDiagnostics ?? diagnoseGraph(options.afterGraph, evaluatedAt);
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
  acceptances: ReturnType<typeof evaluateCodeChangeAcceptance>[],
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
