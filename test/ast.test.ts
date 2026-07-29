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
  const result = await extractAstIntent({ root }, makeConfig(root));
  assert.ok(result.records.some((record) => record.source.path === 'runtime.ts' && record.source.symbol === 'validateContract'));
  assert.ok(result.records.some((record) => record.statement.kind === 'call_fact' && record.statement.object === 'validateContract'));
  assert.ok(result.records.some((record) => record.source.path === 'helper.py' && record.source.symbol === 'normalize'));
  assert.ok(result.records.every((record) => record.epistemic.class === 'fact'));
});
