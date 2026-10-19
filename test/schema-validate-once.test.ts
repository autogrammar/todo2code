import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { assertIntentGraph, intentGraphValidationCount } from '../src/core/schema-intent-validation.js';
import type { IntentGraph, IntentRecord } from '../src/core/types.js';

function makeGraph(): IntentGraph {
  const records: IntentRecord[] = [
    buildRecord({
      kind: 'declared_intent', action: 'add', object: 'validation', text: 'Add validation',
      lifecycle: 'proposed', sourceKind: 'test', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
      extractor: 'test/schema', epistemicClass: 'declaration', confidence: 1, basis: ['fixture'],
    }),
    buildRecord({
      kind: 'declared_intent', action: 'add', object: 'parser', text: 'Add parser',
      lifecycle: 'proposed', sourceKind: 'test', sourcePath: 'TASK.md', sourceLines: { start: 1, end: 1 },
      extractor: 'test/schema', epistemicClass: 'declaration', confidence: 1, basis: ['fixture'],
    }),
  ];
  return linkIntentRecords(records);
}

test('An unchanged graph object is validated once even across repeated assertions', () => {
  const graph = makeGraph();
  const before = intentGraphValidationCount();
  assert.doesNotThrow(() => assertIntentGraph(graph));
  assert.doesNotThrow(() => assertIntentGraph(graph));
  assert.doesNotThrow(() => assertIntentGraph(graph));
  assert.equal(intentGraphValidationCount(), before + 1);
});

test('A structuredClone graph is a different object and is fully validated again', () => {
  const graph = makeGraph();
  assert.doesNotThrow(() => assertIntentGraph(graph));
  const before = intentGraphValidationCount();
  const clone = structuredClone(graph);
  assert.doesNotThrow(() => assertIntentGraph(clone));
  assert.equal(intentGraphValidationCount(), before + 1);
});

test('A mutated fingerprint on an already validated graph is not hidden by the cache', () => {
  const graph = makeGraph();
  assert.doesNotThrow(() => assertIntentGraph(graph));
  graph.fingerprint = '0'.repeat(64);
  assert.throws(() => assertIntentGraph(graph), /fingerprint/);
});

test('Replacing the relations array forces a fresh full validation', () => {
  const graph = makeGraph();
  assert.doesNotThrow(() => assertIntentGraph(graph));
  const before = intentGraphValidationCount();
  graph.relations = [...graph.relations];
  assert.doesNotThrow(() => assertIntentGraph(graph));
  assert.equal(intentGraphValidationCount(), before + 1);
});
