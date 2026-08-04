import { createCodeChangePlanId, createCodeChangePlanHash } from '../id.js';
import type {
  CodeChangeAcceptance,
  CodeChangePlan,
} from '../types.js';
import {
  CodeChangePlanValidationContext,
  CodeChangeAcceptanceValidationContext,
  GroundedValidationContext,
} from './intent.js';
import {
  CONCLUSION_ID,
  CODE_CHANGE_ACTIONS,
  CODE_CHANGE_PLAN_ID,
  CODE_CHANGE_RISK_LEVELS,
  DIAGNOSTIC_ID,
  RECORD_ID,
  TODO_PRIORITIES,
  TODO_PROPOSAL_ID,
} from './constants.js';
import {
  assertGroundedGenerationMetadata,
  confidence,
  dateString,
  exactKeys,
  enumValue,
  fingerprint,
  knownReferences,
  nonBlankString,
  nonEmptyUniqueIdArray,
  nonEmptyUniqueStringArray,
  objectValue,
  repositoryPath,
  stringArray,
  uniqueIdArray,
} from './utils.js';
import {
  assertConclusions,
  assertTodoProposals,
  validateGroundedContext,
  assertTodoProposalReferenceValue,
} from './conclusions.js';
import type { GroundedGenerationMetadata } from '../types.js';

export function assertCodeChangePlan(
  value: unknown,
  context: CodeChangePlanValidationContext,
): asserts value is CodeChangePlan {
  const known = validateCodeChangePlanContext(context);
  assertCodeChangePlanValue(value, known);
  assertPlanGraphFingerprint(value, context.graph.fingerprint);
}

export function assertCodeChangePlans(
  values: unknown,
  context: CodeChangePlanValidationContext,
): asserts values is CodeChangePlan[] {
  if (!Array.isArray(values)) throw new Error('Code change plans must be an array');
  const known = validateCodeChangePlanContext(context);
  const ids = new Set<string>();
  for (const value of values) {
    assertCodeChangePlanValue(value, known);
    assertPlanGraphFingerprint(value, context.graph.fingerprint);
    const id = (value as CodeChangePlan).id;
    if (ids.has(id)) throw new Error(`Duplicate code change plan id: ${id}`);
    ids.add(id);
  }
}

/**
 * Validate persisted plans for review when their source graph and diagnostics are
 * not loaded. Evidence references remain syntax-checked and content-bound by each
 * plan hash; the supplied graph fingerprint must match.
 */
export function assertCodeChangePlansForReview(
  values: unknown,
  graphFingerprintValue: string,
): asserts values is CodeChangePlan[] {
  if (!Array.isArray(values)) throw new Error('Code change plans must be an array');
  fingerprint(graphFingerprintValue, 'Code change review graphFingerprint');
  const ids = new Set<string>();
  for (const value of values) {
    const plan = objectValue(value, 'Code change plan');
    const evidence = objectValue(plan.evidence, 'Code change plan evidence');
    uniqueIdArray(evidence.recordIds, RECORD_ID, 'Code change plan evidence.recordIds');
    uniqueIdArray(evidence.diagnosticIds, DIAGNOSTIC_ID, 'Code change plan evidence.diagnosticIds');
    uniqueIdArray(evidence.conclusionIds, CONCLUSION_ID, 'Code change plan evidence.conclusionIds');
    uniqueIdArray(evidence.proposalIds, TODO_PROPOSAL_ID, 'Code change plan evidence.proposalIds');
    assertCodeChangePlanValue(value, {
      recordIds: new Set(evidence.recordIds as string[]),
      diagnosticIds: new Set(evidence.diagnosticIds as string[]),
      conclusionIds: new Set(evidence.conclusionIds as string[]),
      proposalIds: new Set(evidence.proposalIds as string[]),
    });
    assertPlanGraphFingerprint(value, graphFingerprintValue);
    const id = (value as CodeChangePlan).id;
    if (ids.has(id)) throw new Error(`Duplicate code change plan id: ${id}`);
    ids.add(id);
  }
}

/**
 * Validate a persisted plan before acceptance when its full conclusion and TODO
 * proposal objects are no longer present. Their IDs remain syntax-checked and
 * content-bound by the plan hash; records and diagnostics stay grounded in the
 * supplied before graph.
 */
export function assertCodeChangePlanForAcceptance(
  value: unknown,
  context: GroundedValidationContext,
): asserts value is CodeChangePlan {
  const known = validateGroundedContext(context);
  const plan = objectValue(value, 'Code change plan');
  const evidence = objectValue(plan.evidence, 'Code change plan evidence');
  uniqueIdArray(evidence.conclusionIds, CONCLUSION_ID, 'Code change plan evidence.conclusionIds');
  uniqueIdArray(evidence.proposalIds, TODO_PROPOSAL_ID, 'Code change plan evidence.proposalIds');
  assertCodeChangePlanValue(value, {
    ...known,
    conclusionIds: new Set(evidence.conclusionIds as string[]),
    proposalIds: new Set(evidence.proposalIds as string[]),
  });
  assertPlanGraphFingerprint(value, context.graph.fingerprint);
}

export function assertCodeChangeAcceptance(
  value: unknown,
  context: CodeChangeAcceptanceValidationContext,
): asserts value is CodeChangeAcceptance {
  assertCodeChangePlanForAcceptance(context.plan, context.before);
  const beforeKnown = validateGroundedContext(context.before);
  const afterKnown = validateGroundedContext(context.after);
  const acceptance = objectValue(value, 'Code change acceptance');
  exactKeys(acceptance, [
    'schemaVersion', 'planId', 'planHash', 'beforeGraphFingerprint', 'afterGraphFingerprint',
    'beforeDiagnosticIds', 'afterDiagnosticIds', 'clearedDiagnosticIds', 'remainingDiagnosticIds',
    'newBlockingDiagnosticIds', 'accepted', 'reasons', 'evaluatedAt', 'generation',
  ], 'Code change acceptance');
  if (acceptance.schemaVersion !== 't2c.code-change-acceptance/v1') {
    throw new Error('Unsupported code change acceptance schemaVersion');
  }
  if (acceptance.planId !== context.plan.id) throw new Error('Code change acceptance planId does not match its plan');
  if (acceptance.planHash !== context.plan.planHash) throw new Error('Code change acceptance planHash does not match its plan');
  if (acceptance.beforeGraphFingerprint !== context.before.graph.fingerprint) {
    throw new Error('Code change acceptance beforeGraphFingerprint does not match its graph');
  }
  if (acceptance.afterGraphFingerprint !== context.after.graph.fingerprint) {
    throw new Error('Code change acceptance afterGraphFingerprint does not match its graph');
  }
  for (const key of [
    'beforeDiagnosticIds', 'afterDiagnosticIds', 'clearedDiagnosticIds', 'remainingDiagnosticIds',
    'newBlockingDiagnosticIds',
  ] as const) {
    uniqueIdArray(acceptance[key], DIAGNOSTIC_ID, `Code change acceptance ${key}`);
  }
  const beforeIds = [...beforeKnown.diagnosticIds].sort();
  const afterIds = [...afterKnown.diagnosticIds].sort();
  const targeted = [...context.plan.evidence.diagnosticIds].sort();
  const expectedCleared = targeted.filter((id) => !afterKnown.diagnosticIds.has(id));
  const expectedRemaining = targeted.filter((id) => afterKnown.diagnosticIds.has(id));
  const expectedBlocking = context.after.diagnostics.diagnostics
    .filter((item) => item.severity === 'blocking' && !beforeKnown.diagnosticIds.has(item.id))
    .map((item) => item.id)
    .sort();
  assertStringSetMatch(acceptance.beforeDiagnosticIds as string[], beforeIds, 'Code change acceptance beforeDiagnosticIds');
  assertStringSetMatch(acceptance.afterDiagnosticIds as string[], afterIds, 'Code change acceptance afterDiagnosticIds');
  assertStringSetMatch(acceptance.clearedDiagnosticIds as string[], expectedCleared, 'Code change acceptance clearedDiagnosticIds');
  assertStringSetMatch(acceptance.remainingDiagnosticIds as string[], expectedRemaining, 'Code change acceptance remainingDiagnosticIds');
  assertStringSetMatch(acceptance.newBlockingDiagnosticIds as string[], expectedBlocking, 'Code change acceptance newBlockingDiagnosticIds');
  const expectedAccepted = expectedRemaining.length === 0 && expectedBlocking.length === 0;
  if (acceptance.accepted !== expectedAccepted) throw new Error('Code change acceptance accepted flag is inconsistent');
  nonEmptyUniqueStringArray(acceptance.reasons, 'Code change acceptance reasons');
  dateString(acceptance.evaluatedAt, 'Code change acceptance evaluatedAt');
  assertGroundedGenerationMetadata(acceptance.generation, 'Code change acceptance generation');
  if ((acceptance.generation as GroundedGenerationMetadata).generatedAt !== acceptance.evaluatedAt) {
    throw new Error('Code change acceptance generation.generatedAt must match evaluatedAt');
  }
}

function assertPlanGraphFingerprint(plan: CodeChangePlan, graphFingerprintValue: string): void {
  if (plan.evidence.graphFingerprint !== graphFingerprintValue) {
    throw new Error('Code change plan evidence.graphFingerprint does not match its graph');
  }
}

function assertCodeChangePlanValue(
  value: unknown,
  known: {
    recordIds: Set<string>;
    diagnosticIds: Set<string>;
    conclusionIds: Set<string>;
    proposalIds: Set<string>;
  },
): asserts value is CodeChangePlan {
  const plan = objectValue(value, 'Code change plan');
  exactKeys(plan, [
    'schemaVersion', 'id', 'planHash', 'status', 'createdAt', 'title', 'description', 'priority',
    'target', 'acceptanceCriteria', 'changes', 'risk', 'rollback', 'evidence', 'confidence', 'generation',
  ], 'Code change plan');
  if (plan.schemaVersion !== 't2c.code-change-plan/v1') {
    throw new Error('Unsupported code change plan schemaVersion');
  }
  if (typeof plan.id !== 'string' || !CODE_CHANGE_PLAN_ID.test(plan.id)) {
    throw new Error('Code change plan id must match CPLAN-<20 hex>');
  }
  fingerprint(plan.planHash, `Code change plan ${plan.id}: planHash`);
  if (plan.status !== 'proposed') throw new Error(`Code change plan ${plan.id}: status must be proposed`);
  dateString(plan.createdAt, `Code change plan ${plan.id}: createdAt`);
  nonBlankString(plan.title, `Code change plan ${plan.id}: title`);
  nonBlankString(plan.description, `Code change plan ${plan.id}: description`);
  enumValue(plan.priority, TODO_PRIORITIES, `Code change plan ${plan.id}: priority`);
  const target = objectValue(plan.target, `Code change plan ${plan.id}: target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `Code change plan ${plan.id}: target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `Code change plan ${plan.id}: target.${key}`, true);
    if ((target[key] as string[]).some((item) => !item.trim())) {
      throw new Error(`Code change plan ${plan.id}: target.${key} cannot contain blank values`);
    }
  }
  const targetPaths = new Set((target.paths as string[]).map((item, index) => (
    repositoryPath(item, `Code change plan ${plan.id}: target.paths[${index}]`)
  )));
  nonEmptyUniqueStringArray(plan.acceptanceCriteria, `Code change plan ${plan.id}: acceptanceCriteria`);
  if (!Array.isArray(plan.changes) || plan.changes.length === 0) {
    throw new Error(`Code change plan ${plan.id}: changes must be a non-empty array`);
  }
  const changePaths = new Set<string>();
  for (const [index, rawChange] of plan.changes.entries()) {
    const change = objectValue(rawChange, `Code change plan ${plan.id}: changes[${index}]`);
    exactKeys(change, ['path', 'action', 'symbols', 'rationale'], `Code change plan ${plan.id}: changes[${index}]`);
    nonBlankString(change.path, `Code change plan ${plan.id}: changes[${index}].path`);
    const normalizedPath = repositoryPath(change.path, `Code change plan ${plan.id}: changes[${index}].path`);
    if (!targetPaths.has(normalizedPath)) {
      throw new Error(`Code change plan ${plan.id}: changes[${index}].path is not present in target.paths`);
    }
    enumValue(change.action, CODE_CHANGE_ACTIONS, `Code change plan ${plan.id}: changes[${index}].action`);
    stringArray(change.symbols, `Code change plan ${plan.id}: changes[${index}].symbols`, true);
    if ((change.symbols as string[]).some((item) => !item.trim())) {
      throw new Error(`Code change plan ${plan.id}: changes[${index}].symbols cannot contain blank values`);
    }
    nonBlankString(change.rationale, `Code change plan ${plan.id}: changes[${index}].rationale`);
    if (changePaths.has(normalizedPath)) {
      throw new Error(`Code change plan ${plan.id}: duplicate change for ${normalizedPath}`);
    }
    changePaths.add(normalizedPath);
  }
  const risk = objectValue(plan.risk, `Code change plan ${plan.id}: risk`);
  exactKeys(risk, ['level', 'reasons'], `Code change plan ${plan.id}: risk`);
  enumValue(risk.level, CODE_CHANGE_RISK_LEVELS, `Code change plan ${plan.id}: risk.level`);
  nonEmptyUniqueStringArray(risk.reasons, `Code change plan ${plan.id}: risk.reasons`);
  nonBlankString(plan.rollback, `Code change plan ${plan.id}: rollback`);
  const evidence = objectValue(plan.evidence, `Code change plan ${plan.id}: evidence`);
  exactKeys(evidence, [
    'graphFingerprint', 'recordIds', 'diagnosticIds', 'conclusionIds', 'proposalIds',
  ], `Code change plan ${plan.id}: evidence`);
  fingerprint(evidence.graphFingerprint, `Code change plan ${plan.id}: evidence.graphFingerprint`);
  nonEmptyUniqueIdArray(evidence.recordIds, RECORD_ID, `Code change plan ${plan.id}: evidence.recordIds`);
  nonEmptyUniqueIdArray(evidence.diagnosticIds, DIAGNOSTIC_ID, `Code change plan ${plan.id}: evidence.diagnosticIds`);
  uniqueIdArray(evidence.conclusionIds, CONCLUSION_ID, `Code change plan ${plan.id}: evidence.conclusionIds`);
  uniqueIdArray(evidence.proposalIds, TODO_PROPOSAL_ID, `Code change plan ${plan.id}: evidence.proposalIds`);
  knownReferences(evidence.recordIds as string[], known.recordIds, `Code change plan ${plan.id}: evidence.recordIds`);
  knownReferences(evidence.diagnosticIds as string[], known.diagnosticIds, `Code change plan ${plan.id}: evidence.diagnosticIds`);
  knownReferences(evidence.conclusionIds as string[], known.conclusionIds, `Code change plan ${plan.id}: evidence.conclusionIds`);
  knownReferences(evidence.proposalIds as string[], known.proposalIds, `Code change plan ${plan.id}: evidence.proposalIds`);
  confidence(plan.confidence, `Code change plan ${plan.id}: confidence`);
  assertGroundedGenerationMetadata(plan.generation, `Code change plan ${plan.id}: generation`);

  const semantic = plan as unknown as CodeChangePlan;
  const expectedHash = createCodeChangePlanHash(semantic);
  if (plan.planHash !== expectedHash) {
    throw new Error(`Code change plan planHash does not match semantic content: expected ${expectedHash}`);
  }
  const expectedId = createCodeChangePlanId(semantic);
  if (plan.id !== expectedId) {
    throw new Error(`Code change plan id does not match semantic content: expected ${expectedId}`);
  }
}

function validateCodeChangePlanContext(context: CodeChangePlanValidationContext): {
  recordIds: Set<string>;
  diagnosticIds: Set<string>;
  conclusionIds: Set<string>;
  proposalIds: Set<string>;
} {
  const known = validateGroundedContext(context);
  const conclusions = context.conclusions ?? [];
  const proposals = context.proposals ?? [];
  if (conclusions.length) assertConclusions(conclusions, context);
  if (proposals.length && conclusions.length) {
    assertTodoProposals(proposals, { graph: context.graph, diagnostics: context.diagnostics, conclusions });
  } else if (proposals.length) {
    const referencedConclusionIds = new Set<string>();
    for (const [index, value] of proposals.entries()) {
      const proposal = objectValue(value, `TODO proposal reference[${index}]`);
      uniqueIdArray(proposal.conclusionIds, CONCLUSION_ID, `TODO proposal reference[${index}].conclusionIds`);
      for (const id of proposal.conclusionIds as string[]) referencedConclusionIds.add(id);
    }
    const proposalIds = new Set<string>();
    for (const proposal of proposals) {
      assertTodoProposalReferenceValue(
        proposal,
        known.recordIds,
        known.diagnosticIds,
        referencedConclusionIds,
      );
      if (proposalIds.has(proposal.id)) throw new Error(`Duplicate TODO proposal id: ${proposal.id}`);
      proposalIds.add(proposal.id);
    }
  }
  return {
    ...known,
    conclusionIds: new Set(conclusions.map((item) => item.id)),
    proposalIds: new Set(proposals.map((item) => item.id)),
  };
}

function assertStringSetMatch(actual: string[], expected: string[], name: string): void {
  const normalizedActual = [...actual].sort();
  if (normalizedActual.length !== expected.length
    || normalizedActual.some((value, index) => value !== expected[index])) {
    throw new Error(`${name} does not match the grounded diagnostic set`);
  }
}
