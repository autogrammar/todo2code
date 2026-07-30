import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256 } from '../src/core/id.js';
import type { GroundedGenerationMetadata } from '../src/core/types.js';
import {
  compileSubactorProcessEnvelope,
  createOperationPlan,
  createVariableContract,
} from '../src/index.js';
import type { OperationPlanDraft, VariableContractDraft } from '../src/index.js';

const NOW = '2026-07-30T14:00:00.000Z';
const OBSERVED = '2026-07-30T13:59:30.000Z';

function generation(): GroundedGenerationMetadata {
  return {
    generator: 'todo2code/operation-planner', generatorVersion: '1', runtimeVersion: '0.5.0', generatedAt: NOW,
    requestedMode: 'require-llm', effectiveMode: 'llm', degraded: false, model: 'test/planner', provider: 'test',
    responseId: 'response-operation-1', configurationFingerprint: sha256('operation-config'), reason: null,
  };
}

function variable(overrides: Partial<VariableContractDraft> = {}) {
  return createVariableContract({
    name: 'domain', valueType: 'string', classification: 'internal',
    source: { kind: 'digital_twin', ref: 'twin://projects/docs/domain' },
    access: { readers: ['authority:founder', 'bot:project-operator-bot'], writers: ['authority:founder'] },
    mutable: false, freshnessSeconds: 120,
    ...overrides,
  });
}

function queryDraft(): OperationPlanDraft {
  const domain = variable();
  return {
    createdAt: NOW,
    contractVersion: 'subactor-capabilities/2026-07-30',
    capabilitySnapshotHash: sha256('capabilities'),
    requestedBy: 'bot:autonomy-planner',
    reason: 'Read the declared public route and verify it independently.',
    evidence: {
      graphFingerprint: sha256('graph'), recordIds: ['INT-SYSTEM-0123456789abcdef0123'],
      diagnosticIds: ['DIAG-0123456789abcdef0123'], conclusionIds: ['CONC-0123456789abcdef0123'],
    },
    generation: generation(), variables: [domain],
    steps: [{
      id: 'inspect-route', name: 'Inspect public route', capability: 'https.verify',
      uriProcess: 'httpcheck://host/http/query/url', actor: 'bot:project-operator-bot',
      effect: 'query', reversible: true, riskClass: 'read_only',
      parameters: { domain: { kind: 'variable', variableId: domain.id } }, dependsOn: [],
      humanApproval: false, rollback: null,
    }],
    expectations: [{
      id: 'route-reachable', expected: { ok: true }, verifier: 'project-reconciliation-controller',
      verifiedBy: ['inspect-route'],
    }],
    decision: { required: false, authority: null, reason: null },
    verification: { serviceRestartRequired: false, exerciseRequired: false, independentReadback: true },
  };
}

test('variable contracts and operation plans have deterministic content-bound IDs', () => {
  const firstVariable = variable();
  const reorderedAccess = variable({
    access: { readers: ['bot:project-operator-bot', 'authority:founder'], writers: ['authority:founder'] },
  });
  assert.equal(firstVariable.id, reorderedAccess.id);
  const first = createOperationPlan(queryDraft());
  const second = createOperationPlan(queryDraft());
  assert.deepEqual(first, second);
  assert.equal(first.status, 'proposed');
  assert.equal(first.id, `OPLAN-${first.planHash.slice(0, 20)}`);
});

test('every variable grants Founder read/write authority and immutable variables reject other writers', () => {
  assert.throws(() => createVariableContract({
    ...queryDraft().variables[0]!, access: { readers: ['bot:project-operator-bot'], writers: ['bot:project-operator-bot'] },
  } as VariableContractDraft), /authority:founder/);
  assert.throws(() => variable({
    mutable: false,
    access: {
      readers: ['authority:founder', 'bot:project-operator-bot'],
      writers: ['authority:founder', 'bot:project-operator-bot'],
    },
  }), /immutable variables/);
});

test('plans reject undeclared parameters, actor visibility gaps and payload secrets', () => {
  const undeclared = queryDraft();
  undeclared.steps[0]!.parameters.domain = { kind: 'variable', variableId: 'VAR-00000000000000000000' };
  assert.throws(() => createOperationPlan(undeclared), /declared variable/);

  const hidden = queryDraft();
  hidden.variables = [variable({ access: { readers: ['authority:founder'], writers: ['authority:founder'] } })];
  hidden.steps[0]!.parameters.domain = { kind: 'variable', variableId: hidden.variables[0]!.id };
  assert.throws(() => createOperationPlan(hidden), /cannot read variable/);

  const secret = queryDraft();
  secret.variables = [variable({
    name: 'credential', classification: 'secret', source: { kind: 'vault', ref: 'vault://entries/project-publisher' },
  })];
  secret.steps[0]!.parameters = { credential: { kind: 'variable', variableId: secret.variables[0]!.id } };
  assert.throws(() => createOperationPlan(secret), /secret variable/);
});

test('safety-sensitive commands require a Founder decision, a human boundary and verification', () => {
  const draft = queryDraft();
  draft.steps[0] = {
    ...draft.steps[0]!, effect: 'command', riskClass: 'boundary', reversible: false, humanApproval: false,
    rollback: { kind: 'unavailable', uriProcess: null, reason: 'External publication cannot be rolled back atomically.' },
  };
  draft.verification.exerciseRequired = true;
  assert.throws(() => createOperationPlan(draft), /humanApproval/);
  draft.steps[0]!.humanApproval = true;
  assert.throws(() => createOperationPlan(draft), /authority:founder decision/);
  draft.decision = { required: true, authority: 'authority:founder', reason: 'Founder chooses whether to cross the production boundary.' };
  assert.doesNotThrow(() => createOperationPlan(draft));
});

test('plan hash detects semantic tampering', () => {
  const plan = createOperationPlan(queryDraft());
  const tampered = structuredClone(plan);
  tampered.steps[0]!.capability = 'site.publish';
  assert.throws(() => compileSubactorProcessEnvelope(tampered, {
    correlationId: 'PLF-2200',
    bindings: { [tampered.variables[0]!.id]: { value: 'docs.subactor.com', sourceRef: 'twin://projects/docs/domain', observedAt: OBSERVED } },
  }), /hash does not match/);
});

test('compiler emits the exact governed envelope without an execution surface', () => {
  const plan = createOperationPlan(queryDraft());
  const variableId = plan.variables[0]!.id;
  const envelope = compileSubactorProcessEnvelope(plan, {
    correlationId: 'PLF-2200',
    bindings: {
      [variableId]: { value: 'docs.subactor.com', sourceRef: 'twin://projects/docs/domain', observedAt: OBSERVED },
    },
  });
  assert.equal(envelope.schema, 'subactor.process-envelope.v2');
  assert.equal(envelope.plan_id, plan.id);
  assert.equal(envelope.idempotency_key, `todo2code:${plan.planHash}`);
  assert.deepEqual(envelope.definitions.uri[0], {
    id: 'inspect-route', name: 'Inspect public route', uri: 'httpcheck://host/http/query/url',
    actor: 'bot:project-operator-bot', payload: { domain: 'docs.subactor.com' }, depends_on: [],
    human_approval: false, effect: 'query', reversible: true, risk_class: 'read_only', rollback: null,
    status: 'pending',
  });
  assert.deepEqual(envelope.definitions.eql[0]?.verified_by, ['inspect-route']);
  assert.deepEqual(envelope.definitions.aql[0]?.variable_read, [variableId]);
  assert.equal(envelope.definitions.aql[0]?.capability_snapshot_hash, plan.capabilitySnapshotHash);
  assert.equal('execute' in envelope, false);
  assert.equal('transport' in envelope, false);
});

test('runtime draft boundaries ignore lifecycle and identity fields injected by untyped callers', () => {
  const draft = queryDraft() as OperationPlanDraft & { id: string; planHash: string; status: string; schemaVersion: string };
  draft.id = 'OPLAN-00000000000000000000';
  draft.planHash = '0'.repeat(64);
  draft.status = 'completed';
  draft.schemaVersion = 'attacker/v1';
  const plan = createOperationPlan(draft);
  assert.equal(plan.status, 'proposed');
  assert.equal(plan.schemaVersion, 't2c.operation-plan/v1');
  assert.notEqual(plan.id, draft.id);
  assert.notEqual(plan.planHash, draft.planHash);
});

test('compiler fails closed on extra, stale, wrong-source and wrong-type bindings', () => {
  const plan = createOperationPlan(queryDraft());
  const variableId = plan.variables[0]!.id;
  const compile = (binding: { value: string | number; sourceRef: string; observedAt: string | null }, extra = {}) => (
    compileSubactorProcessEnvelope(plan, { correlationId: 'PLF-2200', bindings: { [variableId]: binding, ...extra } })
  );
  assert.throws(() => compile({ value: 'docs.subactor.com', sourceRef: 'twin://wrong', observedAt: OBSERVED }), /source/);
  assert.throws(() => compile({ value: 42, sourceRef: 'twin://projects/docs/domain', observedAt: OBSERVED }), /wrong value type/);
  assert.throws(() => compile({ value: 'docs.subactor.com', sourceRef: 'twin://projects/docs/domain', observedAt: '2026-07-30T13:00:00.000Z' }), /stale/);
  assert.throws(() => compile(
    { value: 'docs.subactor.com', sourceRef: 'twin://projects/docs/domain', observedAt: OBSERVED },
    { 'VAR-11111111111111111111': { value: 'unexpected', sourceRef: 'runtime://unexpected', observedAt: null } },
  ), /unreferenced variable/);
});
