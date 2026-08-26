import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDocumentationBaseline } from '../src/extractors/docs-deterministic.js';
import { T2C_VERSION } from '../src/version.js';
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
  assert.ok(result.records.every((record) => record.metadata.generation.runtimeVersion === T2C_VERSION));
  const reference = result.records[1];
  assert.deepEqual(reference?.statement.target.paths, ['src/runtime.ts']);
  assert.deepEqual(reference?.statement.target.symbols, ['validateContract']);
  assert.deepEqual(reference?.statement.target.tickets, ['T2C-14']);
});

test('governed ticket documentation keeps acceptance criteria local to its source ticket', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-ticket-scope-'));
  const first = path.join(root, 'project', 'ticket-101', 'README.md');
  const second = path.join(root, 'project', 'ticket-102', 'README.md');
  await fs.mkdir(path.dirname(first), { recursive: true });
  await fs.mkdir(path.dirname(second), { recursive: true });
  await fs.writeFile(first, [
    '# Ticket 101: First repair',
    '',
    '- [ ] AC-01: Update `src/first.ts` without changing the public contract.',
    '- [ ] AC-02: Keep the evidence requested by PLF-8016 for independent review.',
  ].join('\n'));
  await fs.writeFile(second, [
    '# Ticket 102: Second repair',
    '',
    '- [ ] AC-01: Update `src/second.ts` without changing the public contract.',
  ].join('\n'));

  const result = await extractDocumentationBaseline({ root, files: [first, second] }, makeConfig(root));
  const firstCriterion = result.records.find((record) => record.statement.target.paths.includes('src/first.ts'));
  const secondCriterion = result.records.find((record) => record.statement.target.paths.includes('src/second.ts'));
  const explicitReference = result.records.find((record) => record.statement.text.includes('PLF-8016'));

  assert.deepEqual(firstCriterion?.statement.target.tickets, ['TICKET-101']);
  assert.deepEqual(secondCriterion?.statement.target.tickets, ['TICKET-102']);
  assert.deepEqual(explicitReference?.statement.target.tickets, ['PLF-8016']);
  assert.ok(result.records
    .filter((record) => (record.source.path ?? '').startsWith('project/ticket-'))
    .every((record) => !record.statement.target.tickets.includes('AC-01')));
});

test('governed participant communication is not duplicated as documentation', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-participant-boundary-'));
  const ticket = path.join(root, 'project', 'ticket-118');
  const participant = path.join(ticket, 'ai-codex.md');
  const readme = path.join(ticket, 'README.md');
  await fs.mkdir(ticket, { recursive: true });
  await fs.writeFile(participant, [
    '---',
    'participant-id: agent:codex',
    'participant: codex',
    'role: agent',
    'ticket: ticket-118',
    '---',
    '# Participant',
    '',
    'Control must reject transport authority and must not bypass `subactor`.',
  ].join('\n'));
  await fs.writeFile(readme, [
    '# Ticket 118',
    '',
    '- Control must reject transport authority in `config/adopt.json`.',
  ].join('\n'));

  const result = await extractDocumentationBaseline({
    root,
    files: [participant, readme],
  }, makeConfig(root));

  assert.equal(result.warnings.length, 0);
  assert.ok(result.records.length > 0);
  assert.ok(result.records.every((record) => record.source.path === 'project/ticket-118/README.md'));
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
