import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord, type BuildRecordInput } from '../src/core/record.js';
import { canonicalRepositoryRoot } from '../src/core/repository-scope.js';

const LEGACY_ID = 'INT-AST-21cb3d8272a85f508a57';

function recordInput(overrides: Partial<BuildRecordInput> = {}): BuildRecordInput {
  return {
    kind: 'implemented_symbol',
    action: 'declare',
    object: 'validateContract',
    text: 'declare validateContract',
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: 'src/runtime.ts',
    sourceLines: { start: 2, end: 4 },
    symbol: 'validateContract',
    extractor: 'test/repository-scope@1',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['fixture'],
    metadata: { language: 'typescript' },
    ...overrides,
  };
}

test('repository-qualified records have deterministic collision-free identity', () => {
  const firstCore = buildRecord(recordInput({ repositoryRoot: 'core' }));
  const secondCore = buildRecord(recordInput({ repositoryRoot: 'core' }));
  const docs = buildRecord(recordInput({ repositoryRoot: 'docs' }));

  assert.equal(firstCore.id, secondCore.id);
  assert.notEqual(firstCore.id, docs.id);
  assert.equal(firstCore.metadata.repositoryRoot, 'core');
  assert.equal(docs.metadata.repositoryRoot, 'docs');
  assert.equal(firstCore.source.path, docs.source.path);
});

test('omitted repository provenance preserves legacy identity and metadata', () => {
  const legacy = buildRecord(recordInput());
  const repeatedLegacy = buildRecord(recordInput());
  const existingMetadata = buildRecord(recordInput({
    metadata: { language: 'typescript', repositoryRoot: '.' },
  }));

  assert.equal(legacy.id, LEGACY_ID);
  assert.deepEqual(repeatedLegacy, legacy);
  assert.equal(legacy.metadata.repositoryRoot, undefined);
  assert.equal(existingMetadata.id, LEGACY_ID);
  assert.equal(existingMetadata.metadata.repositoryRoot, '.');
});

test('trusted repository provenance overrides an untrusted metadata claim', () => {
  const record = buildRecord(recordInput({
    repositoryRoot: 'docs',
    metadata: { repositoryRoot: 'core' },
  }));

  assert.equal(record.metadata.repositoryRoot, 'docs');
});

test('repository aliases are canonical and unsafe or ambiguous roots fail closed', () => {
  assert.equal(canonicalRepositoryRoot('.'), '.');
  assert.equal(canonicalRepositoryRoot('packages/core'), 'packages/core');
  assert.equal(canonicalRepositoryRoot('cafe\u0301'), 'caf\u00e9');

  for (const repositoryRoot of [
    '', ' ', ' core', 'core ', '/core', 'C:/core', './core', 'core/.',
    '..', 'core/../docs', 'core/', 'core//docs', 'core\\docs', 'core\u0000docs',
  ]) {
    assert.throws(
      () => buildRecord(recordInput({ repositoryRoot })),
      /repositoryRoot/,
      repositoryRoot,
    );
  }
});
