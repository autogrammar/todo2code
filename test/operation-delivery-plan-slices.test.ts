import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DeliverySliceCompileError,
  compileDeliveryPlanSlices,
  hashAcceptedDeliveryPlan,
} from '../src/operations/delivery-plan-slices.js';
import type {
  AcceptedDeliveryPlan,
  DeliveryPlanSlice,
  DeliverySliceCompilationRequest,
} from '../src/operations/delivery-plan-slice-types.js';

const SOURCE_HASH = `sha256:${'1'.repeat(64)}`;
const BASE_SHA = 'a'.repeat(40);

function boundedSlice(overrides: Partial<DeliveryPlanSlice> = {}): DeliveryPlanSlice {
  return {
    key: 'runtime-contract',
    title: 'Implement the bounded runtime contract',
    workstream: 'runtime',
    depends_on: [],
    paths: ['src/operations/runtime-contract.ts'],
    components: ['runtime-contract'],
    public_interfaces: [],
    runtime_dependencies: [],
    delivery: {
      complexity: 'XS',
      estimated_minutes: 10,
      max_implementation_files: 1,
      max_affected_components: 1,
      max_public_interface_changes: 0,
      max_runtime_dependencies: 0,
    },
    acceptance: [{
      id: 'AC-01',
      statement: 'The bounded runtime contract is deterministic.',
      test_ids: ['runtime-test'],
    }],
    tests: [{ id: 'runtime-test', kind: 'node-test', target: 'test/operation-runtime-contract.test.ts' }],
    ...overrides,
  };
}

function acceptedPlan(): AcceptedDeliveryPlan {
  return {
    schema: 'wellmanifest.delivery-plan/v1',
    status: 'accepted',
    plan_id: 'bounded-delivery',
    plan_ref: 'artifact://subactor/strategy/delivery-plan-r1',
    repository: 'autogrammar/todo2code',
    accepted_base_sha: BASE_SHA,
    target_branch: 'main',
    placement: {
      home: 'subactor',
      shape: 'runtime_service',
      runtime_owner: 'subactor',
      adopt: ['wellmanifest/new-project', 'wellmanifest/dsl', 'wellmanifest/logs'],
    },
    ownership: {
      workstreams: [
        { id: 'integration', paths: ['package.json', 'docs/**'] },
        { id: 'runtime', paths: ['src/**', 'test/**'] },
      ],
      integration: { workstream: 'integration', required_paths: ['package.json', 'docs/**'] },
    },
    slices: [
      boundedSlice(),
      boundedSlice({
        key: 'large-feature',
        title: 'Implement the feature currently too large for one ticket',
        depends_on: ['runtime-contract'],
        paths: ['src/services/feature-a.ts', 'src/services/feature-b.ts', 'src/services/feature-c.ts'],
        components: ['feature-core', 'feature-validation'],
        delivery: {
          complexity: 'M',
          estimated_minutes: 45,
          max_implementation_files: 3,
          max_affected_components: 2,
          max_public_interface_changes: 0,
          max_runtime_dependencies: 0,
        },
        acceptance: [
          { id: 'AC-02', statement: 'Feature core works independently.', test_ids: ['feature-core-test'] },
          { id: 'AC-03', statement: 'Feature validation rejects unsafe input.', test_ids: ['feature-validation-test'] },
        ],
        tests: [
          { id: 'feature-core-test', kind: 'node-test', target: 'test/operation-feature-core.test.ts' },
          { id: 'feature-validation-test', kind: 'node-test', target: 'test/operation-feature-validation.test.ts' },
        ],
      }),
      boundedSlice({
        key: 'package-contract',
        title: 'Publish the integration-owned package contract',
        workstream: 'integration',
        depends_on: ['large-feature'],
        paths: ['package.json'],
        components: ['package-contract'],
        acceptance: [{ id: 'AC-04', statement: 'Package contract exposes the accepted result.', test_ids: ['package-test'] }],
        tests: [{ id: 'package-test', kind: 'governance', target: 'package.json' }],
      }),
    ],
  };
}

function decomposition(): DeliverySliceCompilationRequest['decompositions'][number] {
  return {
    source_slice_key: 'large-feature',
    slices: [
      boundedSlice({
        key: 'feature-core-slice',
        title: 'Ship the independently working feature core',
        paths: ['src/services/feature-a.ts', 'src/services/feature-b.ts'],
        components: ['feature-core'],
        delivery: {
          complexity: 'XS', estimated_minutes: 15, max_implementation_files: 2,
          max_affected_components: 1, max_public_interface_changes: 0, max_runtime_dependencies: 0,
        },
        acceptance: [{ id: 'AC-02', statement: 'Feature core works independently.', test_ids: ['feature-core-test'] }],
        tests: [{ id: 'feature-core-test', kind: 'node-test', target: 'test/operation-feature-core.test.ts' }],
      }),
      boundedSlice({
        key: 'feature-validation-slice',
        title: 'Ship fail-closed feature validation',
        depends_on: ['feature-core-slice'],
        paths: ['src/services/feature-c.ts'],
        components: ['feature-validation'],
        acceptance: [{ id: 'AC-03', statement: 'Feature validation rejects unsafe input.', test_ids: ['feature-validation-test'] }],
        tests: [{ id: 'feature-validation-test', kind: 'node-test', target: 'test/operation-feature-validation.test.ts' }],
      }),
    ],
  };
}

function compilationRequest(plan = acceptedPlan()): DeliverySliceCompilationRequest {
  return {
    schema: 't2c.delivery-slice-request/v1',
    source_nl_hash: SOURCE_HASH,
    accepted_dsl_hash: hashAcceptedDeliveryPlan(plan),
    plan,
    decompositions: [decomposition()],
  };
}

function expectCode(callback: () => unknown, code: string): DeliverySliceCompileError {
  assert.throws(callback, (error) => error instanceof DeliverySliceCompileError && error.code === code);
  try {
    callback();
  } catch (error) {
    return error as DeliverySliceCompileError;
  }
  throw new Error('Expected callback to throw');
}

test('compiles accepted and advisory source slices into one bounded inert dependency DAG', () => {
  const result = compileDeliveryPlanSlices(compilationRequest());
  assert.equal(result.status, 'ready');
  assert.equal(result.execution, 'inert');
  assert.equal(result.authority, 'none');
  assert.equal(result.source_nl_hash, SOURCE_HASH);
  assert.equal(result.accepted_dsl_hash, result.plan_hash);
  assert.deepEqual(result.candidates.map(({ candidate_key }) => candidate_key), [
    'runtime-contract',
    'feature-core-slice',
    'feature-validation-slice',
    'package-contract',
  ]);
  assert.deepEqual(result.candidates[1]?.depends_on, ['runtime-contract']);
  assert.deepEqual(result.candidates[2]?.depends_on, ['feature-core-slice']);
  assert.deepEqual(result.candidates[3]?.depends_on, ['feature-validation-slice']);
  assert.equal(result.candidates[1]?.proposal_origin, 'advisory_decomposition');
  assert.equal(result.candidates[3]?.workstream, 'integration');
  assert.ok(result.candidates.every((candidate) => (
    candidate.delivery.complexity === 'XS' || candidate.delivery.complexity === 'S'
  )));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.candidates[0]?.allowed_paths));
});

test('canonicalizes set order into stable plan, candidate, dedupe and compilation hashes', () => {
  const first = compileDeliveryPlanSlices(compilationRequest());
  const reorderedPlan = acceptedPlan();
  reorderedPlan.slices.reverse();
  reorderedPlan.ownership.workstreams.reverse();
  reorderedPlan.placement.adopt.reverse();
  const reordered = compilationRequest(reorderedPlan);
  reordered.decompositions[0]?.slices.reverse();
  const second = compileDeliveryPlanSlices(reordered);
  assert.equal(second.plan_hash, first.plan_hash);
  assert.equal(second.compilation_hash, first.compilation_hash);
  assert.deepEqual(second.candidates.map(({ candidate_digest }) => candidate_digest), first.candidates.map(({ candidate_digest }) => candidate_digest));
  assert.deepEqual(second.candidates.map(({ dedupe_key }) => dedupe_key), first.candidates.map(({ dedupe_key }) => dedupe_key));
});

test('requires exact accepted DSL and source NL hash provenance', () => {
  const stale = compilationRequest();
  stale.accepted_dsl_hash = `sha256:${'2'.repeat(64)}`;
  expectCode(() => compileDeliveryPlanSlices(stale), 'delivery_slice_accepted_hash_mismatch');

  const malformed = compilationRequest();
  malformed.source_nl_hash = 'raw natural language' as `sha256:${string}`;
  expectCode(() => compileDeliveryPlanSlices(malformed), 'delivery_slice_source_hash');
});

test('flags an oversized source with reasons until an explicit decomposition exists', () => {
  const input = compilationRequest();
  input.decompositions = [];
  const error = expectCode(() => compileDeliveryPlanSlices(input), 'delivery_slice_decomposition_required');
  assert.deepEqual(error.details.sources, [{
    key: 'large-feature',
    reasons: ['complexity_not_implementation_slice'],
  }]);
});

test('rejects widened, omitted, duplicated and still-oversized child slices', () => {
  const widened = compilationRequest();
  const widenedChild = widened.decompositions[0]?.slices[0];
  assert.ok(widenedChild);
  widenedChild.paths[1] = 'src/services/not-accepted.ts';
  expectCode(() => compileDeliveryPlanSlices(widened), 'delivery_slice_decomposition_paths');

  const duplicated = compilationRequest();
  const duplicatedChild = duplicated.decompositions[0]?.slices[1];
  assert.ok(duplicatedChild);
  duplicatedChild.paths[0] = 'src/services/feature-a.ts';
  expectCode(() => compileDeliveryPlanSlices(duplicated), 'delivery_slice_decomposition_paths');

  const oversized = compilationRequest();
  const child = oversized.decompositions[0]?.slices[0];
  assert.ok(child);
  child.delivery.estimated_minutes = 16;
  expectCode(() => compileDeliveryPlanSlices(oversized), 'delivery_slice_decomposition_child_oversized');
});

test('requires exact acceptance, test, component, interface and dependency coverage', () => {
  const missingCriterion = compilationRequest();
  const child = missingCriterion.decompositions[0]?.slices[1];
  assert.ok(child);
  child.acceptance = [{ id: 'AC-03', statement: 'Changed advisory meaning.', test_ids: ['feature-validation-test'] }];
  expectCode(() => compileDeliveryPlanSlices(missingCriterion), 'delivery_slice_decomposition_acceptance');

  const duplicateComponent = compilationRequest();
  const duplicateComponentChild = duplicateComponent.decompositions[0]?.slices[1];
  assert.ok(duplicateComponentChild);
  duplicateComponentChild.components[0] = 'feature-core';
  expectCode(() => compileDeliveryPlanSlices(duplicateComponent), 'delivery_slice_decomposition_components');

  const unknownDependency = compilationRequest();
  const dependent = unknownDependency.decompositions[0]?.slices[1];
  assert.ok(dependent);
  dependent.depends_on = ['runtime-contract'];
  expectCode(() => compileDeliveryPlanSlices(unknownDependency), 'delivery_slice_decomposition_dependencies_unknown');
});

test('flags source and advisory dependency cycles', () => {
  const sourceCyclePlan = acceptedPlan();
  const first = sourceCyclePlan.slices.find(({ key }) => key === 'runtime-contract');
  assert.ok(first);
  first.depends_on = ['package-contract'];
  expectCode(() => hashAcceptedDeliveryPlan(sourceCyclePlan), 'delivery_slice_plan_dependencies_cycle');

  const childCycle = compilationRequest();
  const firstChild = childCycle.decompositions[0]?.slices[0];
  assert.ok(firstChild);
  firstChild.depends_on = ['feature-validation-slice'];
  expectCode(() => compileDeliveryPlanSlices(childCycle), 'delivery_slice_decomposition_dependencies_cycle');
});

test('separates integration ownership and rejects ambiguous or mismatched path owners', () => {
  const wrongIntegrationOwner = acceptedPlan();
  const integration = wrongIntegrationOwner.slices.find(({ key }) => key === 'package-contract');
  assert.ok(integration);
  integration.workstream = 'runtime';
  expectCode(() => hashAcceptedDeliveryPlan(wrongIntegrationOwner), 'delivery_slice_path_owner_mismatch');

  const ambiguous = acceptedPlan();
  ambiguous.ownership.workstreams.find(({ id }) => id === 'runtime')?.paths.push('package.json');
  expectCode(() => hashAcceptedDeliveryPlan(ambiguous), 'delivery_slice_path_ownership');
});

test('requires globally disjoint candidate paths even when source tasks are serialized', () => {
  const input = compilationRequest();
  input.plan.slices.push(boundedSlice({
    key: 'later-overlap',
    title: 'A later writer to the same accepted path',
    depends_on: ['runtime-contract'],
  }));
  input.accepted_dsl_hash = hashAcceptedDeliveryPlan(input.plan);
  expectCode(() => compileDeliveryPlanSlices(input), 'delivery_slice_candidate_path_overlap');
});

test('keeps LLM advice authority-free and rejects command, grant and lifecycle injection', () => {
  const command = compilationRequest() as DeliverySliceCompilationRequest & { execute: string };
  command.execute = 'create issues';
  expectCode(() => compileDeliveryPlanSlices(command), 'delivery_slice_request_shape');

  const testCommand = compilationRequest();
  const binding = testCommand.decompositions[0]?.slices[0]?.tests[0] as DeliveryPlanSlice['tests'][number] & { command: string };
  binding.command = 'run arbitrary shell';
  expectCode(() => compileDeliveryPlanSlices(testCommand), 'delivery_slice_test_shape');

  const grant = compilationRequest();
  const child = grant.decompositions[0]?.slices[0] as DeliveryPlanSlice & { grant: string };
  child.grant = 'llm:execute';
  expectCode(() => compileDeliveryPlanSlices(grant), 'delivery_slice_source_shape');

  const output = compileDeliveryPlanSlices(compilationRequest());
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes('command'), false);
  assert.equal(serialized.includes('credential'), false);
  assert.equal(serialized.includes('llm:execute'), false);
  assert.ok(output.candidates.every((candidate) => (
    candidate.authority === 'none'
    && candidate.execution === 'inert'
    && candidate.issue_mutation === 'forbidden'
    && candidate.tool_dispatch === 'forbidden'
  )));
});

test('ships a closed JSON Schema projection for request and candidate-set boundaries', async () => {
  const raw = await readFile('src/operations/delivery-plan-slices.schema.json', 'utf8');
  const schema = JSON.parse(raw) as {
    $id: string;
    oneOf: Array<{ $ref: string }>;
    $defs: Record<string, { additionalProperties?: boolean; required?: string[]; properties?: Record<string, unknown> }>;
  };
  assert.equal(schema.$id, 'https://todo2code.local/schemas/delivery-plan-slices.schema.json');
  assert.deepEqual(schema.oneOf, [{ $ref: '#/$defs/request' }, { $ref: '#/$defs/result' }]);
  for (const name of ['request', 'plan', 'sourceSlice', 'decomposition', 'candidate', 'result']) {
    assert.equal(schema.$defs[name]?.additionalProperties, false);
  }
  assert.ok(schema.$defs.request?.required?.includes('source_nl_hash'));
  assert.ok(schema.$defs.request?.required?.includes('accepted_dsl_hash'));
  assert.ok(schema.$defs.candidate?.required?.includes('dedupe_key'));
  assert.ok(schema.$defs.candidate?.required?.includes('issue_mutation'));
});
