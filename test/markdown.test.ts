import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractMarkdownIntentAudited, MarkdownLlmRequiredError } from '../src/extractors/markdown-llm.js';
import { extractMarkdownIntent } from '../src/extractors/markdown.js';
import { extractChangelog } from '../src/extractors/changelog.js';
import { extractTodo } from '../src/extractors/todo.js';
import { makeConfig } from './helpers.js';
import { T2C_VERSION } from '../src/version.js';

test('Markdown extractor separates TODO plans and changelog claims', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-md-'));
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n\n- [ ] Dodać `validateContract` dla T2C-1.\n- [x] Naprawić raport.\n');
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## [1.2.0] - 2026-07-29\n\n### Added\n\n- Dodano `validateContract` dla T2C-1.\n');
  const result = await extractMarkdownIntent({ root, todoPath: 'TODO.md', changelogPath: 'CHANGELOG.md' }, makeConfig(root));
  const todo = result.records.filter((record) => record.source.kind === 'todo');
  const changelog = result.records.filter((record) => record.source.kind === 'changelog');
  assert.equal(todo.length, 2);
  assert.equal(todo[0]?.lifecycle.status, 'planned');
  assert.equal(todo[1]?.lifecycle.status, 'completed');
  assert.equal(changelog.length, 1);
  assert.equal(changelog[0]?.lifecycle.status, 'released');
  assert.equal(changelog[0]?.metadata.version, '1.2.0');
  assert.equal((await extractTodo(root, 'TODO.md', makeConfig(root))).records.length, 2);
  assert.equal((await extractChangelog(root, 'CHANGELOG.md', makeConfig(root))).records.length, 1);
});

test('TODO and CHANGELOG receive audited LLM enrichment without changing structural facts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-md-llm-'));
  await fs.writeFile(path.join(root, 'TODO.md'), '# API\n\n- [x] Obsłużyć kontrakt dla T2C-7.\n');
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## [2.0.0] - 2026-07-29\n\n### Changed\n\n- Obsłużono kontrakt dla T2C-7.\n');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'secret-test-key';
  config.openRouter.markdownModel = 'qwen/test-markdown';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
    const payload = JSON.parse(request.messages[1]?.content ?? '{}') as { records: Array<{ recordId: string; sourceKind: string }> };
    const enrichments = payload.records.map((record) => ({
      recordId: record.recordId,
      actor: record.sourceKind === 'todo' ? 'platform-team' : null,
      action: 'validate',
      object: 'API contract',
      polarity: 'positive',
      confidence: 0.91,
      basis: ['explicit contract requirement'],
      target: { paths: ['src/api.ts'], symbols: ['validateContract'], tickets: ['T2C-7'], versions: [] },
      acceptanceEvidence: ['Contract test passes'],
    }));
    return new Response(JSON.stringify({
      id: 'gen-markdown-1', model: 'qwen/markdown-resolved', provider: 'MarkdownProvider',
      usage: { prompt_tokens: 30, completion_tokens: 15, total_tokens: 45 },
      choices: [{ message: { content: JSON.stringify({ enrichments }) } }],
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const result = await extractMarkdownIntentAudited({ root, todoPath: 'TODO.md', changelogPath: 'CHANGELOG.md' }, config, 'prefer-llm');
    assert.equal(result.audit.status, 'succeeded');
    assert.equal(result.audit.model, 'qwen/test-markdown');
    assert.equal(result.audit.runtimeVersion, T2C_VERSION);
    assert.equal(result.audit.configuration.model, 'qwen/test-markdown');
    assert.equal('apiKey' in result.audit.configuration, false);
    assert.equal(result.audit.responses[0]?.responseId, 'gen-markdown-1');
    assert.equal(result.audit.responses[0]?.provider, 'MarkdownProvider');
    assert.equal(result.audit.responses[0]?.usage?.totalTokens, 45);
    assert.equal(result.records.length, 2);
    const todo = result.records.find((record) => record.source.kind === 'todo');
    const changelog = result.records.find((record) => record.source.kind === 'changelog');
    assert.equal(todo?.lifecycle.status, 'completed');
    assert.equal(todo?.statement.modality, 'required');
    assert.equal(todo?.statement.action, 'validate');
    assert.equal(todo?.metadata.llmUsed, true);
    assert.deepEqual(todo?.metadata.acceptanceEvidence, ['Contract test passes']);
    assert.ok(todo?.statement.target.symbols.includes('validateContract'));
    assert.equal(changelog?.lifecycle.status, 'released');
    assert.equal(changelog?.statement.subject, 'release:2.0.0');
    assert.equal(changelog?.observedAt, '2026-07-29T00:00:00.000Z');
    assert.equal(changelog?.metadata.version, '2.0.0');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TODO and CHANGELOG LLM fallback and require mode are explicit', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-md-fallback-'));
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n\n- [ ] Dodać test.\n');
  const config = makeConfig(root);
  const fallback = await extractMarkdownIntentAudited({ root, todoPath: 'TODO.md', changelogPath: null }, config, 'prefer-llm');
  assert.equal(fallback.audit.status, 'fallback');
  assert.equal(fallback.audit.reason?.code, 'LLM_NOT_CONFIGURED');
  assert.equal(fallback.records[0]?.metadata.llmUsed, false);
  assert.equal((fallback.records[0]?.metadata.generation as { degraded?: boolean }).degraded, true);
  await assert.rejects(
    () => extractMarkdownIntentAudited({ root, todoPath: 'TODO.md', changelogPath: null }, config, 'require-llm'),
    (error: unknown) => error instanceof MarkdownLlmRequiredError && error.audit.reason?.code === 'LLM_NOT_CONFIGURED',
  );
});

test('TODO and CHANGELOG reject structurally invalid LLM enrichments', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-md-invalid-'));
  await fs.writeFile(path.join(root, 'TODO.md'), '# TODO\n\n- [ ] Dodać test.\n');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'secret-test-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ enrichments: [{ recordId: 'wrong', action: 'execute-shell' }] }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const result = await extractMarkdownIntentAudited({ root, todoPath: 'TODO.md', changelogPath: null }, config, 'prefer-llm');
    assert.equal(result.audit.status, 'fallback');
    assert.equal(result.audit.reason?.code, 'LLM_RESPONSE_INVALID');
    assert.equal(result.records[0]?.metadata.llmUsed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
