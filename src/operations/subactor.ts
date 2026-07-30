import type { JsonValue } from '../core/types.js';
import { assertOperationPlan } from './validation.js';
import type {
  OperationPlan,
  ResolvedVariableBinding,
  SubactorProcessEnvelope,
  VariableContract,
} from './types.js';

export interface CompileSubactorEnvelopeOptions {
  correlationId: string;
  bindings: Record<string, ResolvedVariableBinding>;
}

function valueMatchesType(value: JsonValue, contract: VariableContract): boolean {
  if (contract.valueType === 'string') return typeof value === 'string';
  if (contract.valueType === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (contract.valueType === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (contract.valueType === 'boolean') return typeof value === 'boolean';
  if (contract.valueType === 'string[]') return Array.isArray(value) && value.every((item) => typeof item === 'string');
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function assertBinding(contract: VariableContract, binding: ResolvedVariableBinding, createdAt: string): void {
  if (contract.classification === 'secret') throw new Error(`Secret variable ${contract.id} cannot be compiled into a process envelope`);
  if (binding.sourceRef !== contract.source.ref) throw new Error(`Variable ${contract.id} binding source does not match its contract`);
  if (!valueMatchesType(binding.value, contract)) throw new Error(`Variable ${contract.id} binding has the wrong value type`);
  if (contract.freshnessSeconds !== null) {
    if (binding.observedAt === null || !Number.isFinite(Date.parse(binding.observedAt))) {
      throw new Error(`Variable ${contract.id} requires a timestamped binding`);
    }
    const ageSeconds = (Date.parse(createdAt) - Date.parse(binding.observedAt)) / 1000;
    if (ageSeconds < 0 || ageSeconds > contract.freshnessSeconds) throw new Error(`Variable ${contract.id} binding is stale`);
  }
}

/**
 * Deterministically projects a validated proposal into Subactor's existing
 * Process Envelope. It has no transport, ticket or execution side effects.
 */
export function compileSubactorProcessEnvelope(
  plan: OperationPlan,
  options: CompileSubactorEnvelopeOptions,
): SubactorProcessEnvelope {
  assertOperationPlan(plan);
  if (!options.correlationId.trim()) throw new Error('Subactor correlationId is required');
  const variableById = new Map(plan.variables.map((variable) => [variable.id, variable]));
  const referenced = new Set(Object.values(plan.steps.flatMap((step) => Object.values(step.parameters)))
    .map((reference) => reference.variableId));
  for (const bindingId of Object.keys(options.bindings)) {
    if (!referenced.has(bindingId)) throw new Error(`Binding provided for unreferenced variable ${bindingId}`);
  }
  for (const variableId of referenced) {
    const variable = variableById.get(variableId);
    const binding = options.bindings[variableId];
    if (!variable || !binding) throw new Error(`Binding required for variable ${variableId}`);
    assertBinding(variable, binding, plan.createdAt);
  }

  const requiredCapabilities = [...new Set(plan.steps.map((step) => step.capability))].sort();
  const humanApproval = plan.steps.some((step) => step.humanApproval);
  return {
    schema: 'subactor.process-envelope.v2',
    created_at: plan.createdAt,
    plan_id: plan.id,
    decision_id: plan.decision.required ? `decision:${plan.planHash}` : null,
    correlation_id: options.correlationId,
    reason: plan.reason,
    requested_by: plan.requestedBy,
    process_pack: null,
    idempotency_key: `todo2code:${plan.planHash}`,
    required_capabilities: requiredCapabilities,
    approval_policy: humanApproval ? 'explicit_founder_decision' : 'validated_autonomous_plan',
    definitions: {
      aql: plan.steps.map((step) => {
        const variableIds = [...new Set(Object.values(step.parameters).map((reference) => reference.variableId))].sort();
        return {
          model: `todo2code.operation-plan.${plan.contractVersion}`,
          actor: step.actor,
          allow: [step.capability],
          deny: ['approval.bypass', 'secret.log', 'secret.ticket', 'secret.url', 'ticketless.execute'],
          effect: step.effect,
          reversible: step.reversible,
          risk_class: step.riskClass,
          capability_snapshot_hash: plan.capabilitySnapshotHash,
          variable_read: variableIds,
          variable_write: [],
        };
      }),
      eql: plan.expectations.map((expectation) => ({
        id: expectation.id,
        expected: expectation.expected,
        verifier: expectation.verifier,
        verified_by: expectation.verifiedBy,
      })),
      oql: plan.steps.map((step) => ({
        id: step.id,
        op: step.capability,
        target: step.uriProcess,
        expect: { verified_by: plan.expectations.filter((item) => item.verifiedBy.includes(step.id)).map((item) => item.id) },
      })),
      uri: plan.steps.map((step) => ({
        id: step.id,
        name: step.name,
        uri: step.uriProcess,
        actor: step.actor,
        payload: Object.fromEntries(Object.entries(step.parameters).map(([name, reference]) => {
          const binding = options.bindings[reference.variableId];
          if (!binding) throw new Error(`Binding required for variable ${reference.variableId}`);
          return [name, binding.value];
        })),
        depends_on: step.dependsOn,
        human_approval: step.humanApproval,
        effect: step.effect,
        reversible: step.reversible,
        risk_class: step.riskClass,
        rollback: step.rollback,
        status: 'pending' as const,
      })),
    },
  };
}
