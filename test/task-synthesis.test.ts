import assert from 'node:assert/strict';
import test from 'node:test';
import { addCommunicationIssuesToDiagnostics, analyzeCommunication } from '../src/communication/analyzer.js';
import { buildRecord } from '../src/core/record.js';
import type { Diagnostic, DiagnosticReport, IntentGraph } from '../src/core/types.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import {
  synthesizeTodoProposals,
  TaskSynthesisRequiredError,
} from '../src/synthesis/tasks-llm.js';
import { T2C_VERSION } from '../src/version.js';
import { makeConfig } from './helpers.js';

const GENERATED_AT = '2026-07-29T12:00:00.000Z';

function fixture(): { graph: IntentGraph; diagnostics: DiagnosticReport; diagnostic: Diagnostic } {
  const record = buildRecord({
    kind: 'todo_item',
    action: 'add',
    object: 'audited task synthesis',
    text: 'Add audited graph and diagnostics task synthesis.',
    target: { paths: ['src/synthesis/tasks-llm.ts'], tickets: ['T2C-102'] },
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: 5, end: 5 },
    extractor: 'test/task-synthesis',
    epistemicClass: 'plan',
    confidence: 1,
    basis: ['fixture'],
  });
  const graph = linkIntentRecords([record], GENERATED_AT);
  const diagnostics = diagnoseGraph(graph, GENERATED_AT);
  const diagnostic = diagnostics.diagnostics.find((item) => item.code === 'PLANNED_NOT_IMPLEMENTED');
  assert.ok(diagnostic);
  return { graph, diagnostics, diagnostic };
}

function providerResponse(diagnostic: Diagnostic): Record<string, unknown> {
  return {
    conclusions: [{
      key: 'conclusion-1',
      kind: 'finding',
      title: 'Task has no implementation evidence',
      detail: 'The planned task is not connected to Git or AST evidence.',
      severity: 'blocking',
      diagnosticIds: [diagnostic.id],
      recordIds: diagnostic.recordIds,
      confidence: 0.93,
    }],
    proposals: [{
      key: 'task-1',
      title: 'Implement audited task synthesis',
      description: 'Create and test the structured LLM synthesis stage.',
      priority: 'P1',
      target: {
        paths: ['src/synthesis/tasks-llm.ts'],
        symbols: ['synthesizeTodoProposals'],
        tickets: ['T2C-102'],
        versions: [],
      },
      acceptanceCriteria: ['Create and test the structured LLM synthesis stage.'],
      dependencyKeys: [],
      conclusionKeys: ['conclusion-1'],
      diagnosticIds: [diagnostic.id],
      recordIds: diagnostic.recordIds,
      confidence: 0.9,
    }],
  };
}

test('Structured task synthesis materializes stable, grounded contracts with a complete audit', async () => {
  const { graph, diagnostics, diagnostic } = fixture();
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  config.openRouter.taskModel = 'qwen/qwen3.7-plus';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: 'generation-task-1',
      model: 'qwen/qwen3.7-plus',
      provider: 'Qwen',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost: 0.01 },
      choices: [{ message: { content: JSON.stringify(providerResponse(diagnostic)) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await synthesizeTodoProposals(graph, diagnostics, config, 'require-llm');
    assert.equal(result.conclusions.length, 1);
    assert.equal(result.proposals.length, 1);
    assert.deepEqual(result.rawDiagnosticActions, []);
    assert.match(result.conclusions[0]!.id, /^CONC-[a-f0-9]{20}$/);
    assert.match(result.proposals[0]!.id, /^TPROP-[a-f0-9]{20}$/);
    assert.deepEqual(result.proposals[0]!.conclusionIds, [result.conclusions[0]!.id]);
    assert.deepEqual(result.proposals[0]!.diagnosticIds, [diagnostic.id]);
    assert.equal(result.conclusions[0]!.confidence, 0.93);
    assert.equal(result.conclusions[0]!.kind, 'finding');
    assert.equal(result.conclusions[0]!.severity, 'blocking');
    assert.equal(result.proposals[0]!.confidence, 0.9);
    assert.equal(result.proposals[0]!.priority, 'P1');
    assert.deepEqual(result.proposals[0]!.acceptanceCriteria, ['Create and test the structured LLM synthesis stage.']);
    assert.equal(result.proposals[0]!.generation.runtimeVersion, T2C_VERSION);
    assert.equal(result.proposals[0]!.generation.generatorVersion, '2');
    assert.equal(result.proposals[0]!.generation.requestedMode, 'require-llm');
    assert.equal(result.proposals[0]!.generation.effectiveMode, 'llm');
    assert.equal(result.proposals[0]!.generation.model, 'qwen/qwen3.7-plus');
    assert.equal(result.proposals[0]!.generation.provider, 'Qwen');
    assert.equal(result.proposals[0]!.generation.responseId, 'generation-task-1');
    assert.match(result.proposals[0]!.generation.configurationFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(result.audit.status, 'succeeded');
    assert.equal(result.audit.recordCount, 2);
    assert.equal(result.audit.responses[0]?.responseId, 'generation-task-1');
    assert.deepEqual(result.validation.orderedProposalIds, [result.proposals[0]!.id]);
    assert.deepEqual(result.validation.newProposalIds, []);
    assert.deepEqual(result.validation.duplicateProposalIds, [result.proposals[0]!.id]);
    assert.deepEqual(result.validation.duplicates[0]?.existingRecordIds, diagnostic.recordIds);
    assert.ok(result.validation.duplicates[0]?.basis.includes('shared_ticket_and_text'));
    assert.equal(requestBody.model, 'qwen/qwen3.7-plus');
    assert.equal(JSON.stringify(requestBody).includes('secret-test-key'), false);
    const payload = JSON.parse(
      ((requestBody.messages as Array<{ role: string; content: string }>).find((item) => item.role === 'user')?.content ?? '{}'),
    ) as { graph?: { fingerprint?: string } };
    assert.equal(payload.graph?.fingerprint, graph.fingerprint);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('blank response-local proposal keys are rejected instead of invented by the runtime', async () => {
  const { graph, diagnostics, diagnostic } = fixture();
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  const response = providerResponse(diagnostic) as {
    proposals: Array<{ key: string }>;
  };
  response.proposals[0]!.key = '   ';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      id: 'generation-blank-local-key', model: 'qwen/qwen3.7-plus', provider: 'Qwen',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.001 },
      choices: [{ message: { content: JSON.stringify(response) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await assert.rejects(
      () => synthesizeTodoProposals(graph, diagnostics, config, 'require-llm'),
      (error: unknown) => error instanceof TaskSynthesisRequiredError
        && error.audit.responses.length === 2
        && error.message.includes('response.proposals[0].key'),
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('prefer-llm exposes raw diagnostic actions without claiming semantic task generation', async () => {
  const { graph, diagnostics, diagnostic } = fixture();
  const config = makeConfig(process.cwd());
  const result = await synthesizeTodoProposals(graph, diagnostics, config, 'prefer-llm');

  assert.deepEqual(result.conclusions, []);
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.validation.orderedProposalIds, []);
  assert.deepEqual(result.validation.newProposalIds, []);
  assert.ok(result.rawDiagnosticActions.some((action) => action.diagnosticId === diagnostic.id));
  assert.equal(result.audit.status, 'fallback');
  assert.equal(result.audit.effectiveMode, 'deterministic');
  assert.equal(result.audit.degraded, true);
  assert.equal(result.audit.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.match(result.warnings[0] ?? '', /raw diagnostic actions only/);
});

test('communication divergence is grounded in task synthesis without treating agent claims as facts', async () => {
  const request = buildRecord({
    kind: 'communication_request', actor: 'Alice', action: 'add', object: 'safe flow',
    text: 'Add safe flow for COMM-9.', target: { tickets: ['COMM-9'] }, lifecycle: 'proposed',
    sourceKind: 'agent_log', sourcePath: 'project/COMM-9/alice.request.md', sourceLines: { start: 7, end: 7 },
    extractor: 'test', epistemicClass: 'declaration', confidence: 0.88, basis: ['fixture'],
    metadata: { participant: 'Alice', participantRole: 'human', messageType: 'request', ticket: 'COMM-9' },
  });
  const claim = buildRecord({
    kind: 'communication_claim', actor: 'Codex', action: 'add', object: 'unrequested flow',
    text: 'Implemented unrequested flow for COMM-9.', target: { tickets: ['COMM-9'] }, lifecycle: 'implemented',
    sourceKind: 'agent_log', sourcePath: 'project/COMM-9/codex.claim.md', sourceLines: { start: 7, end: 7 },
    extractor: 'test', epistemicClass: 'claim', confidence: 0.88, basis: ['fixture'],
    metadata: { participant: 'Codex', participantRole: 'agent', messageType: 'claim', ticket: 'COMM-9' },
  });
  const graph = linkIntentRecords([request, claim], GENERATED_AT);
  const diagnostics = addCommunicationIssuesToDiagnostics(
    diagnoseGraph(graph, GENERATED_AT), analyzeCommunication(graph, GENERATED_AT),
  );
  const result = await synthesizeTodoProposals(graph, diagnostics, makeConfig(process.cwd()), 'prefer-llm');
  const claimDiagnostic = diagnostics.diagnostics.find((item) => item.code === 'AGENT_CLAIM_WITHOUT_EVIDENCE');
  assert.ok(claimDiagnostic);
  assert.ok(result.rawDiagnosticActions.some((item) => item.diagnosticId === claimDiagnostic.id));
  assert.equal(claim.epistemic.class, 'claim');
  assert.equal(graph.records.some((record) => record.source.kind === 'agent_log' && record.epistemic.class === 'fact'), false);
});

test('require-llm fails explicitly when task synthesis cannot call the provider', async () => {
  const { graph, diagnostics } = fixture();
  const config = makeConfig(process.cwd());
  await assert.rejects(
    () => synthesizeTodoProposals(graph, diagnostics, config, 'require-llm'),
    (error: unknown) => error instanceof TaskSynthesisRequiredError
      && error.audit.status === 'failed'
      && error.audit.effectiveMode === 'none'
      && error.audit.reason?.code === 'LLM_NOT_CONFIGURED'
      && error.audit.runtimeVersion === T2C_VERSION,
  );
});

test('invalid structured LLM citations are rejected or visibly degraded according to mode', async () => {
  const { graph, diagnostics, diagnostic } = fixture();
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  const invalid = providerResponse(diagnostic) as {
    conclusions: Array<{ diagnosticIds: string[] }>;
  };
  invalid.conclusions[0]!.diagnosticIds = ['DIAG-22222222222222222222'];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(invalid) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    await assert.rejects(
      () => synthesizeTodoProposals(graph, diagnostics, config, 'require-llm'),
      (error: unknown) => error instanceof TaskSynthesisRequiredError
        && error.audit.reason?.code === 'LLM_RESPONSE_INVALID',
    );
    const degraded = await synthesizeTodoProposals(graph, diagnostics, config, 'prefer-llm');
    assert.deepEqual(degraded.conclusions, []);
    assert.deepEqual(degraded.proposals, []);
    assert.ok(degraded.rawDiagnosticActions.length > 0);
    assert.equal(degraded.audit.reason?.code, 'LLM_RESPONSE_INVALID');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('task synthesis timeout is audited and never retried as a format fallback', async () => {
  const { graph, diagnostics } = fixture();
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  config.openRouter.timeoutMs = 5;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    return await new Promise<Response>((_resolve, reject) => {
      const abort = (): void => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (init?.signal?.aborted) abort();
      else init?.signal?.addEventListener('abort', abort, { once: true });
    });
  };
  try {
    const degraded = await synthesizeTodoProposals(graph, diagnostics, config, 'prefer-llm');
    assert.equal(degraded.audit.reason?.code, 'LLM_TIMEOUT');
    assert.equal(calls, 1);
    await assert.rejects(
      () => synthesizeTodoProposals(graph, diagnostics, config, 'require-llm'),
      (error: unknown) => error instanceof TaskSynthesisRequiredError && error.audit.reason?.code === 'LLM_TIMEOUT',
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('A fabricated record citation is grounded from its cited diagnostic without a retry', async () => {
  const { graph, diagnostics, diagnostic } = fixture();
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  config.openRouter.taskModel = 'qwen/qwen3.7-plus';

  // Well-formed but ungrounded: the ID matches the schema pattern and exists
  // nowhere in the graph. This is the failure mode measured on `make demollm`,
  // where it sank 3 of 6 runs.
  const fabricated = JSON.parse(JSON.stringify(providerResponse(diagnostic))) as {
    conclusions: Array<{ recordIds: string[] }>;
  };
  fabricated.conclusions[0]!.recordIds = ['INT-NL-cb2bb3a6706ca9e28552'];

  const originalFetch = globalThis.fetch;
  let calls = 0;
  const reply = (body: unknown): Response => new Response(JSON.stringify({
    id: `generation-retry-${calls}`,
    model: 'qwen/qwen3.7-plus',
    provider: 'Qwen',
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost: 0.01 },
    choices: [{ message: { content: JSON.stringify(body) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  globalThis.fetch = async () => {
    calls += 1;
    return reply(fabricated);
  };

  try {
    const result = await synthesizeTodoProposals(graph, diagnostics, config, 'require-llm');
    assert.equal(calls, 1);
    assert.deepEqual(result.conclusions[0]?.recordIds, diagnostic.recordIds);
    assert.equal(result.audit.status, 'succeeded');
    assert.equal(result.audit.responses.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('A fabricated diagnostic still fails after the corrective retry', async () => {
  const { graph, diagnostics, diagnostic } = fixture();
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  const fabricated = JSON.parse(JSON.stringify(providerResponse(diagnostic))) as {
    conclusions: Array<{ diagnosticIds: string[] }>;
  };
  fabricated.conclusions[0]!.diagnosticIds = ['DIAG-22222222222222222222'];

  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      id: 'generation-retry-fail',
      model: 'qwen/qwen3.7-plus',
      provider: 'Qwen',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.001 },
      choices: [{ message: { content: JSON.stringify(fabricated) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await assert.rejects(
      () => synthesizeTodoProposals(graph, diagnostics, config, 'require-llm'),
      (error: unknown) => error instanceof TaskSynthesisRequiredError
        && error.audit.responses.length === 2,
    );
    assert.equal(calls, 2, 'the retry budget is exactly one extra attempt');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
