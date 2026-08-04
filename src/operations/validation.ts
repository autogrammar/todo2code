import { shortHash, stableStringify } from '../core/id.js';
import type { JsonValue } from '../core/types.js';
import type { OperationPlan, VariableContract } from './types.js';
import { assertGeneration } from './generation-validation.js';

const VARIABLE_ID = /^VAR-[a-f0-9]{20}$/;
const PLAN_ID = /^OPLAN-[a-f0-9]{20}$/;
const STEP_ID = /^[a-z][a-z0-9-]{1,79}$/;
const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,79}$/;
const PARAMETER_NAME = /^[a-z][a-z0-9_]{0,79}$/;
const URI = /^[a-z][a-z0-9+.-]*:\/\/[^\s*]+$/i;
const PRINCIPAL = /^(?:authority|human|bot|service|machine):[a-z0-9][a-z0-9._-]*$/;
const VALUE_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'string[]', 'object']);
const CLASSIFICATIONS = new Set(['public', 'internal', 'confidential', 'secret']);
const SOURCE_KINDS = new Set(['aql', 'digital_twin', 'vault', 'runtime']);
const RISK_CLASSES = new Set(['read_only', 'reversible', 'boundary', 'governance']);

function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${name} keys must be exactly: ${expected.join(', ')}`);
  }
}

function nonBlank(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-blank string`);
}

function dateString(value: unknown, name: string): void {
  nonBlank(value, name);
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${name} must be an ISO date-time`);
}

function uniqueStrings(value: unknown, name: string, { nonEmpty = false }: { nonEmpty?: boolean } = {}): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${name} must be an array of non-blank strings`);
  }
  if (nonEmpty && value.length === 0) throw new Error(`${name} must not be empty`);
  if (new Set(value).size !== value.length) throw new Error(`${name} must contain unique values`);
  return value;
}

function assertPrincipalList(value: unknown, name: string): string[] {
  const principals = uniqueStrings(value, name, { nonEmpty: true });
  if (principals.some((item) => !PRINCIPAL.test(item))) throw new Error(`${name} contains an invalid principal`);
  return principals;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return Boolean(value && typeof value === 'object' && Object.values(value).every(isJsonValue));
}

export function assertVariableContract(value: unknown): asserts value is VariableContract {
  const contract = objectValue(value, 'Variable contract');
  assertVariableContractShape(contract);
  assertVariableContractCore(contract);
  const source = assertVariableSource(contract);
  const access = assertVariableAccess(contract);
  const readers = access.readers;
  const writers = access.writers;
  assertVariableAuthoritativeness(contract.id, readers, writers);
  assertVariableMutability(contract.id, writers, contract.mutable, contract.freshnessSeconds);
  const expectedId = buildVariableContractId(contract, readers, writers, source);
  if (contract.id !== expectedId) {
    throw new Error(`Variable contract id does not match semantic content: expected ${expectedId}`);
  }
}

function assertVariableContractShape(contract: Record<string, unknown>): void {
  exactKeys(contract, [
    'schemaVersion', 'id', 'name', 'valueType', 'classification', 'source', 'access', 'mutable', 'freshnessSeconds',
  ], 'Variable contract');
}

function assertVariableContractCore(contract: Record<string, unknown>): void {
  if (contract.schemaVersion !== 't2c.variable-contract/v1') throw new Error('Unsupported variable contract schemaVersion');
  if (typeof contract.id !== 'string' || !VARIABLE_ID.test(contract.id)) throw new Error('Variable contract id is invalid');
  if (typeof contract.name !== 'string' || !VARIABLE_NAME.test(contract.name)) throw new Error('Variable contract name is invalid');
  if (!VALUE_TYPES.has(String(contract.valueType))) throw new Error('Variable contract valueType is invalid');
  if (!CLASSIFICATIONS.has(String(contract.classification))) throw new Error('Variable contract classification is invalid');
}

function assertVariableSource(contract: Record<string, unknown>): {
  kind: VariableContract['source']['kind'];
  ref: string;
} {
  const source = objectValue(contract.source, `Variable ${contract.id}: source`);
  exactKeys(source, ['kind', 'ref'], `Variable ${contract.id}: source`);
  if (!SOURCE_KINDS.has(String(source.kind))) throw new Error(`Variable ${contract.id}: source.kind is invalid`);
  nonBlank(source.ref, `Variable ${contract.id}: source.ref`);
  if (String(contract.classification) === 'secret' && source.kind !== 'vault') {
    throw new Error(`Variable ${contract.id}: secret variables must use a vault source`);
  }
  return { kind: source.kind as VariableContract['source']['kind'], ref: source.ref as string };
}

function assertVariableAccess(contract: Record<string, unknown>): {
  readers: string[];
  writers: string[];
} {
  const access = objectValue(contract.access, `Variable ${contract.id}: access`);
  exactKeys(access, ['readers', 'writers'], `Variable ${contract.id}: access`);
  return {
    readers: assertPrincipalList(access.readers, `Variable ${contract.id}: access.readers`),
    writers: assertPrincipalList(access.writers, `Variable ${contract.id}: access.writers`),
  };
}

function assertVariableAuthoritativeness(contractId: string, readers: string[], writers: string[]): void {
  if (!readers.includes('authority:founder') || !writers.includes('authority:founder')) {
    throw new Error(`Variable ${contractId}: authority:founder must be able to read and write every variable`);
  }
}

function assertVariableMutability(
  contractId: string,
  writers: string[],
  mutable: unknown,
  freshnessSeconds: unknown,
): void {
  if (typeof mutable !== 'boolean') throw new Error(`Variable ${contractId}: mutable must be a boolean`);
  if (!mutable && writers.some((item) => item !== 'authority:founder')) {
    throw new Error(`Variable ${contractId}: immutable variables may only be written by authority:founder`);
  }
  if (freshnessSeconds !== null
    && (!Number.isInteger(freshnessSeconds) || (freshnessSeconds as number) < 1)) {
    throw new Error(`Variable ${contractId}: freshnessSeconds must be null or an integer >= 1`);
  }
}

function buildVariableContractId(
  contract: Record<string, unknown>,
  readers: string[],
  writers: string[],
  source: { kind: VariableContract['source']['kind']; ref: string },
): string {
  const semanticValue = {
    name: contract.name as string,
    valueType: contract.valueType as VariableContract['valueType'],
    classification: contract.classification as VariableContract['classification'],
    source,
    access: {
      readers: [...readers].sort(),
      writers: [...writers].sort(),
    },
    mutable: contract.mutable as VariableContract['mutable'],
    freshnessSeconds: contract.freshnessSeconds as VariableContract['freshnessSeconds'],
  };
  const expectedId = `VAR-${shortHash(stableStringify(semanticValue), 20)}`;
  return expectedId;
}

function assertAcyclic(steps: OperationPlan['steps']): void {
  const ids = new Set(steps.map((step) => step.id));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(steps.map((step) => [step.id, step]));
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error('Operation step dependencies must be acyclic');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      if (!ids.has(dependency)) throw new Error(`Operation step ${id} references unknown dependency ${dependency}`);
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

export function assertOperationPlan(value: unknown): asserts value is OperationPlan {
  const plan = objectValue(value, 'Operation plan');
  validateOperationPlanShape(plan);
  validateOperationPlanMetadata(plan);
  validateOperationPlanEvidence(plan.evidence);
  const variables = collectOperationPlanVariables(plan.variables);
  const variableById = new Map(variables.map((item) => [item.id, item]));
  const { steps, stepIds, hasCommandStep, founderDecisionRequired } = validateOperationSteps(plan.steps, variableById);
  validateOperationExpectations(plan.expectations, stepIds);
  validateOperationDecision(plan.decision, founderDecisionRequired);
  validateOperationVerification(plan.verification, hasCommandStep);
  validateOperationPlanHash(plan);
}

function validateOperationPlanShape(plan: Record<string, unknown>): void {
  exactKeys(plan, [
    'schemaVersion', 'id', 'planHash', 'status', 'createdAt', 'contractVersion', 'capabilitySnapshotHash',
    'requestedBy', 'reason', 'evidence', 'generation', 'variables', 'steps', 'expectations', 'decision', 'verification',
  ], 'Operation plan');
}

function validateOperationPlanMetadata(plan: Record<string, unknown>): void {
  if (plan.schemaVersion !== 't2c.operation-plan/v1') throw new Error('Unsupported operation plan schemaVersion');
  if (typeof plan.id !== 'string' || !PLAN_ID.test(plan.id)) throw new Error('Operation plan id is invalid');
  if (typeof plan.planHash !== 'string' || !SHA256.test(plan.planHash)) throw new Error('Operation plan planHash must be SHA-256');
  if (plan.status !== 'proposed') throw new Error('Operation plan status must be proposed');
  dateString(plan.createdAt, 'Operation plan createdAt');
  nonBlank(plan.contractVersion, 'Operation plan contractVersion');
  if (typeof plan.capabilitySnapshotHash !== 'string' || !SHA256.test(plan.capabilitySnapshotHash)) throw new Error('Operation plan capabilitySnapshotHash must be SHA-256');
  nonBlank(plan.requestedBy, 'Operation plan requestedBy');
  nonBlank(plan.reason, 'Operation plan reason');
  assertGeneration(plan.generation);
}

function validateOperationPlanEvidence(value: unknown): void {
  const evidence = objectValue(value, 'Operation plan evidence');
  exactKeys(evidence, ['graphFingerprint', 'recordIds', 'diagnosticIds', 'conclusionIds'], 'Operation plan evidence');
  if (typeof evidence.graphFingerprint !== 'string' || !SHA256.test(evidence.graphFingerprint)) throw new Error('Operation plan evidence.graphFingerprint must be SHA-256');
  uniqueStrings(evidence.recordIds, 'Operation plan evidence.recordIds', { nonEmpty: true });
  uniqueStrings(evidence.diagnosticIds, 'Operation plan evidence.diagnosticIds');
  uniqueStrings(evidence.conclusionIds, 'Operation plan evidence.conclusionIds');
}

function collectOperationPlanVariables(value: unknown): VariableContract[] {
  if (!Array.isArray(value)) throw new Error('Operation plan variables must be an array');
  value.forEach(assertVariableContract);
  const variables = value as VariableContract[];
  if (new Set(variables.map((item) => item.id)).size !== variables.length) throw new Error('Operation plan variable IDs must be unique');
  if (new Set(variables.map((item) => item.name)).size !== variables.length) throw new Error('Operation plan variable names must be unique');
  return variables;
}

function validateOperationSteps(
  value: unknown,
  variableById: Map<string, VariableContract>,
): { steps: OperationPlan['steps']; stepIds: Set<string>; hasCommandStep: boolean; founderDecisionRequired: boolean } {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Operation plan steps must not be empty');
  const stepIds = new Set<string>();
  const steps = value as OperationPlan['steps'];
  const validatedSteps: OperationPlan['steps'] = [];
  let hasCommandStep = false;
  let founderDecisionRequired = false;
  for (const rawStep of steps) {
    const step = validateOperationStep(rawStep, variableById, stepIds);
    validatedSteps.push(step);
    hasCommandStep ||= step.effect === 'command';
    founderDecisionRequired ||= step.effect === 'command' && (step.reversible !== true || ['boundary', 'governance'].includes(step.riskClass));
  }
  assertAcyclic(validatedSteps);
  return { steps: validatedSteps, stepIds, hasCommandStep, founderDecisionRequired };
}

function validateOperationStep(
  value: unknown,
  variableById: Map<string, VariableContract>,
  stepIds: Set<string>,
): OperationPlan['steps'][number] {
  const step = objectValue(value, 'Operation step');
  exactKeys(step, ['id', 'name', 'capability', 'uriProcess', 'actor', 'effect', 'reversible', 'riskClass', 'parameters', 'dependsOn', 'humanApproval', 'rollback'], `Operation step ${String(step.id)}`);
  if (typeof step.id !== 'string' || !STEP_ID.test(step.id) || stepIds.has(step.id)) throw new Error('Operation step id is invalid or duplicate');
  stepIds.add(step.id);
  nonBlank(step.name, `Operation step ${step.id}: name`);
  nonBlank(step.capability, `Operation step ${step.id}: capability`);
  if (typeof step.uriProcess !== 'string' || !URI.test(step.uriProcess)) throw new Error(`Operation step ${step.id}: uriProcess must be concrete and contain no wildcard`);
  if (typeof step.actor !== 'string' || !PRINCIPAL.test(step.actor) || step.actor.startsWith('human:')) throw new Error(`Operation step ${step.id}: actor must be a non-human registered principal`);
  if (!['query', 'command'].includes(String(step.effect))) throw new Error(`Operation step ${step.id}: effect is invalid`);
  if (![true, false, null].includes(step.reversible as boolean | null)) throw new Error(`Operation step ${step.id}: reversible is invalid`);
  if (!RISK_CLASSES.has(String(step.riskClass))) throw new Error(`Operation step ${step.id}: riskClass is invalid`);
  if (typeof step.humanApproval !== 'boolean') throw new Error(`Operation step ${step.id}: humanApproval must be a boolean`);
  const parameters = validateOperationStepParameters(step.parameters, variableById, step.id as string, step.actor as string);
  uniqueStrings(step.dependsOn, `Operation step ${step.id}: dependsOn`);
  const rollback = validateOperationStepRollback(step.rollback, step.id as string);
  if (step.effect === 'query') {
    if (step.riskClass !== 'read_only' || step.reversible !== true || step.humanApproval || rollback !== null) {
      throw new Error(`Operation step ${step.id}: queries must be read_only, reversible, autonomous and have no rollback`);
    }
  } else {
    if (step.riskClass === 'read_only' || rollback === null) {
      throw new Error(`Operation step ${step.id}: commands require a non-read-only risk and rollback declaration`);
    }
    if ((step.reversible !== true || ['boundary', 'governance'].includes(String(step.riskClass))) && !step.humanApproval) {
      throw new Error(`Operation step ${step.id}: safety-sensitive commands require humanApproval`);
    }
  }
  return {
    id: step.id as string,
    name: step.name as string,
    capability: step.capability as string,
    uriProcess: step.uriProcess as string,
    actor: step.actor as string,
    effect: step.effect as OperationPlan['steps'][number]['effect'],
    reversible: step.reversible as boolean | null,
    riskClass: step.riskClass as OperationPlan['steps'][number]['riskClass'],
    parameters,
    dependsOn: step.dependsOn as string[],
    humanApproval: step.humanApproval as boolean,
    rollback,
  };
}

function validateOperationStepParameters(
  value: unknown,
  variableById: Map<string, VariableContract>,
  stepId: string,
  actor: string,
): Record<string, { kind: 'variable'; variableId: string }> {
  const parameters = objectValue(value, `Operation step ${stepId}: parameters`);
  const parsed: Record<string, { kind: 'variable'; variableId: string }> = {};
  for (const [name, rawReference] of Object.entries(parameters)) {
    if (!PARAMETER_NAME.test(name)) throw new Error(`Operation step ${stepId}: parameter name ${name} is invalid`);
    const reference = objectValue(rawReference, `Operation step ${stepId}: parameter ${name}`);
    exactKeys(reference, ['kind', 'variableId'], `Operation step ${stepId}: parameter ${name}`);
    if (reference.kind !== 'variable' || typeof reference.variableId !== 'string' || !variableById.has(reference.variableId)) {
      throw new Error(`Operation step ${stepId}: parameter ${name} must reference a declared variable`);
    }
    const variable = variableById.get(reference.variableId);
    if (variable?.classification === 'secret') {
      throw new Error(`Operation step ${stepId}: secret variable ${reference.variableId} cannot enter a process envelope payload`);
    }
    if (!variable?.access.readers.includes(actor) && actor !== 'authority:founder') {
      throw new Error(`Operation step ${stepId}: actor cannot read variable ${reference.variableId}`);
    }
    parsed[name] = { kind: 'variable', variableId: reference.variableId };
  }
  return parsed;
}

function validateOperationStepRollback(value: unknown, stepId: string): OperationPlan['steps'][number]['rollback'] {
  if (value === null) return null;
  const rollback = objectValue(value, `Operation step ${stepId}: rollback`);
  exactKeys(rollback, ['kind', 'uriProcess', 'reason'], `Operation step ${stepId}: rollback`);
  if (!['uri_process', 'unavailable'].includes(String(rollback.kind))) throw new Error(`Operation step ${stepId}: rollback.kind is invalid`);
  if (rollback.kind === 'uri_process') {
    if (typeof rollback.uriProcess !== 'string' || !URI.test(rollback.uriProcess)) throw new Error(`Operation step ${stepId}: rollback URI is invalid`);
    if (rollback.reason !== null) throw new Error(`Operation step ${stepId}: URI rollback reason must be null`);
  } else {
    if (rollback.uriProcess !== null) throw new Error(`Operation step ${stepId}: unavailable rollback URI must be null`);
    nonBlank(rollback.reason, `Operation step ${stepId}: unavailable rollback reason`);
  }
  return {
    kind: rollback.kind as OperationPlan['steps'][number]['rollback']['kind'],
    uriProcess: rollback.uriProcess as string | null,
    reason: rollback.reason as string | null,
  };
}

function validateOperationExpectations(value: unknown, stepIds: Set<string>): void {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Operation plan expectations must not be empty');
  const coveredSteps = new Set<string>();
  const expectationIds = new Set<string>();
  for (const rawExpectation of value) {
    const expectation = objectValue(rawExpectation, 'Operation expectation');
    exactKeys(expectation, ['id', 'expected', 'verifier', 'verifiedBy'], `Operation expectation ${String(expectation.id)}`);
    if (typeof expectation.id !== 'string' || !STEP_ID.test(expectation.id) || expectationIds.has(expectation.id)) {
      throw new Error('Operation expectation id is invalid or duplicate');
    }
    expectationIds.add(expectation.id);
    if (!isJsonValue(expectation.expected)) throw new Error(`Operation expectation ${expectation.id}: expected must be JSON`);
    nonBlank(expectation.verifier, `Operation expectation ${expectation.id}: verifier`);
    const verifiedBy = uniqueStrings(expectation.verifiedBy, `Operation expectation ${expectation.id}: verifiedBy`, { nonEmpty: true });
    for (const stepId of verifiedBy) {
      if (!stepIds.has(stepId)) throw new Error(`Operation expectation ${expectation.id}: unknown step ${stepId}`);
      coveredSteps.add(stepId);
    }
  }
  const uncovered = [...stepIds].filter((id) => !coveredSteps.has(id));
  if (uncovered.length) throw new Error(`Operation plan has steps without expectations: ${uncovered.join(',')}`);
}

function validateOperationDecision(value: unknown, founderDecisionRequired: boolean): void {
  const decision = objectValue(value, 'Operation plan decision');
  exactKeys(decision, ['required', 'authority', 'reason'], 'Operation plan decision');
  if (typeof decision.required !== 'boolean') throw new Error('Operation plan decision.required must be a boolean');
  if (founderDecisionRequired && (!decision.required || decision.authority !== 'authority:founder')) {
    throw new Error('Safety-sensitive operations require an authority:founder decision');
  }
  if (decision.required) {
    if (decision.authority !== 'authority:founder') throw new Error('Operation decisions must be assigned to authority:founder');
    nonBlank(decision.reason, 'Operation plan decision.reason');
  } else if (decision.authority !== null || decision.reason !== null) {
    throw new Error('Operation plan decision authority and reason must be null when no decision is required');
  }
}

function validateOperationVerification(value: unknown, hasCommandStep: boolean): void {
  const verification = objectValue(value, 'Operation plan verification');
  exactKeys(verification, ['serviceRestartRequired', 'exerciseRequired', 'independentReadback'], 'Operation plan verification');
  for (const field of ['serviceRestartRequired', 'exerciseRequired', 'independentReadback'] as const) {
    if (typeof verification[field] !== 'boolean') throw new Error(`Operation plan verification.${field} must be a boolean`);
  }
  if (hasCommandStep && (!verification.exerciseRequired || !verification.independentReadback)) {
    throw new Error('Command plans require exercise and independent readback verification');
  }
}

function validateOperationPlanHash(plan: Record<string, unknown>): void {
  const castPlan = plan as unknown as OperationPlan;
  const base = { ...castPlan };
  const { id: _id, planHash: _planHash, ...hashValue } = base;
  const expectedHash = shortHash(stableStringify(hashValue), 64);
  if (castPlan.planHash !== expectedHash) {
    throw new Error(`Operation plan hash does not match content: expected ${expectedHash}`);
  }
  if (castPlan.id !== `OPLAN-${expectedHash.slice(0, 20)}`) throw new Error('Operation plan id does not match planHash');
}
