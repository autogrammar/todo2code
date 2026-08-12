import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { DocumentationLlmRequiredError, extractDocumentationIntent } from '../src/extractors/docs-llm.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { OpenRouterClient, OpenRouterModelError } from '../src/llm/openrouter.js';
import { StructuredResponseError, structuredSchema as s } from '../src/llm/structured-schema.js';
import { summarizeGraph } from '../src/summary/summarizer.js';
import { T2C_VERSION } from '../src/version.js';
import { makeConfig } from './helpers.js';

test('OpenRouter client parses structured JSON without exposing key', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  let authorization = '';
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    const headers = init?.headers as Record<string, string>;
    authorization = headers.Authorization ?? '';
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: 'gen-test-1', model: 'qwen/resolved', provider: 'TestProvider',
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15, cost: 0.001 },
      choices: [{ message: { content: '{"records":[]}' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const client = new OpenRouterClient(config.openRouter);
    const result = await client.chatJsonWithMetadata<{ records: unknown[] }>([{ role: 'user', content: 'test' }], 'test', { type: 'object' });
    assert.deepEqual(result.value, { records: [] });
    assert.deepEqual(result.metadata, {
      responseId: 'gen-test-1', model: 'qwen/resolved', provider: 'TestProvider',
      usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15, cost: 0.001 },
    });
    assert.equal(authorization, 'Bearer test-secret-key');
    assert.equal((requestBody.response_format as { type?: string }).type, 'json_schema');
    assert.equal((requestBody.provider as { require_parameters?: boolean }).require_parameters, true);
    assert.ok(!JSON.stringify(requestBody).includes('test-secret-key'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenRouter client preserves metadata when runtime rejects structured output', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'gen-rejected-1', model: 'deepseek/deepseek-v4-flash', provider: 'TestProvider',
    usage: { prompt_tokens: 30, completion_tokens: 5, total_tokens: 35, cost: 0.00001 },
    choices: [{ message: { content: '{"records":[{}]}' } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const contract = s.object({ records: s.array(s.object({ text: s.string() })) });
    await assert.rejects(
      () => new OpenRouterClient(config.openRouter).chatStructuredWithMetadata(
        [{ role: 'user', content: 'test' }], 'test', contract,
      ),
      (error: unknown) => {
        assert.ok(error instanceof StructuredResponseError);
        assert.match(error.message, /response\.records\[0\] is missing required properties: text/);
        assert.deepEqual(error.responseMetadata, {
          responseId: 'gen-rejected-1',
          model: 'deepseek/deepseek-v4-flash',
          provider: 'TestProvider',
          usage: { promptTokens: 30, completionTokens: 5, totalTokens: 35, cost: 0.00001 },
        });
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenRouter client lists available models after an invalid model ID', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify({
        data: [
          { id: 'qwen/qwen3.7-plus' },
          { id: 'openai/gpt-5' },
          { id: 'qwen/qwen3.7-plus' },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      error: { message: 'openrouter/qwen/qwen3.7-plus is not a valid model ID' },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const client = new OpenRouterClient(config.openRouter);
    await assert.rejects(
      () => client.chatJson([{ role: 'user', content: 'test' }], 'test', { type: 'object' }, 'openrouter/qwen/qwen3.7-plus'),
      (error: unknown) => {
        assert.ok(error instanceof OpenRouterModelError);
        assert.equal(error.model, 'openrouter/qwen/qwen3.7-plus');
        assert.deepEqual(error.availableModels, ['openai/gpt-5', 'qwen/qwen3.7-plus']);
        assert.match(error.message, /Available OpenRouter models \(2\):/);
        assert.match(error.message, /- openai\/gpt-5/);
        assert.match(error.message, /- qwen\/qwen3\.7-plus/);
        assert.ok(!error.message.includes('test-secret-key'));
        return true;
      },
    );
    assert.equal(requestedUrls.filter((url) => url.endsWith('/chat/completions')).length, 1);
    assert.equal(requestedUrls.filter((url) => url.endsWith('/models')).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenRouter client redacts provider key-management evidence while retaining the failure reason', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const keyFingerprint = 'b8b69587a9fe7eaa7bd9ee4507df65682d4e948550892af1b9c612f462bdfab5';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      message: 'Key limit exceeded (weekly limit). Manage it using '
        + `https://openrouter.ai/workspaces/default/keys/${keyFingerprint}`,
    },
  }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  try {
    await assert.rejects(
      () => new OpenRouterClient(config.openRouter).chatText([{ role: 'user', content: 'test' }]),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /OpenRouter HTTP 403: Key limit exceeded \(weekly limit\)/);
        assert.match(error.message, /\[redacted-provider-management-url\]/);
        assert.equal(error.message.includes(keyFingerprint), false);
        assert.equal(error.message.includes('/workspaces/default/keys/'), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenRouter model-list failures redact credentials and contextual credential identifiers', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const credentialId = 'credential_identifier_0123456789abcdef';
  const echoedApiKey = ['provider', 'generated', 'credential', 'value'].join('_');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      message: `Access denied for credential ID: ${credentialId}; Bearer ${config.openRouter.apiKey}; API key=${echoedApiKey}`,
    },
  }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    await assert.rejects(
      () => new OpenRouterClient(config.openRouter).listAvailableModels(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /OpenRouter models HTTP 401: Access denied/);
        assert.match(error.message, /credential ID \[redacted-credential-id\]/i);
        assert.match(error.message, /Bearer \[redacted-credential\]/);
        assert.match(error.message, /API key=\[redacted-credential\]/i);
        assert.equal(error.message.includes(credentialId), false);
        assert.equal(error.message.includes(echoedApiKey), false);
        assert.equal(error.message.includes(String(config.openRouter.apiKey)), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenRouter JSON timeout is not repeated as a schema fallback request', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new DOMException('aborted', 'AbortError');
  };
  try {
    const client = new OpenRouterClient(config.openRouter);
    await assert.rejects(
      () => client.chatJson([{ role: 'user', content: 'test' }], 'test', { type: 'object' }),
      /timed out/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenRouter request obeys a shared pipeline deadline without retrying', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const deadline = new AbortController();
  config.openRouter.signal = deadline.signal;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  };
  try {
    const request = new OpenRouterClient(config.openRouter).chatJson(
      [{ role: 'user', content: 'test' }], 'test', { type: 'object' },
    );
    deadline.abort();
    await assert.rejects(request, /aborted by pipeline deadline/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Documentation extractor converts OpenRouter structured output to bounded LLM records', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-doc-llm-'));
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs', 'architecture.md'), '# Runtime\n\nWalidacja kontraktu musi nastąpić przed wykonaniem.\n', 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'test-secret-key';
  config.documentRecordsPerChunk = 1;
  const originalFetch = globalThis.fetch;
  let requestPayload: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { messages?: Array<{ role: string; content: string }> };
    requestPayload = JSON.parse(request.messages?.find((message) => message.role === 'user')?.content ?? '{}') as Record<string, unknown>;
    return new Response(JSON.stringify({
    id: 'gen-doc-1', model: 'qwen/doc-resolved', provider: 'DocProvider',
    usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    choices: [{
      message: {
        content: JSON.stringify({
          records: [{
            kind: 'architecture_constraint',
            actor: 'system',
            action: 'validate',
            subject: 'runtime.execution',
            object: 'contract.validation',
            modality: 'required',
            polarity: 'positive',
            lifecycle: 'proposed',
            confidence: 0.85,
            basis: ['document_statement'],
            target: { paths: [], symbols: ['validateContract'], tickets: [], versions: [] },
            sourceLines: { start: 3, end: 3 },
            text: 'Walidacja kontraktu musi nastąpić przed wykonaniem.',
          }],
        }),
      },
    }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await extractDocumentationIntent({
      root,
      patterns: ['docs/**/*.md'],
      excludes: [],
      targetHints: { paths: ['src/runtime.ts'], symbols: ['validateContract'], tickets: ['T2C-7'], versions: [] },
    }, config);
    assert.equal(result.warnings.length, 0);
    assert.equal(result.records.length, 1);
    const record = result.records[0];
    assert.equal(record?.source.kind, 'document');
    assert.equal(record?.source.path, 'docs/architecture.md');
    assert.deepEqual(record?.source.lines, { start: 3, end: 3 });
    assert.equal(record?.epistemic.class, 'llm_inference');
    assert.equal(record?.epistemic.confidence, 0.85);
    assert.equal(record?.metadata.llmUsed, true);
    assert.equal(record?.metadata.runtimeVersion, T2C_VERSION);
    assert.deepEqual(record?.metadata.generation, {
      generator: 't2c/document-openrouter', generatorVersion: '1', runtimeVersion: T2C_VERSION,
      requested: 'llm', used: 'llm', degraded: false, fallbackReason: null,
      provider: 'DocProvider', model: 'qwen/doc-resolved', responseId: 'gen-doc-1',
    });
    assert.equal(result.audit.status, 'succeeded');
    assert.equal(result.audit.effectiveMode, 'llm');
    assert.equal(result.audit.model, config.openRouter.documentModel);
    assert.equal(result.audit.runtimeVersion, T2C_VERSION);
    assert.equal(result.audit.configuration.timeoutMs, config.documentTimeoutMs);
    assert.equal('apiKey' in result.audit.configuration, false);
    assert.equal(result.responses[0]?.responseId, 'gen-doc-1');
    assert.equal(result.responses[0]?.model, 'qwen/doc-resolved');
    assert.equal((record?.metadata.response as { provider?: string }).provider, 'DocProvider');
    assert.equal(requestPayload.maxRecords, 1);
    assert.deepEqual(requestPayload.targetHints, {
      paths: ['src/runtime.ts'], symbols: ['validateContract'], tickets: ['T2C-7'], versions: [],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Documentation extractor reports and enforces its chunk budget', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-doc-budget-'));
  await fs.mkdir(path.join(root, 'docs'));
  await Promise.all([
    fs.writeFile(path.join(root, 'docs', 'a.md'), '# A\n\nRequirement A.\n', 'utf8'),
    fs.writeFile(path.join(root, 'docs', 'b.md'), '# B\n\nRequirement B.\n', 'utf8'),
  ]);
  const config = makeConfig(root);
  config.documentMaxChunks = 1;
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"records":[]}' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const result = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    assert.equal(calls, 1);
    assert.match(result.warnings.join('\n'), /DOC_CHUNK_BUDGET: analyzed 1 of 2/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Documentation extractor corrects one rejected chunk and audits both responses', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-doc-correction-'));
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs', 'contract.md'), '# Contract\n\nValidation is required.\n', 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let correction = '';
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
    correction = request.messages[2]?.content ?? correction;
    return new Response(JSON.stringify({
      id: `doc-correction-${calls}`, model: 'qwen/doc-resolved', provider: 'DocProvider',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      choices: [{ message: { content: calls === 1 ? '{"records":[{}]}' : '{"records":[]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    assert.equal(calls, 2);
    assert.equal(result.warnings.length, 0);
    assert.equal(result.audit.status, 'succeeded');
    assert.deepEqual(result.responses.map((response) => response.responseId), ['doc-correction-1', 'doc-correction-2']);
    assert.match(correction, /is missing required properties/);
    assert.match(correction, /Do not add, rename, or omit properties/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Documentation extractor does not spend its correction retry on a timeout', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-doc-timeout-'));
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs', 'contract.md'), '# Contract\n\nValidation is required.\n', 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new DOMException('aborted', 'AbortError');
  };
  try {
    const result = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    assert.equal(calls, 1);
    assert.equal(result.audit.status, 'failed');
    assert.match(result.warnings.join('\n'), /timed out/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Documentation extractor exposes an audited configuration failure', async () => {
  const config = makeConfig(process.cwd());
  await assert.rejects(
    () => extractDocumentationIntent({ root: process.cwd(), patterns: [], excludes: [] }, config),
    (error: unknown) => error instanceof DocumentationLlmRequiredError
      && error.audit.status === 'failed'
      && error.audit.reason?.code === 'LLM_NOT_CONFIGURED'
      && error.audit.runtimeVersion === T2C_VERSION
      && !('apiKey' in error.audit.configuration),
  );
});

test('Documentation extractor uses bounded concurrent OpenRouter requests', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-doc-concurrency-'));
  await fs.mkdir(path.join(root, 'docs'));
  await Promise.all([
    fs.writeFile(path.join(root, 'docs', 'a.md'), '# A\n\nRequirement A.\n', 'utf8'),
    fs.writeFile(path.join(root, 'docs', 'b.md'), '# B\n\nRequirement B.\n', 'utf8'),
  ]);
  const config = makeConfig(root);
  config.documentConcurrency = 2;
  config.openRouter.apiKey = 'test-secret-key';
  const originalFetch = globalThis.fetch;
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 30));
    active -= 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"records":[]}' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const result = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    assert.equal(result.warnings.length, 0);
    assert.equal(calls, 2);
    assert.equal(maxActive, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM summarizer receives graph data and preserves grounded record citations', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const record = buildRecord({
    kind: 'declared_intent',
    action: 'add',
    object: 'contract.validation',
    text: 'Dodać walidację kontraktu.',
    lifecycle: 'proposed',
    sourceKind: 'nl',
    sourcePath: 'TASK.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['test'],
  });
  const graph = linkIntentRecords([record], '2026-07-29T00:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-29T00:00:00.000Z');
  const originalFetch = globalThis.fetch;
  let userPayload = '';
  let responseFormat = '';
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      messages?: Array<{ role: string; content: string }>;
      response_format?: { type?: string };
    };
    userPayload = body.messages?.find((message) => message.role === 'user')?.content ?? '';
    responseFormat = body.response_format?.type ?? '';
    const diagnostic = diagnostics.diagnostics.find((item) => item.recordIds.includes(record.id))!;
    return new Response(JSON.stringify({
      id: 'gen-summary-1', model: 'qwen/summary-resolved', provider: 'SummaryProvider',
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70, cost: 0.004 },
      choices: [{ message: { content: JSON.stringify({ conclusions: [{
        kind: 'recommendation', title: 'Dodać walidację kontraktu',
        detail: 'Plan wymaga dowodu implementacji walidacji kontraktu.', severity: diagnostic.severity,
        diagnosticIds: [diagnostic.id], recordIds: [record.id], confidence: 0.91,
      }] }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await summarizeGraph(graph, diagnostics, config, { allowDeterministicFallback: false });
    assert.equal(result.llmUsed, true);
    assert.equal(result.responses[0]?.responseId, 'gen-summary-1');
    assert.equal(result.responses[0]?.provider, 'SummaryProvider');
    assert.equal(result.responses[0]?.usage?.cost, 0.004);
    assert.equal(result.conclusions.length, 1);
    assert.equal(result.conclusions[0]?.schemaVersion, 't2c.conclusion/v1');
    assert.equal(result.conclusions[0]?.generation.effectiveMode, 'llm');
    assert.ok(result.markdown.includes(`[${record.id}]`));
    assert.ok(result.markdown.includes('t2c.conclusion/v1'));
    assert.ok(result.markdown.includes(graph.fingerprint));
    assert.ok(userPayload.includes(record.id));
    assert.ok(!userPayload.includes('test-secret-key'));
    assert.equal(responseFormat, 'json_schema');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM summarizer validates provider fields before creating semantic IDs', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const record = buildRecord({
    kind: 'declared_intent', action: 'add', object: 'safe materialization', text: 'Add safe materialization.',
    lifecycle: 'proposed', sourceKind: 'nl', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test', epistemicClass: 'declaration', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([record], '2026-07-29T00:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-29T00:00:00.000Z');
  const diagnostic = diagnostics.diagnostics.find((item) => item.recordIds.includes(record.id))!;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ conclusions: [{
      kind: 'finding', detail: 'The provider omitted the required title.', severity: 'warning',
      diagnosticIds: [diagnostic.id], recordIds: [record.id], confidence: 0.8,
    }] }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const fallback = await summarizeGraph(graph, diagnostics, config, { mode: 'prefer-llm' });
    assert.equal(fallback.llmUsed, false);
    assert.match(fallback.warnings.join('\n'), /response\.conclusions\[0\] is missing required properties: title/);
    assert.doesNotMatch(fallback.warnings.join('\n'), /reading 'trim'/);
    await assert.rejects(
      () => summarizeGraph(graph, diagnostics, config, { mode: 'require-llm' }),
      /response\.conclusions\[0\] is missing required properties: title/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM summarizer diagnoses a provider that ignores the response envelope', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const record = buildRecord({
    kind: 'declared_intent', action: 'add', object: 'summary envelope', text: 'Add a summary envelope.',
    lifecycle: 'proposed', sourceKind: 'nl', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test', epistemicClass: 'declaration', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([record], '2026-07-29T00:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-29T00:00:00.000Z');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ conclusion: 'wrong shape', status: 'ok' }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    await assert.rejects(
      () => summarizeGraph(graph, diagnostics, config, { mode: 'require-llm' }),
      /response contains unknown properties: conclusion, status/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM summarizer rejects diagnostic citations outside the supplied graph', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const record = buildRecord({
    kind: 'declared_intent', action: 'add', object: 'grounded.summary', text: 'Add a grounded summary.',
    lifecycle: 'proposed', sourceKind: 'nl', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test', epistemicClass: 'declaration', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([record], '2026-07-29T00:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-29T00:00:00.000Z');
  const diagnostic = diagnostics.diagnostics.find((item) => item.recordIds.includes(record.id))!;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ conclusions: [{
      kind: 'finding', title: 'Invented evidence', detail: 'This citation is not in the graph.',
      severity: 'warning', diagnosticIds: ['DIAG-22222222222222222222'],
      recordIds: [record.id], confidence: 0.9,
    }] }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const fallback = await summarizeGraph(graph, diagnostics, config, { allowDeterministicFallback: true });
    assert.equal(fallback.llmUsed, false);
    assert.equal(fallback.responses.length, 2, 'both rejected attempts stay visible in fallback audit');
    assert.ok(fallback.conclusions.every((item) => item.recordIds.includes(record.id)));
    assert.match(fallback.warnings.join('\n'), /Invalid structured summary response/);
    await assert.rejects(
      () => summarizeGraph(graph, diagnostics, config, { allowDeterministicFallback: false }),
      /diagnosticIds references unknown ids/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM summarizer prioritizes documentation over the AST payload budget', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const ast = Array.from({ length: 1201 }, (_, index) => buildRecord({
    kind: 'implemented_fact',
    action: 'declare',
    object: `symbol-${index}`,
    text: `symbol-${index}`,
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: `src/generated-${index}.ts`,
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['test'],
  }));
  const document = buildRecord({
    kind: 'documented_requirement',
    action: 'preserve',
    object: 'document contract',
    text: 'The documented contract must be preserved.',
    lifecycle: 'planned',
    sourceKind: 'document',
    sourcePath: 'docs/contract.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test/llm@1',
    epistemicClass: 'llm_inference',
    confidence: 0.8,
    basis: ['test'],
    generation: { requested: 'llm', used: 'llm', provider: 'fixture', model: 'fixture/model' },
  });
  const graph = linkIntentRecords([...ast, document], '2026-07-29T00:00:00.000Z');
  const diagnostics = {
    schemaVersion: 't2c.diagnostics/v1' as const,
    generatedAt: '2026-07-29T00:00:00.000Z',
    graphFingerprint: graph.fingerprint,
    diagnostics: [],
    counts: { info: 0, warning: 0, review_required: 0, blocking: 0 },
  };
  const originalFetch = globalThis.fetch;
  let payload: { graph?: { records?: Array<{ id?: string }> }; truncation?: { includedBySource?: Record<string, number> } } = {};
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { messages?: Array<{ role: string; content: string }> };
    const user = body.messages?.find((message) => message.role === 'user')?.content ?? '{}';
    payload = JSON.parse(user) as typeof payload;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ conclusions: [] }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await summarizeGraph(graph, diagnostics, config, { allowDeterministicFallback: false });
    assert.equal(result.llmUsed, true);
    assert.ok(payload.graph?.records?.some((item) => item.id === document.id));
    assert.equal(payload.truncation?.includedBySource?.document, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deterministic summary presents AST module aggregates instead of low-level calls', async () => {
  const config = makeConfig(process.cwd());
  const module = buildRecord({
    kind: 'module_fact', action: 'declare', object: 'src/runtime.ts', target: { paths: ['src/runtime.ts'] },
    text: 'declare src/runtime.ts', lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/runtime.ts',
    sourceLines: { start: 1, end: 20 }, extractor: 'test', epistemicClass: 'fact', confidence: 1, basis: ['test'],
  });
  const call = buildRecord({
    kind: 'call_fact', action: 'call', object: 'trim', target: { paths: ['src/runtime.ts'], symbols: ['run'] },
    text: 'call trim', lifecycle: 'implemented', sourceKind: 'ast', sourcePath: 'src/runtime.ts',
    sourceLines: { start: 4, end: 4 }, extractor: 'test', epistemicClass: 'fact', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([module, call], '2026-07-29T00:00:00.000Z');
  const result = await summarizeGraph(graph, diagnoseGraph(graph), config, { mode: 'deterministic' });
  assert.match(result.markdown, /declare src\/runtime\.ts/);
  assert.doesNotMatch(result.markdown, /call trim/);
});

test('The summarizer grounds a fabricated record citation from its diagnostic', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const record = buildRecord({
    kind: 'declared_intent', action: 'add', object: 'contract.validation',
    text: 'Dodać walidację kontraktu.', lifecycle: 'proposed', sourceKind: 'nl',
    sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 }, extractor: 'test',
    epistemicClass: 'declaration', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([record], '2026-07-29T00:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-29T00:00:00.000Z');
  const diagnostic = diagnostics.diagnostics.find((item) => item.recordIds.includes(record.id))!;

  // Schema-shaped but ungrounded, the failure mode measured on `make demollm`.
  const conclusion = (recordIds: string[]): unknown => ({
    conclusions: [{
      kind: 'recommendation', title: 'Dodać walidację kontraktu',
      detail: 'Plan wymaga dowodu implementacji walidacji kontraktu.', severity: diagnostic.severity,
      diagnosticIds: [diagnostic.id], recordIds, confidence: 0.91,
    }],
  });

  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      id: `gen-summary-retry-${calls}`, model: 'qwen/summary-resolved', provider: 'SummaryProvider',
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70, cost: 0.004 },
      choices: [{ message: {
        content: JSON.stringify(conclusion(['INT-NL-cb2bb3a6706ca9e28552'])),
      } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await summarizeGraph(graph, diagnostics, config, { mode: 'require-llm' });
    assert.equal(calls, 1);
    assert.equal(result.llmUsed, true);
    assert.equal(result.responses.length, 1);
    assert.deepEqual(result.conclusions[0]?.recordIds, [record.id]);
    assert.equal(result.conclusions[0]?.generation.generatorVersion, '2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('The summarizer still fails when the retry fabricates a diagnostic again', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'test-secret-key';
  const record = buildRecord({
    kind: 'declared_intent', action: 'add', object: 'contract.validation',
    text: 'Dodać walidację kontraktu.', lifecycle: 'proposed', sourceKind: 'nl',
    sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 }, extractor: 'test',
    epistemicClass: 'declaration', confidence: 1, basis: ['test'],
  });
  const graph = linkIntentRecords([record], '2026-07-29T00:00:00.000Z');
  const diagnostics = diagnoseGraph(graph, '2026-07-29T00:00:00.000Z');
  const diagnostic = diagnostics.diagnostics.find((item) => item.recordIds.includes(record.id))!;

  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      id: 'gen-summary-retry-fail', model: 'qwen/summary-resolved', provider: 'SummaryProvider',
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70, cost: 0.004 },
      choices: [{ message: { content: JSON.stringify({ conclusions: [{
        kind: 'recommendation', title: 'Dodać walidację kontraktu',
        detail: 'Plan wymaga dowodu implementacji.', severity: diagnostic.severity,
        diagnosticIds: ['DIAG-22222222222222222222'], recordIds: [record.id], confidence: 0.91,
      }] }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await assert.rejects(() => summarizeGraph(graph, diagnostics, config, { mode: 'require-llm' }));
    assert.equal(calls, 2, 'the retry budget is exactly one extra attempt');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
