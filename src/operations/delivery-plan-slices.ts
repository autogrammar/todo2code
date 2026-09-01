import { createHash } from 'node:crypto';

import type {
  AcceptedDeliveryPlan,
  DeliveryAcceptanceCriterion,
  DeliveryBudget,
  DeliveryOwnership,
  DeliveryPlanSlice,
  DeliveryPlacement,
  DeliverySliceCompilationRequest,
  DeliverySliceDecomposition,
  DeliveryTestBinding,
  ImplementationSliceCandidate,
  ImplementationSliceSet,
} from './delivery-plan-slice-types.js';

const ID = /^[a-z][a-z0-9-]{1,63}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const REFERENCE = /^(?:artifact|knowledge):\/\/[^\s?#]+$/u;
const BRANCH = /^(?!\/)(?!.*(?:\.\.|\/\/|@\{|[~^:?*\[\\]))[A-Za-z0-9._/-]+$/u;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;
const SAFE_PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*(?:\/[*][*])?$/u;
const ADOPTION = /^wellmanifest\/[a-z0-9][a-z0-9-]{1,79}$/u;
const ACCEPTANCE_ID = /^AC-[0-9]{2}$/u;
const HOMES = new Set(['wellmanifest', 'subactor', 'semcod']);
const SHAPES = new Set(['domain_pack', 'runtime_service', 'both']);
const TEST_KINDS = new Set(['docker', 'governance', 'node-test', 'python-test']);
const MAX_SOURCE_SLICES = 12;
const MAX_OUTPUT_SLICES = 64;

const PROFILES = {
  XS: { minutes: 15, files: 2, components: 1, interfaces: 0, dependencies: 0 },
  S: { minutes: 30, files: 5, components: 2, interfaces: 1, dependencies: 1 },
  M: { minutes: 60, files: 9, components: 3, interfaces: 2, dependencies: 2 },
  L: { minutes: 120, files: 15, components: 5, interfaces: 3, dependencies: 3 },
} as const;

type RecordValue = Record<string, unknown>;
type CandidateDraft = {
  source: DeliveryPlanSlice;
  slice: DeliveryPlanSlice;
  dependsOn: string[];
  origin: ImplementationSliceCandidate['proposal_origin'];
};

export class DeliverySliceCompileError extends Error {
  constructor(public readonly code: string, public readonly details: RecordValue = {}) {
    super(code);
    this.name = 'DeliverySliceCompileError';
  }
}

function fail(code: string, details: RecordValue = {}): never {
  throw new DeliverySliceCompileError(code, details);
}

function record(value: unknown, keys: string[], code: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const result = value as RecordValue;
  const actual = Object.keys(result).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, { missing: expected.filter((key) => !actual.includes(key)), unknown: actual.filter((key) => !expected.includes(key)) });
  }
  return result;
}

const text = (value: unknown, code: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  return value;
};

const matchingText = (value: unknown, code: string, pattern: RegExp): string => {
  const result = text(value, code);
  if (!pattern.test(result)) fail(code);
  return result;
};

const strings = (value: unknown, code: string, options: { min?: number; pattern?: RegExp } = {}): string[] => {
  if (!Array.isArray(value) || value.length < (options.min ?? 0)) fail(code);
  const result = value.map((item) => (
    options.pattern ? matchingText(item, code, options.pattern) : text(item, code)
  ));
  if (new Set(result).size !== result.length) fail(code, { duplicate: true });
  return result.sort((left, right) => left.localeCompare(right));
};

const integer = (value: unknown, min: number, max: number, code: string): number => {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(code);
  return value as number;
};

const canonical = (value: unknown): unknown => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== 'object') fail('delivery_slice_non_json_value');
  return Object.fromEntries(Object.entries(value as RecordValue)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonical(item)]));
};

export function stableDeliverySliceStringify(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableDeliverySliceStringify(value)).digest('hex')}`;
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(freeze);
  }
  return value;
}

function covers(pattern: string, path: string): boolean {
  if (!pattern.endsWith('/**')) return pattern === path;
  const base = pattern.slice(0, -3);
  return path === base || path.startsWith(`${base}/`);
}

function coversPattern(owner: string, required: string): boolean {
  if (!owner.endsWith('/**')) return owner === required;
  const ownerBase = owner.slice(0, -3);
  const requiredBase = required.endsWith('/**') ? required.slice(0, -3) : required;
  return requiredBase === ownerBase || requiredBase.startsWith(`${ownerBase}/`);
}

function placement(value: unknown): DeliveryPlacement {
  const item = record(value, ['home', 'shape', 'runtime_owner', 'adopt'], 'delivery_slice_placement_shape');
  const home = text(item.home, 'delivery_slice_home') as DeliveryPlacement['home'];
  const shape = text(item.shape, 'delivery_slice_shape') as DeliveryPlacement['shape'];
  const runtimeOwner = text(item.runtime_owner, 'delivery_slice_runtime_owner') as DeliveryPlacement['runtime_owner'];
  if (!HOMES.has(home) || !HOMES.has(runtimeOwner) || !SHAPES.has(shape)) fail('delivery_slice_placement_value');
  if (shape === 'runtime_service' && (home === 'wellmanifest' || runtimeOwner === 'wellmanifest')) {
    fail('delivery_slice_runtime_home');
  }
  return { home, shape, runtime_owner: runtimeOwner, adopt: strings(item.adopt, 'delivery_slice_adopt', { min: 1, pattern: ADOPTION }) };
}

function ownership(value: unknown): DeliveryOwnership {
  const item = record(value, ['workstreams', 'integration'], 'delivery_slice_ownership_shape');
  if (!Array.isArray(item.workstreams) || item.workstreams.length === 0 || item.workstreams.length > 16) {
    fail('delivery_slice_workstreams');
  }
  const ids = new Set<string>();
  const workstreams = item.workstreams.map((raw) => {
    const workstream = record(raw, ['id', 'paths'], 'delivery_slice_workstream_shape');
    const id = matchingText(workstream.id, 'delivery_slice_workstream_id', ID);
    if (ids.has(id)) fail('delivery_slice_workstream_id', { duplicate: true });
    ids.add(id);
    return { id, paths: strings(workstream.paths, 'delivery_slice_workstream_paths', { min: 1, pattern: SAFE_PATH_PATTERN }) };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const integration = record(item.integration, ['workstream', 'required_paths'], 'delivery_slice_integration_shape');
  const integrationWorkstream = matchingText(integration.workstream, 'delivery_slice_integration_workstream', ID);
  if (!ids.has(integrationWorkstream)) fail('delivery_slice_integration_workstream');
  const requiredPaths = strings(integration.required_paths, 'delivery_slice_integration_paths', { min: 1, pattern: SAFE_PATH_PATTERN });
  const owner = workstreams.find(({ id }) => id === integrationWorkstream);
  if (!owner || requiredPaths.some((required) => !owner.paths.some((path) => coversPattern(path, required)))) {
    fail('delivery_slice_integration_paths_unowned');
  }
  return { workstreams, integration: { workstream: integrationWorkstream, required_paths: requiredPaths } };
}

function budget(value: unknown): DeliveryBudget {
  const item = record(value, [
    'complexity', 'estimated_minutes', 'max_implementation_files', 'max_affected_components',
    'max_public_interface_changes', 'max_runtime_dependencies',
  ], 'delivery_slice_budget_shape');
  const complexity = text(item.complexity, 'delivery_slice_complexity') as DeliveryBudget['complexity'];
  if (!(complexity in PROFILES)) fail('delivery_slice_complexity');
  return {
    complexity,
    estimated_minutes: integer(item.estimated_minutes, 1, 240, 'delivery_slice_budget'),
    max_implementation_files: integer(item.max_implementation_files, 1, 30, 'delivery_slice_budget'),
    max_affected_components: integer(item.max_affected_components, 1, 10, 'delivery_slice_budget'),
    max_public_interface_changes: integer(item.max_public_interface_changes, 0, 10, 'delivery_slice_budget'),
    max_runtime_dependencies: integer(item.max_runtime_dependencies, 0, 10, 'delivery_slice_budget'),
  };
}

function tests(value: unknown): DeliveryTestBinding[] {
  if (!Array.isArray(value) || value.length === 0) fail('delivery_slice_tests');
  const ids = new Set<string>();
  return value.map((raw) => {
    const item = record(raw, ['id', 'kind', 'target'], 'delivery_slice_test_shape');
    const id = matchingText(item.id, 'delivery_slice_test_id', ID);
    const kind = text(item.kind, 'delivery_slice_test_kind') as DeliveryTestBinding['kind'];
    if (ids.has(id) || !TEST_KINDS.has(kind)) fail('delivery_slice_test_value');
    ids.add(id);
    return { id, kind, target: matchingText(item.target, 'delivery_slice_test_target', SAFE_PATH) };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function acceptance(value: unknown, testIds: Set<string>): DeliveryAcceptanceCriterion[] {
  if (!Array.isArray(value) || value.length === 0) fail('delivery_slice_acceptance');
  const ids = new Set<string>();
  return value.map((raw) => {
    const item = record(raw, ['id', 'statement', 'test_ids'], 'delivery_slice_acceptance_shape');
    const id = matchingText(item.id, 'delivery_slice_acceptance_id', ACCEPTANCE_ID);
    if (ids.has(id)) fail('delivery_slice_acceptance_id', { duplicate: true });
    ids.add(id);
    const test_ids = strings(item.test_ids, 'delivery_slice_acceptance_tests', { min: 1, pattern: ID });
    if (test_ids.some((testId) => !testIds.has(testId))) fail('delivery_slice_acceptance_test_unknown', { criterion: id });
    return { id, statement: text(item.statement, 'delivery_slice_acceptance_statement'), test_ids };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function slice(value: unknown, planOwnership: DeliveryOwnership): DeliveryPlanSlice {
  const item = record(value, [
    'key', 'title', 'workstream', 'depends_on', 'paths', 'components', 'public_interfaces',
    'runtime_dependencies', 'delivery', 'acceptance', 'tests',
  ], 'delivery_slice_source_shape');
  const workstream = matchingText(item.workstream, 'delivery_slice_workstream', ID);
  const paths = strings(item.paths, 'delivery_slice_paths', { min: 1, pattern: SAFE_PATH });
  if (!planOwnership.workstreams.some(({ id }) => id === workstream)) fail('delivery_slice_workstream_unknown');
  for (const path of paths) {
    const owners = planOwnership.workstreams.filter((candidate) => candidate.paths.some((pattern) => covers(pattern, path)));
    if (owners.length !== 1) fail('delivery_slice_path_ownership', { path, owner_count: owners.length });
    if (owners[0]?.id !== workstream) fail('delivery_slice_path_owner_mismatch', { path });
    const integrationOwned = planOwnership.integration.required_paths.some((pattern) => covers(pattern, path));
    if (integrationOwned && workstream !== planOwnership.integration.workstream) fail('delivery_slice_integration_owner_required', { path });
  }
  const testBindings = tests(item.tests);
  return {
    key: matchingText(item.key, 'delivery_slice_key', ID),
    title: text(item.title, 'delivery_slice_title'),
    workstream,
    depends_on: strings(item.depends_on, 'delivery_slice_dependencies', { pattern: ID }),
    paths,
    components: strings(item.components, 'delivery_slice_components', { min: 1 }),
    public_interfaces: strings(item.public_interfaces, 'delivery_slice_interfaces'),
    runtime_dependencies: strings(item.runtime_dependencies, 'delivery_slice_runtime_dependencies'),
    delivery: budget(item.delivery),
    acceptance: acceptance(item.acceptance, new Set(testBindings.map(({ id }) => id))),
    tests: testBindings,
  };
}

function topological<T extends { key: string; depends_on: string[] }>(values: T[], code: string): T[] {
  const byKey = new Map(values.map((value) => [value.key, value]));
  if (byKey.size !== values.length) fail(`${code}_duplicate`);
  for (const value of values) {
    if (value.depends_on.includes(value.key) || value.depends_on.some((dependency) => !byKey.has(dependency))) {
      fail(`${code}_unknown`, { key: value.key });
    }
  }
  const pending = new Map(values.map((value) => [value.key, new Set(value.depends_on)]));
  const result: T[] = [];
  while (pending.size > 0) {
    const ready = [...pending.entries()].filter(([, dependencies]) => dependencies.size === 0)
      .map(([key]) => key).sort((left, right) => left.localeCompare(right));
    if (ready.length === 0) fail(`${code}_cycle`, { keys: [...pending.keys()].sort() });
    for (const key of ready) {
      pending.delete(key);
      const value = byKey.get(key);
      if (value) result.push(value);
      for (const dependencies of pending.values()) dependencies.delete(key);
    }
  }
  return result;
}

function plan(value: unknown): AcceptedDeliveryPlan {
  const item = record(value, [
    'schema', 'status', 'plan_id', 'plan_ref', 'repository', 'accepted_base_sha', 'target_branch',
    'placement', 'ownership', 'slices',
  ], 'delivery_slice_plan_shape');
  if (item.schema !== 'wellmanifest.delivery-plan/v1' || item.status !== 'accepted') fail('delivery_slice_plan_identity');
  const planOwnership = ownership(item.ownership);
  if (!Array.isArray(item.slices) || item.slices.length === 0 || item.slices.length > MAX_SOURCE_SLICES) {
    fail('delivery_slice_plan_count');
  }
  const slices = item.slices.map((raw) => slice(raw, planOwnership));
  topological(slices, 'delivery_slice_plan_dependencies');
  return {
    schema: 'wellmanifest.delivery-plan/v1',
    status: 'accepted',
    plan_id: matchingText(item.plan_id, 'delivery_slice_plan_id', ID),
    plan_ref: matchingText(item.plan_ref, 'delivery_slice_plan_ref', REFERENCE),
    repository: matchingText(item.repository, 'delivery_slice_repository', REPOSITORY),
    accepted_base_sha: matchingText(item.accepted_base_sha, 'delivery_slice_base', GIT_SHA),
    target_branch: matchingText(item.target_branch, 'delivery_slice_branch', BRANCH),
    placement: placement(item.placement),
    ownership: planOwnership,
    slices: [...slices].sort((left, right) => left.key.localeCompare(right.key)),
  };
}

export function hashAcceptedDeliveryPlan(value: unknown): string {
  return digest(plan(structuredClone(value)));
}

function boundedReasons(value: DeliveryPlanSlice): string[] {
  const profile = PROFILES[value.delivery.complexity];
  const reasons: string[] = [];
  if (!['XS', 'S'].includes(value.delivery.complexity)) reasons.push('complexity_not_implementation_slice');
  const checks: Array<[number, number, string]> = [
    [value.delivery.estimated_minutes, profile.minutes, 'complexity_time_limit'],
    [value.delivery.max_implementation_files, profile.files, 'complexity_file_limit'],
    [value.delivery.max_affected_components, profile.components, 'complexity_component_limit'],
    [value.delivery.max_public_interface_changes, profile.interfaces, 'complexity_interface_limit'],
    [value.delivery.max_runtime_dependencies, profile.dependencies, 'complexity_dependency_limit'],
    [value.paths.length, value.delivery.max_implementation_files, 'implementation_file_budget'],
    [value.components.length, value.delivery.max_affected_components, 'affected_component_budget'],
    [value.public_interfaces.length, value.delivery.max_public_interface_changes, 'public_interface_budget'],
    [value.runtime_dependencies.length, value.delivery.max_runtime_dependencies, 'runtime_dependency_budget'],
  ];
  for (const [actual, limit, reason] of checks) if (actual > limit) reasons.push(reason);
  return [...new Set(reasons)].sort((left, right) => left.localeCompare(right));
}

function exactPartition<T>(parent: T[], children: T[][], code: string, identity: (value: T) => string = String): void {
  const expected = parent.map(identity).sort();
  const actual = children.flat().map(identity).sort();
  if (new Set(actual).size !== actual.length || JSON.stringify(expected) !== JSON.stringify(actual)) fail(code);
}

function decomposition(value: unknown, source: DeliveryPlanSlice, planOwnership: DeliveryOwnership): DeliverySliceDecomposition {
  const item = record(value, ['source_slice_key', 'slices'], 'delivery_slice_decomposition_shape');
  if (item.source_slice_key !== source.key || !Array.isArray(item.slices) || item.slices.length < 2) {
    fail('delivery_slice_decomposition_identity', { source_slice_key: source.key });
  }
  const children = item.slices.map((raw) => slice(raw, planOwnership));
  if (children.some((child) => child.workstream !== source.workstream)) fail('delivery_slice_decomposition_workstream');
  if (children.some((child) => boundedReasons(child).length > 0)) {
    fail('delivery_slice_decomposition_child_oversized', {
      source_slice_key: source.key,
      children: children.filter((child) => boundedReasons(child).length > 0).map(({ key }) => key).sort(),
    });
  }
  topological(children, 'delivery_slice_decomposition_dependencies');
  exactPartition(source.paths, children.map(({ paths }) => paths), 'delivery_slice_decomposition_paths');
  exactPartition(source.components, children.map(({ components }) => components), 'delivery_slice_decomposition_components');
  exactPartition(source.public_interfaces, children.map(({ public_interfaces }) => public_interfaces), 'delivery_slice_decomposition_interfaces');
  exactPartition(source.runtime_dependencies, children.map(({ runtime_dependencies }) => runtime_dependencies), 'delivery_slice_decomposition_runtime_dependencies');
  exactPartition(source.tests, children.map(({ tests: childTests }) => childTests), 'delivery_slice_decomposition_tests', stableDeliverySliceStringify);
  exactPartition(source.acceptance, children.map(({ acceptance: childAcceptance }) => childAcceptance), 'delivery_slice_decomposition_acceptance', stableDeliverySliceStringify);
  return { source_slice_key: source.key, slices: children.sort((left, right) => left.key.localeCompare(right.key)) };
}

function request(value: unknown): DeliverySliceCompilationRequest {
  const item = record(value, ['schema', 'source_nl_hash', 'accepted_dsl_hash', 'plan', 'decompositions'], 'delivery_slice_request_shape');
  if (item.schema !== 't2c.delivery-slice-request/v1') fail('delivery_slice_request_identity');
  const acceptedPlan = plan(item.plan);
  const acceptedDslHash = matchingText(item.accepted_dsl_hash, 'delivery_slice_accepted_hash', SHA256);
  if (acceptedDslHash !== digest(acceptedPlan)) fail('delivery_slice_accepted_hash_mismatch');
  if (!Array.isArray(item.decompositions)) fail('delivery_slice_decompositions');
  const sourceByKey = new Map(acceptedPlan.slices.map((source) => [source.key, source]));
  const seen = new Set<string>();
  const decompositions = item.decompositions.map((raw) => {
    const rawItem = record(raw, ['source_slice_key', 'slices'], 'delivery_slice_decomposition_shape');
    const sourceKey = matchingText(rawItem.source_slice_key, 'delivery_slice_decomposition_source', ID);
    const source = sourceByKey.get(sourceKey);
    if (!source || seen.has(sourceKey)) fail('delivery_slice_decomposition_source', { source_slice_key: sourceKey });
    seen.add(sourceKey);
    if (boundedReasons(source).length === 0) fail('delivery_slice_decomposition_not_required', { source_slice_key: sourceKey });
    return decomposition(raw, source, acceptedPlan.ownership);
  }).sort((left, right) => left.source_slice_key.localeCompare(right.source_slice_key));
  const missing = acceptedPlan.slices.filter((source) => boundedReasons(source).length > 0 && !seen.has(source.key));
  if (missing.length > 0) {
    fail('delivery_slice_decomposition_required', {
      sources: missing.map((source) => ({ key: source.key, reasons: boundedReasons(source) })),
    });
  }
  const sourceKeys = new Set(acceptedPlan.slices.map(({ key }) => key));
  const childKeys = decompositions.flatMap(({ slices: children }) => children.map(({ key }) => key));
  if (new Set(childKeys).size !== childKeys.length || childKeys.some((key) => sourceKeys.has(key))) {
    fail('delivery_slice_candidate_key_collision');
  }
  return {
    schema: 't2c.delivery-slice-request/v1',
    source_nl_hash: matchingText(item.source_nl_hash, 'delivery_slice_source_hash', SHA256),
    accepted_dsl_hash: acceptedDslHash,
    plan: acceptedPlan,
    decompositions,
  };
}

function expand(accepted: DeliverySliceCompilationRequest): CandidateDraft[] {
  const decompositions = new Map(accepted.decompositions.map((item) => [item.source_slice_key, item]));
  const resolved = new Map<string, { roots: string[]; leaves: string[] }>();
  const drafts: CandidateDraft[] = [];
  for (const source of topological(accepted.plan.slices, 'delivery_slice_plan_dependencies')) {
    const inherited = source.depends_on.flatMap((dependency) => resolved.get(dependency)?.leaves ?? []);
    const split = decompositions.get(source.key);
    if (!split) {
      drafts.push({ source, slice: source, dependsOn: [...new Set(inherited)].sort(), origin: 'accepted_plan' });
      resolved.set(source.key, { roots: [source.key], leaves: [source.key] });
      continue;
    }
    const dependedOn = new Set(split.slices.flatMap(({ depends_on }) => depends_on));
    const roots = split.slices.filter(({ depends_on }) => depends_on.length === 0).map(({ key }) => key).sort();
    const leaves = split.slices.filter(({ key }) => !dependedOn.has(key)).map(({ key }) => key).sort();
    for (const child of split.slices) {
      drafts.push({
        source,
        slice: child,
        dependsOn: child.depends_on.length > 0 ? child.depends_on : [...new Set(inherited)].sort(),
        origin: 'advisory_decomposition',
      });
    }
    resolved.set(source.key, { roots, leaves });
  }
  if (drafts.length > MAX_OUTPUT_SLICES) fail('delivery_slice_candidate_count');
  return drafts;
}

function assertDisjointPaths(drafts: CandidateDraft[]): void {
  const owners = new Map<string, string>();
  for (const draft of drafts) {
    for (const path of draft.slice.paths) {
      const previous = owners.get(path);
      if (previous) fail('delivery_slice_candidate_path_overlap', { path, candidates: [previous, draft.slice.key].sort() });
      owners.set(path, draft.slice.key);
    }
  }
}

function orderDrafts(drafts: CandidateDraft[]): CandidateDraft[] {
  const sortable = drafts.map((draft) => ({ key: draft.slice.key, depends_on: draft.dependsOn, draft }));
  return topological(sortable, 'delivery_slice_candidate_dependencies').map(({ draft }) => draft);
}

export function compileDeliveryPlanSlices(value: unknown): ImplementationSliceSet {
  const accepted = request(structuredClone(value));
  const planHash = digest(accepted.plan);
  const drafts = expand(accepted);
  assertDisjointPaths(drafts);
  const ordered = orderDrafts(drafts);
  const candidates: ImplementationSliceCandidate[] = ordered.map((draft, order) => {
    const core = {
      schema: 't2c.implementation-slice-candidate/v1' as const,
      plan_id: accepted.plan.plan_id,
      plan_ref: accepted.plan.plan_ref,
      plan_hash: planHash,
      source_nl_hash: accepted.source_nl_hash,
      accepted_dsl_hash: accepted.accepted_dsl_hash,
      source_slice_key: draft.source.key,
      candidate_key: draft.slice.key,
      order,
      title: draft.slice.title,
      workstream: draft.slice.workstream,
      depends_on: draft.dependsOn,
      allowed_paths: draft.slice.paths,
      components: draft.slice.components,
      public_interfaces: draft.slice.public_interfaces,
      runtime_dependencies: draft.slice.runtime_dependencies,
      delivery: draft.slice.delivery,
      acceptance: draft.slice.acceptance,
      tests: draft.slice.tests,
      proposal_origin: draft.origin,
      execution: 'inert' as const,
      authority: 'none' as const,
      issue_mutation: 'forbidden' as const,
      tool_dispatch: 'forbidden' as const,
    };
    const candidateDigest = digest(core);
    return {
      ...core,
      candidate_digest: candidateDigest,
      dedupe_key: digest({ accepted_dsl_hash: accepted.accepted_dsl_hash, candidate_key: draft.slice.key, candidate_digest: candidateDigest }),
    };
  });
  const base = {
    schema: 't2c.implementation-slice-set/v1' as const,
    status: 'ready' as const,
    execution: 'inert' as const,
    authority: 'none' as const,
    source_nl_hash: accepted.source_nl_hash,
    accepted_dsl_hash: accepted.accepted_dsl_hash,
    plan_id: accepted.plan.plan_id,
    plan_ref: accepted.plan.plan_ref,
    plan_hash: planHash,
    repository: accepted.plan.repository,
    accepted_base_sha: accepted.plan.accepted_base_sha,
    target_branch: accepted.plan.target_branch,
    candidate_count: candidates.length,
    candidates,
  };
  return freeze({ ...base, compilation_hash: digest(base) });
}
