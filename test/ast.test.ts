import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { extractAstIntent } from '../src/extractors/ast.js';
import { diagnoseGraph } from '../src/graph/diagnostics.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { makeConfig } from './helpers.js';

test('AST extractor reads TypeScript and Python facts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-ast-'));
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export function validateContract(): void {}\nexport function execute(): void { validateContract(); }\n');
  await fs.writeFile(path.join(root, 'helper.py'), [
    'DEFAULT_BATCH_SIZE: int = 50',
    'class Settings:',
    '    DEFAULT_LSH_MIN_LINES: int = 50',
    'def normalize(value: str) -> str:',
    '    LOCAL_LIMIT = 50',
    '    return value.strip()',
    'if __name__ == "__main__":',
    '    normalize(" value ")',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(root, 'legacy.php'), '<?php function legacy_handler() { return true; }\n');
  await fs.mkdir(path.join(root, 'generated'), { recursive: true });
  await fs.mkdir(path.join(root, 'venv'), { recursive: true });
  await fs.writeFile(path.join(root, '.gitignore'), 'generated/\n');
  await fs.writeFile(path.join(root, 'generated', 'ignored.ts'), 'export const ignored = true;\n');
  await fs.writeFile(path.join(root, 'generated', 'ignored.py'), 'def ignored_python() -> None:\n    pass\n');
  await fs.writeFile(path.join(root, 'venv', 'bundled.js'), 'export const bundled = true;\n');
  const config = makeConfig(root);
  config.enablePhpAst = false;
  const result = await extractAstIntent({ root }, config);
  assert.ok(result.records.some((record) => record.source.path === 'runtime.ts' && record.source.symbol === 'validateContract'));
  assert.ok(result.records.some((record) => record.statement.kind === 'call_fact' && record.statement.object === 'validateContract'));
  assert.ok(result.records.some((record) => record.source.path === 'helper.py' && record.source.symbol === 'normalize'));
  const constants = result.records.filter((record) => record.statement.kind === 'python_constant_fact');
  assert.deepEqual(constants.map((record) => record.source.symbol).sort(), [
    'DEFAULT_BATCH_SIZE',
    'DEFAULT_LSH_MIN_LINES',
  ]);
  assert.ok(constants.every((record) => record.statement.object === 'named constant 50'));
  assert.ok(constants.every((record) => record.metadata.symbolKind === 'constant'));
  assert.ok(!result.records.some((record) => record.source.symbol === 'LOCAL_LIMIT'));
  assert.ok(result.records.some((record) => record.statement.kind === 'python_module_entrypoint_fact'
    && record.statement.object === 'module execution'));
  assert.equal(result.records.filter((record) => record.statement.kind === 'module_fact').length, 2);
  assert.ok(result.records.some((record) => record.statement.kind === 'module_fact'
    && record.source.path === 'runtime.ts' && record.metadata.factGranularity === 'file'));
  const runtimeModule = result.records.find((record) => record.statement.kind === 'module_fact'
    && record.source.path === 'runtime.ts');
  assert.deepEqual(runtimeModule?.metadata.capabilities, ['execute', 'validateContract']);
  const pythonModule = result.records.find((record) => record.statement.kind === 'module_fact'
    && record.source.path === 'helper.py');
  assert.ok((pythonModule?.metadata.capabilities as string[] | undefined)?.includes('DEFAULT_BATCH_SIZE'));
  assert.ok((pythonModule?.metadata.capabilities as string[] | undefined)?.includes('DEFAULT_LSH_MIN_LINES'));
  const constantPlan = buildRecord({
    kind: 'todo_item', action: 'unknown', object: 'helper.py:2 - Magic number: 50 - use named constant',
    target: { paths: ['helper.py'] }, text: 'helper.py:2 - Magic number: 50 - use named constant',
    lifecycle: 'planned', sourceKind: 'todo', sourcePath: 'TODO.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test', epistemicClass: 'plan', confidence: 1, basis: ['fixture'],
  });
  const constantGraph = linkIntentRecords([...result.records, constantPlan]);
  assert.ok(constantGraph.relations.some((relation) => relation.from === constantPlan.id
    && relation.basis.includes('shared_path')
    && relation.basis.some((item) => item.startsWith('text_similarity:'))));
  assert.ok(!diagnoseGraph(constantGraph).diagnostics.some((diagnostic) =>
    diagnostic.code === 'PLANNED_NOT_IMPLEMENTED' && diagnostic.recordIds.includes(constantPlan.id)));
  assert.match(runtimeModule?.statement.text ?? '', /validateContract/);
  assert.ok(!result.records.some((record) => record.source.path === 'generated/ignored.ts'));
  assert.ok(!result.records.some((record) => record.source.path === 'generated/ignored.py'));
  assert.ok(!result.records.some((record) => record.source.path === 'venv/bundled.js'));
  assert.ok(result.records.every((record) => record.epistemic.class === 'fact'));
  assert.match(result.warnings.join('\n'), /UNSUPPORTED_AST_FILES: php=1/);
});
