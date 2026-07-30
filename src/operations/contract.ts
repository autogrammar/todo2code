import { shortHash, stableStringify } from '../core/id.js';
import type {
  OperationPlan,
  OperationPlanDraft,
  VariableContract,
  VariableContractDraft,
} from './types.js';
import { assertOperationPlan, assertVariableContract } from './validation.js';

export function variableContractSemanticValue(value: VariableContractDraft): VariableContractDraft {
  return {
    name: value.name.trim(),
    valueType: value.valueType,
    classification: value.classification,
    source: { ...value.source, ref: value.source.ref.trim() },
    access: {
      readers: [...new Set(value.access.readers.map((item) => item.trim()))].sort(),
      writers: [...new Set(value.access.writers.map((item) => item.trim()))].sort(),
    },
    mutable: value.mutable,
    freshnessSeconds: value.freshnessSeconds,
  };
}

export function createVariableContract(draft: VariableContractDraft): VariableContract {
  const normalized = variableContractSemanticValue(draft);
  const contract: VariableContract = {
    schemaVersion: 't2c.variable-contract/v1',
    id: `VAR-${shortHash(stableStringify(normalized), 20)}`,
    ...normalized,
  };
  assertVariableContract(contract);
  return contract;
}

function normalizedPlanDraft(draft: OperationPlanDraft): OperationPlanDraft {
  return {
    createdAt: draft.createdAt,
    contractVersion: draft.contractVersion,
    capabilitySnapshotHash: draft.capabilitySnapshotHash,
    requestedBy: draft.requestedBy.trim(),
    reason: draft.reason.trim(),
    evidence: {
      graphFingerprint: draft.evidence.graphFingerprint,
      recordIds: [...new Set(draft.evidence.recordIds)].sort(),
      diagnosticIds: [...new Set(draft.evidence.diagnosticIds)].sort(),
      conclusionIds: [...new Set(draft.evidence.conclusionIds)].sort(),
    },
    generation: draft.generation,
    variables: [...draft.variables].sort((left, right) => left.id.localeCompare(right.id)),
    steps: draft.steps.map((step) => ({
      ...step,
      name: step.name.trim(),
      capability: step.capability.trim(),
      uriProcess: step.uriProcess.trim(),
      actor: step.actor.trim(),
      dependsOn: [...new Set(step.dependsOn)].sort(),
      parameters: Object.fromEntries(Object.entries(step.parameters).sort(([left], [right]) => left.localeCompare(right))),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    expectations: draft.expectations.map((expectation) => ({
      ...expectation,
      verifiedBy: [...new Set(expectation.verifiedBy)].sort(),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    decision: draft.decision,
    verification: draft.verification,
  };
}

export function operationPlanHashMaterial(value: Omit<OperationPlan, 'id' | 'planHash'>): string {
  return stableStringify(value);
}

export function createOperationPlan(draft: OperationPlanDraft): OperationPlan {
  const normalized = normalizedPlanDraft(draft);
  const base: Omit<OperationPlan, 'id' | 'planHash'> = {
    schemaVersion: 't2c.operation-plan/v1',
    status: 'proposed',
    ...normalized,
  };
  const planHash = shortHash(operationPlanHashMaterial(base), 64);
  const plan: OperationPlan = { ...base, id: `OPLAN-${planHash.slice(0, 20)}`, planHash };
  assertOperationPlan(plan);
  return plan;
}
