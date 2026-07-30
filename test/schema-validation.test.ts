import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { assertIntentGraph, assertIntentRecord } from '../src/core/schema.js';
import type { IntentRecord } from '../src/core/types.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { executeAction } from '../src/services/actions.js';
import { T2C_VERSION } from '../src/version.js';
import { makeConfig } from './helpers.js';

function validRecord(): IntentRecord {
  return buildRecord({
    kind: 'declared_intent', action: 'add', object: 'validation', text: 'Add validation',
    lifecycle: 'proposed', sourceKind: 'test', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
    extractor: 'test/schema', epistemicClass: 'declaration', confidence: 1, basis: ['fixture'],
  });
}

test('Runtime validator enforces the complete Intent DSL enum and object contract', () => {
  const valid = validRecord();
  assert.doesNotThrow(() => assertIntentRecord(valid));
  assert.deepEqual(valid.metadata.generation, {
    generator: 'test/schema', generatorVersion: T2C_VERSION, runtimeVersion: T2C_VERSION,
    requested: 'deterministic', used: 'deterministic', degraded: false, fallbackReason: null,
    provider: null, model: null, responseId: null,
  });

  const invalidAction = structuredClone(valid) as IntentRecord;
  invalidAction.statement.action = 'not-in-dsl' as IntentRecord['statement']['action'];
  assert.throws(() => assertIntentRecord(invalidAction), /statement\.action has unsupported value/);

  const invalidLifecycle = structuredClone(valid) as IntentRecord;
  invalidLifecycle.lifecycle.status = 'made-up' as IntentRecord['lifecycle']['status'];
  assert.throws(() => assertIntentRecord(invalidLifecycle), /lifecycle\.status has unsupported value/);

  const invalidLines = structuredClone(valid);
  invalidLines.source.lines = { start: 4, end: 2 };
  assert.throws(() => assertIntentRecord(invalidLines), /end >= start/);

  const extraField = structuredClone(valid) as IntentRecord & { injected?: boolean };
  extraField.injected = true;
  assert.throws(() => assertIntentRecord(extraField), /unsupported fields: injected/);

  const missingGeneration = structuredClone(valid) as IntentRecord;
  delete (missingGeneration.metadata as Partial<IntentRecord['metadata']>).generation;
  assert.throws(() => assertIntentRecord(missingGeneration), /metadata\.generation must be an object/);

  const anonymousLlm = structuredClone(valid);
  anonymousLlm.metadata.generation.used = 'llm';
  anonymousLlm.metadata.generation.requested = 'llm';
  assert.throws(() => assertIntentRecord(anonymousLlm), /metadata\.generation\.provider must be a non-blank string/);

  const falseLlmClaim = structuredClone(valid);
  falseLlmClaim.metadata.generation.model = 'qwen/example';
  assert.throws(() => assertIntentRecord(falseLlmClaim), /deterministic generation cannot claim an LLM/);

  const mismatchedGenerator = structuredClone(valid);
  mismatchedGenerator.metadata.generation.generator = 'different/converter';
  assert.throws(() => assertIntentRecord(mismatchedGenerator), /generator must match source\.extractor/);
});

test('Linker and remote action boundary reject malformed records before graph construction', async () => {
  const malformed = structuredClone(validRecord()) as IntentRecord;
  malformed.statement.modality = 'invalid' as IntentRecord['statement']['modality'];

  assert.throws(() => linkIntentRecords([malformed]), /statement\.modality has unsupported value/);
  await assert.rejects(
    executeAction('link', { records: [malformed] }, makeConfig(process.cwd())),
    /statement\.modality has unsupported value/,
  );
});

test('Graph validator rejects invalid relations and inconsistent statistics', () => {
  const graph = linkIntentRecords([validRecord()], '2026-07-29T00:00:00.000Z');
  assert.doesNotThrow(() => assertIntentGraph(graph));

  const invalidStats = structuredClone(graph);
  invalidStats.stats.byAction.add = 2;
  assert.throws(() => assertIntentGraph(invalidStats), /inconsistent for add/);

  const invalidFingerprint = structuredClone(graph);
  invalidFingerprint.fingerprint = '0'.repeat(64);
  assert.throws(() => assertIntentGraph(invalidFingerprint), /fingerprint does not match/);

  const unknownEndpoint = structuredClone(graph);
  unknownEndpoint.relations.push({
    id: 'REL-00000000000000000000', from: graph.records[0]!.id, to: 'INT-TEST-00000000000000000000',
    type: 'related_to', confidence: 0.5, basis: ['fixture'],
  });
  assert.throws(() => assertIntentGraph(unknownEndpoint), /references unknown records/);
});
