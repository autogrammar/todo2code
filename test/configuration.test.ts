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
