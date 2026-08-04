import { createConclusionId, createTodoProposalId } from '../id.js';
import type {
  Conclusion,
  TodoProposal,
} from '../types.js';
import {
  DIAGNOSTIC_ID,
  CONCLUSION_ID,
  TODO_PROPOSAL_ID,
  TODO_PRIORITIES,
  CONCLUSION_KINDS,
  DIAGNOSTIC_SEVERITIES,
} from './constants.js';
import {
  assertAcyclicProposalDependencies,
  assertGroundedGenerationMetadata,
  confidence,
  enumValue,
  exactKeys,
  nonBlankString,
  nonEmptyUniqueIdArray,
  nonEmptyUniqueStringArray,
  objectValue,
  uniqueIdArray,
  knownReferences,
  stringArray,
} from './utils.js';
import {
  assertIntentGraph,
  assertIntentRecord,
  TodoProposalValidationContext,
  GroundedValidationContext,
} from './intent.js';

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
  nonEmptyUniqueIdArray(conclusion.recordIds, createRecordIdRegex(), `Conclusion ${conclusion.id}: recordIds`);
  knownReferences(conclusion.diagnosticIds, diagnosticIds, `Conclusion ${conclusion.id}: diagnosticIds`);
  knownReferences(conclusion.recordIds, recordIds, `Conclusion ${conclusion.id}: recordIds`);
  confidence(conclusion.confidence, `Conclusion ${conclusion.id}: confidence`);
  assertGroundedGenerationMetadata(conclusion.generation, `Conclusion ${conclusion.id}: generation`);
  const expectedId = createConclusionId(conclusion as unknown as Conclusion);
  if (conclusion.id !== expectedId) throw new Error(`Conclusion id does not match semantic content: expected ${expectedId}`);
}

export function assertTodoProposalValue(
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
  nonEmptyUniqueIdArray(proposal.recordIds, createRecordIdRegex(), `TODO proposal ${proposal.id}: recordIds`);
  knownReferences(proposal.conclusionIds, conclusionIds, `TODO proposal ${proposal.id}: conclusionIds`);
  knownReferences(proposal.diagnosticIds, diagnosticIds, `TODO proposal ${proposal.id}: diagnosticIds`);
  knownReferences(proposal.recordIds, recordIds, `TODO proposal ${proposal.id}: recordIds`);
  confidence(proposal.confidence, `TODO proposal ${proposal.id}: confidence`);
  assertGroundedGenerationMetadata(proposal.generation, `TODO proposal ${proposal.id}: generation`);
  const expectedId = createTodoProposalId(proposal as unknown as TodoProposal);
  if (proposal.id !== expectedId) throw new Error(`TODO proposal id does not match semantic content: expected ${expectedId}`);
}

export function assertTodoProposalReferenceValue(
  value: unknown,
  recordIds: Set<string>,
  diagnosticIds: Set<string>,
  conclusionIds: Set<string>,
): void {
  assertTodoProposalValue(value, recordIds, diagnosticIds, conclusionIds);
}

function createRecordIdRegex(): RegExp {
  return /^INT-[A-Z]+-[a-f0-9]{20}$/;
}

export function validateGroundedContext(context: GroundedValidationContext): {
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

export function validateTodoProposalContext(context: TodoProposalValidationContext): {
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
