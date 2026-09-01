export type DeliveryHome = 'wellmanifest' | 'subactor' | 'semcod';
export type DeliveryShape = 'domain_pack' | 'runtime_service' | 'both';
export type DeliveryComplexity = 'XS' | 'S' | 'M' | 'L';
export type DeliveryTestKind = 'docker' | 'governance' | 'node-test' | 'python-test';

export interface DeliveryPlacement {
  home: DeliveryHome;
  shape: DeliveryShape;
  runtime_owner: DeliveryHome;
  adopt: string[];
}

export interface DeliveryWorkstream {
  id: string;
  paths: string[];
}

export interface DeliveryOwnership {
  workstreams: DeliveryWorkstream[];
  integration: {
    workstream: string;
    required_paths: string[];
  };
}

export interface DeliveryBudget {
  complexity: DeliveryComplexity;
  estimated_minutes: number;
  max_implementation_files: number;
  max_affected_components: number;
  max_public_interface_changes: number;
  max_runtime_dependencies: number;
}

export interface DeliveryTestBinding {
  id: string;
  kind: DeliveryTestKind;
  target: string;
}

export interface DeliveryAcceptanceCriterion {
  id: string;
  statement: string;
  test_ids: string[];
}

export interface DeliveryPlanSlice {
  key: string;
  title: string;
  workstream: string;
  depends_on: string[];
  paths: string[];
  components: string[];
  public_interfaces: string[];
  runtime_dependencies: string[];
  delivery: DeliveryBudget;
  acceptance: DeliveryAcceptanceCriterion[];
  tests: DeliveryTestBinding[];
}

export interface AcceptedDeliveryPlan {
  schema: 'wellmanifest.delivery-plan/v1';
  status: 'accepted';
  plan_id: string;
  plan_ref: string;
  repository: string;
  accepted_base_sha: string;
  target_branch: string;
  placement: DeliveryPlacement;
  ownership: DeliveryOwnership;
  slices: DeliveryPlanSlice[];
}

export interface DeliverySliceDecomposition {
  source_slice_key: string;
  slices: DeliveryPlanSlice[];
}

export interface DeliverySliceCompilationRequest {
  schema: 't2c.delivery-slice-request/v1';
  source_nl_hash: string;
  accepted_dsl_hash: string;
  plan: AcceptedDeliveryPlan;
  decompositions: DeliverySliceDecomposition[];
}

export interface ImplementationSliceCandidate {
  schema: 't2c.implementation-slice-candidate/v1';
  plan_id: string;
  plan_ref: string;
  plan_hash: string;
  source_nl_hash: string;
  accepted_dsl_hash: string;
  source_slice_key: string;
  candidate_key: string;
  order: number;
  title: string;
  workstream: string;
  depends_on: string[];
  allowed_paths: string[];
  components: string[];
  public_interfaces: string[];
  runtime_dependencies: string[];
  delivery: DeliveryBudget;
  acceptance: DeliveryAcceptanceCriterion[];
  tests: DeliveryTestBinding[];
  proposal_origin: 'accepted_plan' | 'advisory_decomposition';
  execution: 'inert';
  authority: 'none';
  issue_mutation: 'forbidden';
  tool_dispatch: 'forbidden';
  candidate_digest: string;
  dedupe_key: string;
}

export interface ImplementationSliceSet {
  schema: 't2c.implementation-slice-set/v1';
  status: 'ready';
  execution: 'inert';
  authority: 'none';
  source_nl_hash: string;
  accepted_dsl_hash: string;
  plan_id: string;
  plan_ref: string;
  plan_hash: string;
  repository: string;
  accepted_base_sha: string;
  target_branch: string;
  candidate_count: number;
  candidates: ImplementationSliceCandidate[];
  compilation_hash: string;
}
