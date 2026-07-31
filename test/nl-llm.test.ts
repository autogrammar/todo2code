// NL -> DSL through the LLM. `fetch` is stubbed, so these assertions pin the
// runtime's handling of a model response rather than any model's behaviour.

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractNlIntentAudited, NlLlmRequiredError } from '../src/extractors/nl-llm.js';
import { makeConfig } from './helpers.js';

const SOURCE = [
  '# TASK-991: Limit szybkości',
  '',
  'Należy dodać limit szybkości w `src/server.ts`.',
  'Opcjonalnie można dodać metrykę odrzuceń.',
  '',
].join('\n');

/** Replies with `records` once, then restores the original fetch. */
async function withModelResponse<T>(records: unknown[], body: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'gen-nl-1',
    model: 'test/model',
    provider: 'TestProvider',
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0 },
    choices: [{ message: { content: JSON.stringify({ records }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    return await body();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function rawRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'declared_intent',
    actor: null,
    action: 'add',
    subject: null,
    object: 'limit szybkości',
    modality: 'required',
    polarity: 'positive',
    lifecycle: 'proposed',
    confidence: 0.8,
    basis: ['model_reasoning'],
    target: { paths: ['src/server.ts'], symbols: [], tickets: ['TASK-991'], versions: [] },
    sourceLines: { start: 3, end: 3 },
    text: 'Należy dodać limit szybkości w `src/server.ts`.',
    ...overrides,
  };
}

async function extract(records: unknown[]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-nl-llm-'));
  await fs.writeFile(path.join(root, 'TASK.md'), SOURCE, 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'test-key';
  return withModelResponse(records, () => extractNlIntentAudited(
    { root, sourcePath: 'TASK.md' },
    config,
    'require-llm',
  ));
}

test('An LLM record is marked as inference and keeps runtime-owned provenance', async () => {
  const result = await extract([rawRecord()]);
  const record = result.records[0];
  assert.ok(record);

  // The model may not promote its own output to a deterministic observation.
  assert.equal(record.epistemic.class, 'llm_inference');
  assert.equal(record.metadata.llmUsed, true);
  // Source identity is set by the runtime, never taken from the response.
  assert.equal(record.source.kind, 'nl');
  assert.equal(record.source.path, 'TASK.md');
  assert.equal(record.source.extractor, 't2c/nl-openrouter@1');
  assert.deepEqual(record.source.lines, { start: 3, end: 3 });
  assert.match(record.source.rawExcerpt ?? '', /limit szybkości/);
  assert.equal(result.audit.effectiveMode, 'llm');
});

test('NL extraction corrects one rejected structured response and audits both attempts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-nl-correction-'));
  await fs.writeFile(path.join(root, 'TASK.md'), SOURCE, 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'test-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let correction = '';
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
    correction = request.messages[2]?.content ?? correction;
    return new Response(JSON.stringify({
      id: `gen-nl-correction-${calls}`, model: 'test/model', provider: 'TestProvider',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0 },
      choices: [{ message: { content: JSON.stringify({
        records: calls === 1 ? [{ predicate: 'add', sourcePath: 'TASK.md' }] : [rawRecord()],
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await extractNlIntentAudited({ root, sourcePath: 'TASK.md' }, config, 'require-llm');
    assert.equal(calls, 2);
    assert.equal(result.audit.status, 'succeeded');
    assert.deepEqual(result.audit.responses.map((response) => response.responseId), [
      'gen-nl-correction-1', 'gen-nl-correction-2',
    ]);
    assert.match(correction, /unknown properties: predicate, sourcePath/);
    assert.match(correction, /Do not add, rename, or omit properties/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Confidence must satisfy the provider schema instead of being silently clamped', async () => {
  const result = await extract([rawRecord({ confidence: 0.9 })]);
  assert.ok((result.records[0]?.epistemic.confidence ?? 1) <= 0.9);
  await assert.rejects(() => extract([rawRecord({ confidence: 1 })]), /response\.records\[0\]\.confidence must be at most 0\.9/);
  await assert.rejects(() => extract([rawRecord({ confidence: -5 })]), /response\.records\[0\]\.confidence must be at least 0/);
});

test('Source lines are clamped to the real file', async () => {
  // A hallucinated span must not point outside the document it cites.
  const result = await extract([rawRecord({ sourceLines: { start: 900, end: 5000 } })]);
  const lines = result.records[0]?.source.lines;
  assert.ok(lines && lines.start >= 1 && lines.end <= SOURCE.split('\n').length);
});

test('A placeholder object is recorded as a missing field, not as content', async () => {
  // `action`/`modality`/`lifecycle` are enums containing `unknown`, and models
  // copy that token into the free-text `object`. Accepting it would give every
  // such record the same linker keyword.
  for (const placeholder of ['unknown', 'Unknown', 'unspecified', 'n/a', 'brak', '  ']) {
    const result = await extract([rawRecord({ object: placeholder })]);
    const record = result.records[0];
    assert.ok(record, placeholder);
    assert.notEqual(record.statement.object.toLowerCase(), 'unknown', placeholder);
    assert.deepEqual(record.metadata.missingFields, ['object'], placeholder);
    // The statement stays linkable through its own wording.
    assert.match(record.statement.object, /limit szybkości/, placeholder);
  }
});

test('A real object is kept verbatim and reports no missing field', async () => {
  const result = await extract([rawRecord({ object: 'metrykę odrzuceń' })]);
  assert.equal(result.records[0]?.statement.object, 'metrykę odrzuceń');
  assert.deepEqual(result.records[0]?.metadata.missingFields, []);
});

test('The explicit unknown action is reported as a missing field', async () => {
  const result = await extract([rawRecord({ action: 'unknown' })]);
  assert.equal(result.records[0]?.statement.action, 'unknown');
  assert.deepEqual(result.records[0]?.metadata.missingFields, ['action']);
});

test('Both gaps are reported together', async () => {
  const result = await extract([rawRecord({ action: 'unknown', object: 'unknown' })]);
  assert.deepEqual(result.records[0]?.metadata.missingFields, ['action', 'object']);
});

test('Out-of-vocabulary enums are rejected instead of changing the provider intent', async () => {
  await assert.rejects(() => extract([rawRecord({ action: 'teleport' })]), /response\.records\[0\]\.action must be one of/);
  await assert.rejects(() => extract([rawRecord({ modality: 'mandatory-ish' })]), /response\.records\[0\]\.modality must be one of/);
});

test('Rejected NL output keeps provider metadata in the failed audit', async () => {
  const invalid = rawRecord();
  delete invalid.text;
  await assert.rejects(
    () => extract([invalid]),
    (error: unknown) => {
      assert.ok(error instanceof NlLlmRequiredError);
      assert.equal(error.audit.reason?.code, 'LLM_RESPONSE_INVALID');
      assert.equal(error.audit.responses[0]?.responseId, 'gen-nl-1');
      assert.equal(error.audit.responses[0]?.model, 'test/model');
      assert.equal(error.audit.responses[0]?.provider, 'TestProvider');
      assert.equal(error.audit.responses[0]?.usage?.totalTokens, 2);
      return true;
    },
  );
});

test('The documented confidence hierarchy holds across LLM extractors', async () => {
  // docs/DSL.md publishes these ceilings. They encode a claim: the less
  // structured the source, the lower the ceiling, and no LLM inference ever
  // reaches a deterministic observation. Drift here silently changes which
  // record wins deduplication in the linker.
  // Read the TypeScript sources from the repository root: the compiled test
  // runs out of dist/, where the .ts files do not exist.
  const sources = await Promise.all([
    fs.readFile(path.resolve('src/extractors/markdown-llm.ts'), 'utf8'),
    fs.readFile(path.resolve('src/extractors/nl-llm.ts'), 'utf8'),
    fs.readFile(path.resolve('src/extractors/docs-record.ts'), 'utf8'),
  ]);
  const ceilings = sources.map((source) => {
    const match = source.match(/confidence:\s*Math\.min\((0\.\d+)/);
    assert.ok(match, 'each LLM extractor must cap confidence');
    return Number(match[1]);
  });
  const [markdown, nl, docs] = ceilings as [number, number, number];

  assert.equal(markdown, 0.94);
  assert.equal(nl, 0.9);
  assert.equal(docs, 0.85);
  assert.ok(markdown > nl && nl > docs, 'ceilings must fall as the source loses structure');
  assert.ok(markdown < 0.98, 'an LLM inference must not reach a deterministic TODO record');
  assert.ok(markdown < 1, 'an LLM inference must never reach an AST fact');
});
