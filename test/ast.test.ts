import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractAstIntent } from '../src/extractors/ast.js';
import { makeConfig } from './helpers.js';

test('AST extractor reads TypeScript and Python facts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-ast-'));
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export function validateContract(): void {}\nexport function execute(): void { validateContract(); }\n');
  await fs.writeFile(path.join(root, 'helper.py'), 'def normalize(value: str) -> str:\n    return value.strip()\n');
  await fs.mkdir(path.join(root, 'generated'), { recursive: true });
  await fs.mkdir(path.join(root, 'venv'), { recursive: true });
  await fs.writeFile(path.join(root, '.gitignore'), 'generated/\n');
  await fs.writeFile(path.join(root, 'generated', 'ignored.ts'), 'export const ignored = true;\n');
  await fs.writeFile(path.join(root, 'venv', 'bundled.js'), 'export const bundled = true;\n');
  const result = await extractAstIntent({ root }, makeConfig(root));
  assert.ok(result.records.some((record) => record.source.path === 'runtime.ts' && record.source.symbol === 'validateContract'));
  assert.ok(result.records.some((record) => record.statement.kind === 'call_fact' && record.statement.object === 'validateContract'));
  assert.ok(result.records.some((record) => record.source.path === 'helper.py' && record.source.symbol === 'normalize'));
  assert.equal(result.records.filter((record) => record.statement.kind === 'module_fact').length, 2);
  assert.ok(result.records.some((record) => record.statement.kind === 'module_fact'
    && record.source.path === 'runtime.ts' && record.metadata.factGranularity === 'file'));
  const runtimeModule = result.records.find((record) => record.statement.kind === 'module_fact'
    && record.source.path === 'runtime.ts');
  assert.deepEqual(runtimeModule?.metadata.capabilities, ['execute', 'validateContract']);
  assert.match(runtimeModule?.statement.text ?? '', /validateContract/);
  assert.ok(!result.records.some((record) => record.source.path === 'generated/ignored.ts'));
  assert.ok(!result.records.some((record) => record.source.path === 'venv/bundled.js'));
  assert.ok(result.records.every((record) => record.epistemic.class === 'fact'));
});
