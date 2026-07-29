import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { extractDocumentationIntent } from '../src/extractors/docs-llm.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { OpenRouterClient } from '../src/llm/openrouter.js';
import { summarizeGraph } from '../src/summary/summarizer.js';
import { makeConfig } from './helpers.js';

test('OpenRouter client parses structured JSON without exposing key', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  const originalFetch = globalThis.fetch;
  let authorization = '';
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    const headers = init?.headers as Record<string, string>;
    authorization = headers.Authorization ?? '';
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"records":[]}' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const client = new OpenRouterClient(config.openRouter);
    const result = await client.chatJson<{ records: unknown[] }>([{ role: 'user', content: 'test' }], 'test', { type: 'object' });
    assert.deepEqual(result, { records: [] });
    assert.equal(authorization, 'Bearer secret-test-key');
    assert.equal((requestBody.response_format as { type?: string }).type, 'json_schema');
    assert.equal((requestBody.provider as { require_parameters?: boolean }).require_parameters, true);
    assert.ok(!JSON.stringify(requestBody).includes('secret-test-key'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Documentation extractor converts OpenRouter structured output to bounded LLM records', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-doc-llm-'));
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs', 'architecture.md'), '# Runtime\n\nWalidacja kontraktu musi nastąpić przed wykonaniem.\n', 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'secret-test-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
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
            confidence: 0.99,
            basis: ['document_statement'],
            target: { paths: [], symbols: ['validateContract'], tickets: [], versions: [] },
            sourceLines: { start: 3, end: 3 },
            text: 'Walidacja kontraktu musi nastąpić przed wykonaniem.',
          }],
        }),
      },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const result = await extractDocumentationIntent({
      root,
      patterns: ['docs/**/*.md'],
      excludes: [],
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM summarizer receives graph data and preserves grounded record citations', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
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
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { messages?: Array<{ role: string; content: string }> };
    userPayload = body.messages?.find((message) => message.role === 'user')?.content ?? '';
    return new Response(JSON.stringify({
      choices: [{ message: { content: `# Raport\n\n## Cel\n\nDodać walidację kontraktu. [${record.id}]` } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await summarizeGraph(graph, diagnostics, config, { allowDeterministicFallback: false });
    assert.equal(result.llmUsed, true);
    assert.ok(result.markdown.includes(`[${record.id}]`));
    assert.ok(result.markdown.includes(graph.fingerprint));
    assert.ok(userPayload.includes(record.id));
    assert.ok(!userPayload.includes('secret-test-key'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
