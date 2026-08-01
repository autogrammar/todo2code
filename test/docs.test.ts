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
  assert.ok(result.records.every((record) => record.source.extractor === 't2c/markdown-documentation@2'));
  assert.ok(result.records.every((record) => record.metadata.generation.generator === 't2c/markdown-documentation'));
  assert.ok(result.records.every((record) => record.metadata.generation.runtimeVersion === '0.5.0'));
  const reference = result.records[1];
  assert.deepEqual(reference?.statement.target.paths, ['src/runtime.ts']);
  assert.deepEqual(reference?.statement.target.symbols, ['validateContract']);
  assert.deepEqual(reference?.statement.target.tickets, ['T2C-14']);
});

test('deterministic documentation preserves Polish prohibition polarity', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-prohibition-'));
  const readme = path.join(root, 'README.md');
  await fs.writeFile(readme, [
    '# Ownership',
    '',
    'Agentowi zabrania się modyfikowania `user-{github_username}.md`.',
    '',
  ].join('\n'));

  const result = await extractDocumentationBaseline({ root, files: [readme] }, makeConfig(root));
  const prohibition = result.records.find((record) => record.metadata.documentationOrigin === 'reference');
  assert.equal(prohibition?.statement.modality, 'required');
  assert.equal(prohibition?.statement.polarity, 'negative');
  assert.deepEqual(prohibition?.statement.target.paths, ['user-{github_username}.md']);
});

test('deterministic documentation resolves a unique bare filename against the repository', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-path-resolution-'));
  const docs = path.join(root, 'docs');
  const readme = path.join(root, 'README.md');
  await fs.mkdir(docs, { recursive: true });
  await fs.writeFile(path.join(docs, 'ARCHITECTURE.md'), '# Architecture\n');
  await fs.writeFile(readme, [
    '# Documentation',
    '',
    '- Keep ARCHITECTURE.md synchronized with the implemented module boundaries.',
    '',
  ].join('\n'));

  const result = await extractDocumentationBaseline({ root, files: [readme] }, makeConfig(root));
  const statement = result.records.find((record) => record.metadata.documentationOrigin === 'reference');
  assert.deepEqual(statement?.statement.target.paths, ['docs/ARCHITECTURE.md']);
});

test('documentation prose resolves a bare filename to its repository location', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-path-'));
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs', 'ARCHITECTURE.md'), '# Architecture\n');
  await fs.writeFile(path.join(root, 'README.md'), [
    '# Overview',
    '',
    'The decision loop is described in `ARCHITECTURE.md` for every component.',
  ].join('\n'));

  const result = await extractDocumentationBaseline({
    root,
    files: [path.join(root, 'README.md')],
  }, makeConfig(root));

  const reference = result.records.find((record) => record.metadata.documentationOrigin === 'reference');
  assert.deepEqual(reference?.statement.target.paths, ['docs/ARCHITECTURE.md']);
});

test('a nested checkout does not shadow the repository copy of a documented file', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-worktree-'));
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs', 'COMPONENTS.md'), '# Components\n');
  // An agent worktree carries a full copy of the tree. Indexing it would make
  // every basename ambiguous and block resolution repository-wide.
  const worktree = path.join(root, '.claude', 'worktrees', 'agent-1', 'docs');
  await fs.mkdir(worktree, { recursive: true });
  await fs.writeFile(path.join(root, '.claude', 'worktrees', 'agent-1', '.git'), 'gitdir: /elsewhere\n');
  await fs.writeFile(path.join(worktree, 'COMPONENTS.md'), '# Components\n');
  await fs.writeFile(path.join(root, 'README.md'), [
    '# Overview',
    '',
    'Every runtime component is catalogued in `COMPONENTS.md` before release.',
  ].join('\n'));

  const result = await extractDocumentationBaseline({
    root,
    files: [path.join(root, 'README.md')],
  }, makeConfig(root));

  const reference = result.records.find((record) => record.metadata.documentationOrigin === 'reference');
  assert.deepEqual(reference?.statement.target.paths, ['docs/COMPONENTS.md']);
});
