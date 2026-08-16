import {
  createConclusionId,
  createTodoProposalId,
} from './id.js';
import type {
  CodeChangeAcceptance,
  CodeChangePlan,
  Conclusion,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  TodoProposal,
} from './types.js';
import {
  CONCLUSION_ID,
  CONCLUSION_KINDS,
  DIAGNOSTIC_ID,
  DIAGNOSTIC_SEVERITIES,
  RECORD_ID,
  TODO_PRIORITIES,
  TODO_PROPOSAL_ID,
  assertAcyclicProposalDependencies,
  confidence,
  dateString,
  enumValue,
  exactKeys,
  exactStringSet,
  fingerprint,
  knownReferences,
  nonBlankString,
  nonEmptyUniqueIdArray,
  nonEmptyUniqueStringArray,
  objectValue,
  stringArray,
  uniqueIdArray,
} from './schema-primitives.js';

import { assertCodeChangePlanValue } from './schema-code-change-plan-value.js';
import { assertGroundedGenerationMetadata } from './schema-generation-validation.js';
import { assertIntentGraph } from './schema-intent-validation.js';
export {
  assertIntentGraph,
  assertIntentGraphDiff,
  assertIntentRecord,
  assertIntentRecords,
} from './schema-intent-validation.js';
export { assertGroundedGenerationMetadata } from './schema-generation-validation.js';


export interface GroundedValidationContext {
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
}

export interface TodoProposalValidationContext extends GroundedValidationContext {
  conclusions: Conclusion[];
}

export interface CodeChangePlanValidationContext extends GroundedValidationContext {
  conclusions?: Conclusion[];
  proposals?: TodoProposal[];
}

export interface CodeChangeAcceptanceValidationContext {
  plan: CodeChangePlan;
  before: GroundedValidationContext;
  after: GroundedValidationContext;
}

export function assertConclusion(
  value: unknown,
  context: GroundedValidationContext,
): asserts value is Conclusion {
  const known = validateGroundedContext(context);
  assertConclusionValue(value, known.recordIds, known.diagnosticIds);
}

export function assertConclusions(
  values: unknown,
  context: GroundedValidationContext,
): asserts values is Conclusion[] {
  if (!Array.isArray(values)) throw new Error('Conclusions must be an array');
  const known = validateGroundedContext(context);
  const ids = new Set<string>();
  for (const value of values) {
    assertConclusionValue(value, known.recordIds, known.diagnosticIds);
    const id = (value as Conclusion).id;
    if (ids.has(id)) throw new Error(`Duplicate conclusion id: ${id}`);
    ids.add(id);
  }
}

export function assertTodoProposal(
  value: unknown,
  context: TodoProposalValidationContext,
): asserts value is TodoProposal {
  const known = validateTodoProposalContext(context);
  assertTodoProposalValue(value, known.recordIds, known.diagnosticIds, known.conclusionIds);
}

export function assertTodoProposals(
  values: unknown,
  context: TodoProposalValidationContext,
): asserts values is TodoProposal[] {
  if (!Array.isArray(values)) throw new Error('TODO proposals must be an array');
  const known = validateTodoProposalContext(context);
  const proposalIds = new Set<string>();
  for (const value of values) {
    assertTodoProposalValue(value, known.recordIds, known.diagnosticIds, known.conclusionIds);
    const id = (value as TodoProposal).id;
    if (proposalIds.has(id)) throw new Error(`Duplicate TODO proposal id: ${id}`);
    proposalIds.add(id);
  }
  for (const proposal of values as TodoProposal[]) {
    for (const dependency of proposal.dependencies) {
      if (!proposalIds.has(dependency)) {
        throw new Error(`TODO proposal ${proposal.id} references unknown dependency ${dependency}`);
      }
    }
  }
  assertAcyclicProposalDependencies(values as TodoProposal[]);
}

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
 * Validate persisted plans for rendering when their source graph and
 * diagnostics are not loaded. Evidence references remain syntax-checked and
 * content-bound by each plan hash; the supplied graph fingerprint must match.
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
 * Validate a persisted plan before acceptance when its full conclusion and
 * TODO-proposal objects are no longer present. Their IDs remain syntax-checked
 * and content-bound by the plan hash; records and diagnostics stay grounded in
 * the supplied before graph.
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

function assertPlanGraphFingerprint(plan: CodeChangePlan, graphFingerprintValue: string): void {
  if (plan.evidence.graphFingerprint !== graphFingerprintValue) {
    throw new Error('Code change plan evidence.graphFingerprint does not match its graph');
  }
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
  exactStringSet(acceptance.beforeDiagnosticIds as string[], beforeIds, 'Code change acceptance beforeDiagnosticIds');
  exactStringSet(acceptance.afterDiagnosticIds as string[], afterIds, 'Code change acceptance afterDiagnosticIds');
  exactStringSet(acceptance.clearedDiagnosticIds as string[], expectedCleared, 'Code change acceptance clearedDiagnosticIds');
  exactStringSet(acceptance.remainingDiagnosticIds as string[], expectedRemaining, 'Code change acceptance remainingDiagnosticIds');
  exactStringSet(acceptance.newBlockingDiagnosticIds as string[], expectedBlocking, 'Code change acceptance newBlockingDiagnosticIds');
  const expectedAccepted = expectedRemaining.length === 0 && expectedBlocking.length === 0;
  if (acceptance.accepted !== expectedAccepted) throw new Error('Code change acceptance accepted flag is inconsistent');
  nonEmptyUniqueStringArray(acceptance.reasons, 'Code change acceptance reasons');
  dateString(acceptance.evaluatedAt, 'Code change acceptance evaluatedAt');
  assertGroundedGenerationMetadata(acceptance.generation, 'Code change acceptance generation');
  if ((acceptance.generation as GroundedGenerationMetadata).generatedAt !== acceptance.evaluatedAt) {
    throw new Error('Code change acceptance generation.generatedAt must match evaluatedAt');
  }
}

function assertConclusionValue(
  value: unknown,
  recordIds: Set<string>,
  diagnosticIds: Set<string>,
): asserts value is Conclusion {
  const conclusion = objectValue(value, 'Conclusion');
  exactKeys(conclusion, [
    'schemaVersion', 'id', 'kind', 'title', 'detail', 'severity', 'diagnosticIds', 'recordIds', 'confidence', 'generation',
  ], 'Conclusion');
  if (conclusion.schemaVersion !== 't2c.conclusion/v1') throw new Error('Unsupported conclusion schemaVersion');
  if (typeof conclusion.id !== 'string' || !CONCLUSION_ID.test(conclusion.id)) {
    throw new Error('Conclusion id must match CONC-<20 hex>');
  }
  enumValue(conclusion.kind, CONCLUSION_KINDS, `Conclusion ${conclusion.id}: kind`);
  nonBlankString(conclusion.title, `Conclusion ${conclusion.id}: title`);
  nonBlankString(conclusion.detail, `Conclusion ${conclusion.id}: detail`);
  enumValue(conclusion.severity, DIAGNOSTIC_SEVERITIES, `Conclusion ${conclusion.id}: severity`);
  nonEmptyUniqueIdArray(conclusion.diagnosticIds, DIAGNOSTIC_ID, `Conclusion ${conclusion.id}: diagnosticIds`);
  nonEmptyUniqueIdArray(conclusion.recordIds, RECORD_ID, `Conclusion ${conclusion.id}: recordIds`);
  knownReferences(conclusion.diagnosticIds as string[], diagnosticIds, `Conclusion ${conclusion.id}: diagnosticIds`);
  knownReferences(conclusion.recordIds as string[], recordIds, `Conclusion ${conclusion.id}: recordIds`);
  confidence(conclusion.confidence, `Conclusion ${conclusion.id}: confidence`);
  assertGroundedGenerationMetadata(conclusion.generation, `Conclusion ${conclusion.id}: generation`);
  const expectedId = createConclusionId(conclusion as unknown as Conclusion);
  if (conclusion.id !== expectedId) throw new Error(`Conclusion id does not match semantic content: expected ${expectedId}`);
}

function assertTodoProposalValue(
  value: unknown,
  recordIds: Set<string>,
  diagnosticIds: Set<string>,
  conclusionIds: Set<string>,
): asserts value is TodoProposal {
  const proposal = objectValue(value, 'TODO proposal');
  exactKeys(proposal, [
    'schemaVersion', 'id', 'title', 'description', 'priority', 'status', 'target', 'acceptanceCriteria',
    'dependencies', 'conclusionIds', 'diagnosticIds', 'recordIds', 'confidence', 'generation',
  ], 'TODO proposal');
  if (proposal.schemaVersion !== 't2c.todo-proposal/v1') throw new Error('Unsupported TODO proposal schemaVersion');
  if (typeof proposal.id !== 'string' || !TODO_PROPOSAL_ID.test(proposal.id)) {
    throw new Error('TODO proposal id must match TPROP-<20 hex>');
  }
  nonBlankString(proposal.title, `TODO proposal ${proposal.id}: title`);
  nonBlankString(proposal.description, `TODO proposal ${proposal.id}: description`);
  enumValue(proposal.priority, TODO_PRIORITIES, `TODO proposal ${proposal.id}: priority`);
  if (proposal.status !== 'proposed') throw new Error(`TODO proposal ${proposal.id}: status must be proposed`);
  const target = objectValue(proposal.target, `TODO proposal ${proposal.id}: target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `TODO proposal ${proposal.id}: target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `TODO proposal ${proposal.id}: target.${key}`, true);
    if ((target[key] as string[]).some((item) => !item.trim())) {
      throw new Error(`TODO proposal ${proposal.id}: target.${key} cannot contain blank values`);
    }
  }
  nonEmptyUniqueStringArray(proposal.acceptanceCriteria, `TODO proposal ${proposal.id}: acceptanceCriteria`);
  uniqueIdArray(proposal.dependencies, TODO_PROPOSAL_ID, `TODO proposal ${proposal.id}: dependencies`);
  if ((proposal.dependencies as string[]).includes(proposal.id as string)) {
    throw new Error(`TODO proposal ${proposal.id} cannot depend on itself`);
  }
  nonEmptyUniqueIdArray(proposal.conclusionIds, CONCLUSION_ID, `TODO proposal ${proposal.id}: conclusionIds`);
  nonEmptyUniqueIdArray(proposal.diagnosticIds, DIAGNOSTIC_ID, `TODO proposal ${proposal.id}: diagnosticIds`);
  nonEmptyUniqueIdArray(proposal.recordIds, RECORD_ID, `TODO proposal ${proposal.id}: recordIds`);
  knownReferences(proposal.conclusionIds as string[], conclusionIds, `TODO proposal ${proposal.id}: conclusionIds`);
  knownReferences(proposal.diagnosticIds as string[], diagnosticIds, `TODO proposal ${proposal.id}: diagnosticIds`);
  knownReferences(proposal.recordIds as string[], recordIds, `TODO proposal ${proposal.id}: recordIds`);
  confidence(proposal.confidence, `TODO proposal ${proposal.id}: confidence`);
  assertGroundedGenerationMetadata(proposal.generation, `TODO proposal ${proposal.id}: generation`);
  const expectedId = createTodoProposalId(proposal as unknown as TodoProposal);
  if (proposal.id !== expectedId) throw new Error(`TODO proposal id does not match semantic content: expected ${expectedId}`);
}

function validateGroundedContext(context: GroundedValidationContext): {
  recordIds: Set<string>;
  diagnosticIds: Set<string>;
} {
  assertIntentGraph(context.graph);
  const report = objectValue(context.diagnostics, 'Diagnostic report');
  if (report.schemaVersion !== 't2c.diagnostics/v1') throw new Error('Unsupported diagnostic schemaVersion');
  if (report.graphFingerprint !== context.graph.fingerprint) {
    throw new Error('Diagnostic report does not describe the supplied graph');
  }
  if (!Array.isArray(report.diagnostics)) throw new Error('Diagnostic report diagnostics must be an array');
  const diagnosticIds = new Set<string>();
  for (const value of report.diagnostics) {
    const diagnostic = objectValue(value, 'Diagnostic');
    if (typeof diagnostic.id !== 'string' || !DIAGNOSTIC_ID.test(diagnostic.id)) {
      throw new Error('Diagnostic id must match DIAG-<20 hex>');
    }
    if (diagnosticIds.has(diagnostic.id)) throw new Error(`Duplicate diagnostic id: ${diagnostic.id}`);
    diagnosticIds.add(diagnostic.id);
  }
  return {
    recordIds: new Set(context.graph.records.map((record) => record.id)),
    diagnosticIds,
  };
}

function validateTodoProposalContext(context: TodoProposalValidationContext): {
  recordIds: Set<string>;
  diagnosticIds: Set<string>;
  conclusionIds: Set<string>;
} {
  const known = validateGroundedContext(context);
  assertConclusions(context.conclusions, context);
  return {
    ...known,
    conclusionIds: new Set(context.conclusions.map((conclusion) => conclusion.id)),
  };
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
  // Full proposal contracts need conclusions. When only proposal IDs are
  // supplied as evidence references, accept the IDs after a light shape check.
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
      assertTodoProposalValue(
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

