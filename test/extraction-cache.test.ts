import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractAstIntent } from '../src/extractors/ast.js';
import { extractDocumentationIntent } from '../src/extractors/docs-llm.js';
import { makeConfig } from './helpers.js';

function typescriptOnlyConfig(root: string) {
  const config = makeConfig(root);
  config.enablePythonAst = false;
  config.enableGoAst = false;
  config.enableJavaAst = false;
  config.enableRustAst = false;
  return config;
}

test('AST cache is incremental by path and source content hash', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cache-ast-'));
  const sourcePath = path.join(root, 'runtime.ts');
  await fs.writeFile(sourcePath, 'export function first(): void {}\n', 'utf8');
  const config = typescriptOnlyConfig(root);

  const cold = await extractAstIntent({ root }, config);
  const warm = await extractAstIntent({ root }, config);
  assert.deepEqual(cold.cache, { hits: 0, misses: 1, writes: 1, recoveries: 0, errors: 0, bypassed: 0 });
  assert.deepEqual(warm.cache, { hits: 1, misses: 0, writes: 0, recoveries: 0, errors: 0, bypassed: 0 });
  assert.deepEqual(warm.records, cold.records);
  assert.deepEqual(warm.warnings, cold.warnings);

  await fs.writeFile(sourcePath, 'export function second(): void {}\n', 'utf8');
  const changed = await extractAstIntent({ root }, config);
  assert.equal(changed.cache.misses, 1);
  assert.equal(changed.cache.hits, 0);
  assert.ok(changed.records.some((record) => record.source.symbol === 'second'));
  assert.ok(!changed.records.some((record) => record.source.symbol === 'first'));
});

test('AST cache rejects corrupt entries and recomputes authoritative records', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cache-corrupt-'));
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export const stable = (): boolean => true;\n', 'utf8');
  const config = typescriptOnlyConfig(root);
  const cold = await extractAstIntent({ root }, config);
  const cacheDirectory = path.join(root, '.intent', 'cache', 'v1', 'ast-typescript-v1');
  const [entry] = await fs.readdir(cacheDirectory);
  assert.ok(entry);
  await fs.writeFile(path.join(cacheDirectory, entry), '{broken json\n', 'utf8');

  const recovered = await extractAstIntent({ root }, config);
  assert.deepEqual(recovered.records, cold.records);
  assert.equal(recovered.cache.recoveries, 1);
  assert.equal(recovered.cache.misses, 1);
  assert.equal(recovered.cache.writes, 1);
  assert.equal(recovered.cache.errors, 0);
});

test('AST cache can be bypassed without changing extraction output', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cache-disabled-'));
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export const direct = 1;\n', 'utf8');
  const config = typescriptOnlyConfig(root);
  config.cacheEnabled = false;

  const first = await extractAstIntent({ root }, config);
  const second = await extractAstIntent({ root }, config);
  assert.deepEqual(second.records, first.records);
  assert.equal(first.cache.bypassed, 1);
  await assert.rejects(fs.access(path.join(root, '.intent', 'cache')), { code: 'ENOENT' });
});

test('successful external AST adapter is skipped on a warm manifest hit', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cache-python-'));
  const counterPath = path.join(root, 'python-starts.txt');
  const executablePath = path.join(root, 'counted-python');
  await fs.writeFile(path.join(root, 'worker.py'), 'def execute() -> None:\n    pass\n', 'utf8');
  await fs.writeFile(executablePath, [
    '#!/bin/sh',
    `printf x >> '${counterPath}'`,
    "exec python3 \"$@\"",
    '',
  ].join('\n'), 'utf8');
  await fs.chmod(executablePath, 0o755);
  const config = typescriptOnlyConfig(root);
  config.enablePythonAst = true;
  config.pythonExecutable = executablePath;

  const cold = await extractAstIntent({ root }, config);
  const warm = await extractAstIntent({ root }, config);
  assert.ok(cold.records.some((record) => record.metadata.language === 'python'));
  assert.deepEqual(warm.records, cold.records);
  assert.equal(cold.cache.misses, 1);
  assert.equal(warm.cache.hits, 1);
  assert.equal(await fs.readFile(counterPath, 'utf8'), 'x');
});

test('documentation chunks cache independently while provider calls remain live', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-cache-docs-'));
  await fs.mkdir(path.join(root, 'docs'));
  const documentPath = path.join(root, 'docs', 'runtime.md');
  await fs.writeFile(documentPath, '# Runtime\n\nValidate before execution.\n', 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'test-key';
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
    const cold = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    const warm = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    assert.equal(cold.cache.misses, 1);
    assert.equal(cold.cache.writes, 1);
    assert.equal(warm.cache.hits, 1);
    assert.equal(calls, 2, 'chunk cache must not cache provider responses');

    await fs.writeFile(documentPath, '# Runtime\n\nValidate and authorize before execution.\n', 'utf8');
    const changed = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    assert.equal(changed.cache.misses, 1);
    assert.equal(changed.cache.hits, 0);

    config.documentChunkChars = 1024;
    const rechunked = await extractDocumentationIntent({ root, patterns: ['docs/**/*.md'], excludes: [] }, config);
    assert.equal(rechunked.cache.misses, 1, 'chunk-size changes invalidate the cache key');
    assert.equal(calls, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
