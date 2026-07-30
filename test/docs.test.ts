import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDocumentationBaseline } from '../src/extractors/docs-deterministic.js';
import { makeConfig } from './helpers.js';

test('deterministic documentation baseline records headings, code blocks and explicit references', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-deterministic-'));
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs', 'architecture.md'), [
    '# Runtime architecture',
    '',
    'The validator calls `validateContract` in `src/runtime.ts` for T2C-14.',
    '',
    '```ts',
    'validateContract(input);',
    '```',
  ].join('\n'));

  const result = await extractDocumentationBaseline({
    root,
    files: [path.join(root, 'docs', 'architecture.md')],
  }, makeConfig(root));

  assert.equal(result.warnings.length, 0);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.records.map((record) => record.metadata.documentationOrigin), [
    'heading', 'reference', 'code_block',
  ]);
  assert.ok(result.records.every((record) => record.source.kind === 'document'));
  assert.ok(result.records.every((record) => record.source.extractor === 't2c/markdown-documentation@1'));
  assert.ok(result.records.every((record) => record.metadata.generation.generator === 't2c/markdown-documentation'));
  assert.ok(result.records.every((record) => record.metadata.generation.runtimeVersion === '0.5.0'));
  const reference = result.records[1];
  assert.deepEqual(reference?.statement.target.paths, ['src/runtime.ts']);
  assert.deepEqual(reference?.statement.target.symbols, ['validateContract']);
  assert.deepEqual(reference?.statement.target.tickets, ['T2C-14']);
});
