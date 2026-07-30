import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPaths, topicKeywords } from '../src/core/text.js';
import { extractNlIntent } from '../src/extractors/nl.js';
import { extractNlIntentAudited, NlLlmRequiredError } from '../src/extractors/nl-llm.js';
import { makeConfig } from './helpers.js';
import { T2C_VERSION } from '../src/version.js';

test('NL extractor produces deterministic non-LLM records', async () => {
  const config = makeConfig(process.cwd());
  const text = 'System musi dodać walidację kontraktu przed `executeContract` i zwrócić błąd dla T2C-14.';
  const first = await extractNlIntent({ root: process.cwd(), sourcePath: 'TASK.md', text }, config);
  const second = await extractNlIntent({ root: process.cwd(), sourcePath: 'TASK.md', text }, config);
  assert.equal(first.records.length, 1);
  assert.equal(first.records[0]?.id, second.records[0]?.id);
  assert.equal(first.records[0]?.statement.action, 'add');
  assert.equal(first.records[0]?.source.kind, 'nl');
  assert.equal(first.records[0]?.metadata.llmUsed, false);
  assert.ok(first.records[0]?.statement.target.symbols.includes('executeContract'));
  assert.ok(first.records[0]?.statement.target.tickets.includes('T2C-14'));
});

test('deterministic NL fallback skips Markdown headings and recognizes comparison intent', async () => {
  const config = makeConfig(process.cwd());
  const result = await extractNlIntent({
    root: process.cwd(),
    sourcePath: 'TASK.md',
    text: '# Acceptance evidence\n\n- Compare `origin/main` with the current workspace.\n',
  }, config);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0]?.statement.action, 'analyze');
  assert.equal(result.records[0]?.source.lines?.start, 3);
});

test('path extraction rejects lowercase prose alternations without losing repository paths', () => {
  const paths = extractPaths(
    'Compare backend/frontend, human/agent and NL/docs/Markdown with `src/core`, `docs/api`, `src/runtime.ts` and packages/sdk/runtime now.',
  );
  assert.deepEqual(paths, ['docs/api', 'packages/sdk/runtime', 'src/core', 'src/runtime.ts']);
});

test('path extraction rejects dotted DSL fields but keeps known file extensions', () => {
  const paths = extractPaths(
    'Compare `metadata.generation`, `statement.object` and `epistemic.basis` with `manifest.json`, `changelog.ts` and `config/app.yaml`.',
  );
  assert.deepEqual(paths, ['changelog.ts', 'config/app.yaml', 'manifest.json']);
});

test('topic keywords normalize paths, camelCase and documentation word forms', () => {
  assert.deepEqual(
    topicKeywords('src/extractors/docs-record.ts extractDocumentationIntent validation tests'),
    ['document', 'extract', 'test', 'validate'],
  );
});

test('NL LLM extraction emits audited provenance and bounded DSL records', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  config.openRouter.nlModel = 'qwen/test-nl';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'gen-nl-1', model: 'qwen/nl-resolved', provider: 'NlProvider',
    usage: { prompt_tokens: 14, completion_tokens: 7, total_tokens: 21, cost: 0.002 },
    choices: [{ message: { content: JSON.stringify({
    records: [{
      kind: 'declared_intent', actor: 'system', action: 'validate', subject: null,
      object: 'runtime contract', modality: 'required', polarity: 'positive', lifecycle: 'implemented',
      confidence: 0.99, basis: ['explicit requirement'],
      target: { paths: ['src/runtime.ts'], symbols: ['validateContract'], tickets: ['T2C-14'], versions: [] },
      sourceLines: { start: 1, end: 9 }, text: 'System musi walidować kontrakt.',
    }],
  }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const result = await extractNlIntentAudited({
      root: process.cwd(), sourcePath: 'TASK.md', text: 'System musi walidować `validateContract` dla T2C-14.\n',
    }, config, 'prefer-llm');
    assert.equal(result.audit.status, 'succeeded');
    assert.equal(result.audit.effectiveMode, 'llm');
    assert.equal(result.audit.model, 'qwen/test-nl');
    assert.equal(result.audit.runtimeVersion, T2C_VERSION);
    assert.equal(result.audit.configuration.model, 'qwen/test-nl');
    assert.equal('apiKey' in result.audit.configuration, false);
    assert.equal(result.audit.responses[0]?.responseId, 'gen-nl-1');
    assert.equal(result.audit.responses[0]?.model, 'qwen/nl-resolved');
    assert.equal(result.audit.responses[0]?.usage?.totalTokens, 21);
    assert.equal(result.records[0]?.epistemic.class, 'llm_inference');
    assert.equal(result.records[0]?.epistemic.confidence, 0.9);
    assert.deepEqual(result.records[0]?.source.lines, { start: 1, end: 2 });
    assert.equal(result.records[0]?.metadata.llmUsed, true);
    assert.deepEqual(result.records[0]?.metadata.generation, {
      generator: 't2c/nl-openrouter', generatorVersion: '1', runtimeVersion: T2C_VERSION,
      requested: 'llm', used: 'llm', degraded: false, fallbackReason: null,
      provider: 'NlProvider', model: 'qwen/nl-resolved', responseId: 'gen-nl-1',
    });
    assert.equal(result.records[0]?.lifecycle.status, 'proposed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('NL LLM failure is explicit when deterministic fallback is used', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = 'secret-test-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new DOMException('aborted', 'AbortError'); };
  try {
    const result = await extractNlIntentAudited({
      root: process.cwd(), sourcePath: 'TASK.md', text: 'Dodać walidację dla T2C-14.',
    }, config, 'prefer-llm');
    assert.equal(result.audit.status, 'fallback');
    assert.equal(result.audit.degraded, true);
    assert.equal(result.audit.reason?.code, 'LLM_TIMEOUT');
    assert.equal(result.records[0]?.metadata.llmUsed, false);
    const generation = result.records[0]?.metadata.generation as { degraded?: boolean; fallbackReason?: string };
    assert.equal(generation.degraded, true);
    assert.equal(generation.fallbackReason, 'LLM_TIMEOUT');
    assert.match(result.warnings.join('\n'), /deterministic fallback/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('require-llm rejects instead of silently falling back', async () => {
  const config = makeConfig(process.cwd());
  config.openRouter.apiKey = null;
  await assert.rejects(
    () => extractNlIntentAudited({ root: process.cwd(), sourcePath: 'TASK.md', text: 'Dodać test.' }, config, 'require-llm'),
    (error: unknown) => error instanceof NlLlmRequiredError && error.audit.reason?.code === 'LLM_NOT_CONFIGURED',
  );
});
