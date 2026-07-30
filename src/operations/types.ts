import type { GroundedGenerationMetadata, JsonValue } from '../core/types.js';

export type VariableValueType = 'string' | 'number' | 'integer' | 'boolean' | 'string[]' | 'object';
export type VariableClassification = 'public' | 'internal' | 'confidential' | 'secret';
export type VariableSourceKind = 'aql' | 'digital_twin' | 'vault' | 'runtime';

export interface VariableContract {
  schemaVersion: 't2c.variable-contract/v1';
  id: string;
  name: string;
  valueType: VariableValueType;
  classification: VariableClassification;
  source: {
    kind: VariableSourceKind;
    ref: string;
  };
  access: {
    readers: string[];
    writers: string[];
  };
  mutable: boolean;
  freshnessSeconds: number | null;
}

export type VariableContractDraft = Omit<VariableContract, 'schemaVersion' | 'id'>;

export type OperationEffect = 'query' | 'command';
export type OperationRiskClass = 'read_only' | 'reversible' | 'boundary' | 'governance';

export interface OperationParameterReference {
  kind: 'variable';
  variableId: string;
}

export interface OperationRollback {
  kind: 'uri_process' | 'unavailable';
  uriProcess: string | null;
  reason: string | null;
}

export interface OperationStep {
  id: string;
  name: string;
  capability: string;
  uriProcess: string;
  actor: string;
  effect: OperationEffect;
  reversible: boolean | null;
  riskClass: OperationRiskClass;
  parameters: Record<string, OperationParameterReference>;
  dependsOn: string[];
  humanApproval: boolean;
  rollback: OperationRollback | null;
}

export interface OperationExpectation {
  id: string;
  expected: JsonValue;
  verifier: string;
  verifiedBy: string[];
}

export interface OperationPlan {
  schemaVersion: 't2c.operation-plan/v1';
  id: string;
  planHash: string;
  status: 'proposed';
  createdAt: string;
  contractVersion: string;
  capabilitySnapshotHash: string;
  requestedBy: string;
  reason: string;
  evidence: {
    graphFingerprint: string;
    recordIds: string[];
    diagnosticIds: string[];
    conclusionIds: string[];
  };
  generation: GroundedGenerationMetadata;
  variables: VariableContract[];
  steps: OperationStep[];
  expectations: OperationExpectation[];
  decision: {
    required: boolean;
    authority: string | null;
    reason: string | null;
  };
  verification: {
    serviceRestartRequired: boolean;
    exerciseRequired: boolean;
    independentReadback: boolean;
  };
}

export type OperationPlanDraft = Omit<OperationPlan, 'schemaVersion' | 'id' | 'planHash' | 'status'>;

export interface ResolvedVariableBinding {
  value: JsonValue;
  sourceRef: string;
  observedAt: string | null;
}

export interface SubactorProcessEnvelope {
  schema: 'subactor.process-envelope.v2';
  created_at: string;
  plan_id: string;
  decision_id: string | null;
  correlation_id: string;
  reason: string;
  requested_by: string;
  process_pack: null;
  idempotency_key: string;
  required_capabilities: string[];
  approval_policy: string;
  definitions: {
    aql: Array<{
      model: string;
      actor: string;
      allow: string[];
      deny: string[];
      effect: OperationEffect;
      reversible: boolean | null;
      risk_class: OperationRiskClass;
      capability_snapshot_hash: string;
      variable_read: string[];
      variable_write: string[];
    }>;
    eql: Array<{
      id: string;
      expected: JsonValue;
      verifier: string;
      verified_by: string[];
    }>;
    oql: Array<{
      id: string;
      op: string;
      target: string;
      expect: { verified_by: string[] };
    }>;
    uri: Array<{
      id: string;
      name: string;
      uri: string;
      actor: string;
      payload: Record<string, JsonValue>;
      depends_on: string[];
      human_approval: boolean;
      effect: OperationEffect;
      reversible: boolean | null;
      risk_class: OperationRiskClass;
      rollback: OperationRollback | null;
      status: 'pending';
    }>;
  };
}
