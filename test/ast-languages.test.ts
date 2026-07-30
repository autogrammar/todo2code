import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { extractAstIntent } from '../src/extractors/ast.js';
import { makeConfig } from './helpers.js';

const execFileAsync = promisify(execFile);
const fixtureRoot = path.resolve('test/fixtures/languages');

async function executableAvailable(executable: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(executable, args, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function languageConfig(root: string) {
  const config = makeConfig(root);
  config.enablePythonAst = false;
  config.enableGoAst = false;
  return config;
}

test('Rust adapter records uses, types, functions, methods, values and calls', async (t) => {
  if (!await executableAvailable('cargo', ['--version'])) return t.skip('Rust toolchain not installed');
  const config = languageConfig(fixtureRoot);
  config.enableRustAst = true;
  const result = await extractAstIntent({ root: fixtureRoot }, config);
  const rust = result.records.filter((record) => record.metadata.language === 'rust');
  const objects = new Set(rust.map((record) => record.statement.object));

  assert.ok(objects.has('std::fmt'), 'use dependency');
  assert.ok(objects.has('MAX_ITEMS'), 'constant');
  assert.ok(objects.has('Entry') && objects.has('Describe'), 'struct and trait');
  assert.ok(objects.has('build') && objects.has('render'), 'functions');
  assert.ok(objects.has('Entry.describe'), 'impl method carries receiver');
  assert.ok(rust.some((record) => record.statement.kind === 'rust_call_fact' && record.statement.object === 'describe'));
  for (const record of rust) {
    assert.equal(record.epistemic.class, 'fact');
    assert.equal(record.epistemic.confidence, 1);
    assert.deepEqual(record.epistemic.basis, ['rust_syn_ast']);
    assert.equal(record.source.extractor, 't2c/rust-syn-ast@1');
    assert.equal(record.metadata.llmUsed, false);
  }
});

test('Java adapter records packages, imports, types, fields, methods and calls', async (t) => {
  if (!await executableAvailable('java', ['-version'])) {
    if (process.env.T2C_REQUIRE_JAVA_TEST === '1') {
      assert.fail('JDK is required by T2C_REQUIRE_JAVA_TEST but java is unavailable');
    }
    return t.skip('JDK not installed');
  }
  const config = languageConfig(fixtureRoot);
  config.enableJavaAst = true;
  const result = await extractAstIntent({ root: fixtureRoot }, config);
  const java = result.records.filter((record) => record.metadata.language === 'java');
  const objects = new Set(java.map((record) => record.statement.object));

  assert.ok(objects.has('demo'), 'package');
  assert.ok(objects.has('java.util.List'), 'import');
  assert.ok(objects.has('Sample'), 'type');
  assert.ok(objects.has('Sample.values'), 'field');
  assert.ok(objects.has('Sample.describe'), 'method');
  assert.ok(java.some((record) => record.statement.kind === 'java_call_fact' && record.statement.object === 'String.join'));
  for (const record of java) {
    assert.equal(record.epistemic.class, 'fact');
    assert.deepEqual(record.epistemic.basis, ['java_compiler_tree_api']);
    assert.equal(record.source.extractor, 't2c/java-compiler-ast@1');
  }
});

test('Java and Rust adapters skip toolchain startup when no matching sources exist', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-language-empty-'));
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export const ok = true;\n');
  const config = languageConfig(root);
  config.enableJavaAst = true;
  config.enableRustAst = true;
  config.javaExecutable = 'missing-java';
  config.cargoExecutable = 'missing-cargo';
  const result = await extractAstIntent({ root }, config);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.records.some((record) => record.source.path === 'runtime.ts'));
});

test('Missing Java and Rust toolchains degrade to explicit warnings', async () => {
  const config = languageConfig(fixtureRoot);
  config.enableJavaAst = true;
  config.enableRustAst = true;
  config.javaExecutable = 'missing-java';
  config.cargoExecutable = 'missing-cargo';
  const result = await extractAstIntent({ root: fixtureRoot }, config);
  assert.equal(result.records.length, 0);
  assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings.some((warning) => warning.startsWith('Java AST extraction failed:')));
  assert.ok(result.warnings.some((warning) => warning.startsWith('Rust AST extraction failed:')));
});
