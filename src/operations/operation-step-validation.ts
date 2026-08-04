import type { OperationPlan, VariableContract } from './types.js';

const URI = /^[a-z][a-z0-9+.-]*:\/\/[^\s*]+$/i;
const PRINCIPAL = /^(?:authority|human|bot|machine):[a-z0-9][a-z0-9._-]*$/;
const PARAMETER_NAME = /^[a-z][a-z0-9_]{0,79}$/;
const RISK_CLASSES = new Set(['read_only', 'reversible', 'boundary', 'governance']);
const STEP_ID = /^[a-z][a-z0-9-]{1,79}$/;
const STEP_EFFECTS = ['query', 'command'] as const;
const ROLLBACK_KINDS = ['uri_process', 'unavailable'] as const;

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

function uniqueStrings(value: unknown, name: string, { nonEmpty = false }: { nonEmpty?: boolean } = {}): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${name} must be an array of non-blank strings`);
  }
  if (nonEmpty && value.length === 0) throw new Error(`${name} must not be empty`);
  if (new Set(value).size !== value.length) throw new Error(`${name} must contain unique values`);
  return value;
}

function parseOperationStep(value: unknown, stepIds: Set<string>): OperationStepInput {
  const step = objectValue(value, 'Operation step');
  exactKeys(step, ['id', 'name', 'capability', 'uriProcess', 'actor', 'effect', 'reversible', 'riskClass', 'parameters', 'dependsOn', 'humanApproval', 'rollback'], `Operation step ${String(step.id)}`);
  if (typeof step.id !== 'string' || !STEP_ID.test(step.id) || stepIds.has(step.id)) {
    throw new Error('Operation step id is invalid or duplicate');
  }
  stepIds.add(step.id);
  return step as OperationStepInput;
}

function validateStepIdentity(step: OperationStepInput): void {
  nonBlank(step.id, 'Operation step id');
  nonBlank(step.name, `Operation step ${step.id}: name`);
  nonBlank(step.capability, `Operation step ${step.id}: capability`);
  if (typeof step.uriProcess !== 'string' || !URI.test(step.uriProcess)) {
    throw new Error(`Operation step ${step.id}: uriProcess must be concrete and contain no wildcard`);
  }
  if (typeof step.actor !== 'string' || !PRINCIPAL.test(step.actor) || step.actor.startsWith('human:')) {
    throw new Error(`Operation step ${step.id}: actor must be a non-human registered principal`);
  }
  if (typeof step.humanApproval !== 'boolean') {
    throw new Error(`Operation step ${step.id}: humanApproval must be a boolean`);
  }
}

function validateStepRuntime(step: OperationStepInput): void {
  if (!STEP_EFFECTS.includes(step.effect as 'query' | 'command')) {
    throw new Error(`Operation step ${step.id}: effect is invalid`);
  }
  if (![true, false, null].includes(step.reversible as boolean | null)) {
    throw new Error(`Operation step ${step.id}: reversible is invalid`);
  }
  if (!RISK_CLASSES.has(String(step.riskClass))) {
    throw new Error(`Operation step ${step.id}: riskClass is invalid`);
  }
}

function validateOperationStepPolicy(step: OperationStepInput, rollback: OperationPlan['steps'][number]['rollback']): void {
  if (step.effect === 'query') {
    if (step.riskClass !== 'read_only' || step.reversible !== true || step.humanApproval || rollback !== null) {
      throw new Error(`Operation step ${step.id}: queries must be read_only, reversible, autonomous and have no rollback`);
    }
    return;
  }
  if (step.riskClass === 'read_only' || rollback === null) {
    throw new Error(`Operation step ${step.id}: commands require a non-read-only risk and rollback declaration`);
  }
  if ((step.reversible !== true || ['boundary', 'governance'].includes(String(step.riskClass))) && !step.humanApproval) {
    throw new Error(`Operation step ${step.id}: safety-sensitive commands require humanApproval`);
  }
}

type OperationStepInput = {
  id: string;
  name: string;
  capability: string;
  uriProcess: string;
  actor: string;
  effect: string;
  reversible: boolean | null;
  riskClass: string;
  parameters: unknown;
  dependsOn: unknown;
  humanApproval: boolean;
  rollback: unknown;
};

function parseStepParameters(
  value: unknown,
  stepId: string,
  variableById: Map<string, VariableContract>,
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
  if (!ROLLBACK_KINDS.includes(rollback.kind as (typeof ROLLBACK_KINDS)[number])) {
    throw new Error(`Operation step ${stepId}: rollback.kind is invalid`);
  }
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

export function validateOperationStep(
  value: unknown,
  variableById: Map<string, VariableContract>,
  stepIds: Set<string>,
): OperationPlan['steps'][number] {
  const step = parseOperationStep(value, stepIds);
  validateStepIdentity(step);
  validateStepRuntime(step);
  const parameters = parseStepParameters(step.parameters, step.id, variableById, step.actor);
  uniqueStrings(step.dependsOn, `Operation step ${step.id}: dependsOn`);
  const rollback = validateOperationStepRollback(step.rollback, step.id as string);
  validateOperationStepPolicy(step, rollback);
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
