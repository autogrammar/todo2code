import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractConfigurationIntent } from '../src/extractors/configuration.js';
import { makeConfig } from './helpers.js';

test('configuration converter covers JSON, TOML, Docker and CI workflow declarations', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-configuration-'));
  await fs.mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"fixture","scripts":{"test":"node --test"},"dependencies":{"x":"1"}}\n');
  await fs.writeFile(path.join(root, 'pyproject.toml'), '[project]\nname = "fixture"\n');
  await fs.writeFile(path.join(root, 'Dockerfile'), 'FROM node:22\nRUN npm test\n');
  await fs.writeFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: ci\njobs:\n  test:\n    runs-on: ubuntu-latest\n');
  await fs.writeFile(
    path.join(root, '.intentignore'),
    '.*/\n!.github/\n.github/*\n!.github/workflows/\n',
  );

  const result = await extractConfigurationIntent(root, makeConfig(root));
  assert.equal(result.warnings.length, 0);
  const aggregates = result.records.filter((record) => record.statement.kind === 'configuration_file_fact');
  assert.equal(aggregates.length, 4, 'every discovered configuration file has one aggregate');
  const packageAggregate = aggregates.find((record) => record.source.path === 'package.json');
  assert.ok(packageAggregate);
  assert.equal(packageAggregate.statement.object, 'package.json');
  assert.deepEqual(packageAggregate.statement.target.paths, ['package.json']);
  assert.equal(packageAggregate.metadata.aggregate, 'configuration-file');
  assert.deepEqual(packageAggregate.metadata.capabilities, ['dependencies', 'name', 'scripts']);
  assert.equal(packageAggregate.metadata.declaredKeys, 3);
  assert.equal(packageAggregate.metadata.format, 'json');
  const dockerAggregate = aggregates.find((record) => record.source.path === 'Dockerfile');
  assert.equal(dockerAggregate?.metadata.format, 'dockerfile');
  assert.ok(result.records.some((record) => record.source.path === 'package.json' && record.statement.object === 'scripts'));
  assert.ok(result.records.some((record) => record.source.path === 'pyproject.toml' && record.statement.object === 'project.name'));
  assert.ok(result.records.some((record) => record.source.path === 'Dockerfile' && record.statement.action === 'depend_on'));
  assert.ok(result.records.some((record) => record.source.path === '.github/workflows/ci.yml' && record.statement.object === 'runs-on'));
  assert.ok(result.records.every((record) => record.source.kind === 'system'));
  assert.ok(result.records.every((record) => record.metadata.generation.generator === 't2c/configuration-structural'));
});

test('configuration converter emits a deterministic file aggregate for an empty configuration', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-configuration-empty-'));
  await fs.writeFile(path.join(root, 'package.json'), '{}\n');

  const first = await extractConfigurationIntent(root, makeConfig(root));
  const second = await extractConfigurationIntent(root, makeConfig(root));
  assert.equal(first.records.length, 1);
  assert.equal(first.records[0]?.statement.kind, 'configuration_file_fact');
  assert.equal(first.records[0]?.metadata.declaredKeys, 0);
  assert.deepEqual(first.records, second.records);
});

test('explicit configuration inputs retain canonical paths and operator ignore rules', async t => {
  const { config2dsl } = await import('../src/extractors/configuration.js');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-configuration-explicit-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  await fs.mkdir(path.join(root, 'project', 'ticket-001'), {recursive: true});
  const name = 'project/ticket-001/intent.json';
  await fs.writeFile(path.join(root, name), '{"allowedPaths":["src/auth.py"],"workstream":"runtime"}\n');
  await fs.writeFile(path.join(root, 'private.json'), '{"secret":"not evidence"}\n');
  await fs.writeFile(path.join(root, '.intentignore'), 'private.json\n');
  assert.equal((await config2dsl({root}, makeConfig(root))).records.length, 0);
  const result = await config2dsl({root, paths: [name, 'private.json', name]}, makeConfig(root));
  assert.deepEqual([...new Set(result.records.map(r => r.source.path))], [name]);
  assert.equal(result.records.filter(r => r.statement.kind === 'configuration_file_fact').length, 1);
  assert.ok(result.records.some(r => r.source.symbol === 'allowedPaths'));
  assert.ok(result.records.every(r => r.source.extractor === 't2c/configuration-structural@1'));
  assert.equal(result.warnings.length, 0);
});

test('explicit configuration paths reject invalid boundaries before discovery', async () => {
  const { config2dsl } = await import('../src/extractors/configuration.js');
  for (const name of ['../outside.json', '/tmp/outside.json', 'a/../b.json', 'a\\b.json', 'a//b.json', './b.json', 'file.py', 'a\n.json']) {
    await assert.rejects(config2dsl({root: '/unused', paths: [name]}, makeConfig('/unused')), /config2dsl_path_invalid/);
  }
  await assert.rejects(config2dsl({root: '/unused', paths: Array(20_001).fill('a.json')}, makeConfig('/unused')), /config2dsl_paths_invalid/);
});
