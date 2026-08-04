import assert from 'node:assert/strict';
import test from 'node:test';
import { createRelationId, graphFingerprint } from '../src/core/id.js';
import { buildRecord } from '../src/core/record.js';
import {
  assertTruthMap,
  projectTruthMap,
  type TruthMap,
} from '../src/core/truth-map.js';
import { T2C_VERSION } from '../src/core/version.js';
import type {
  EpistemicClass,
  IntentGraph,
  IntentRecord,
  IntentRelation,
  RelationType,
  SourceKind,
} from '../src/core/types.js';

const CREATED_AT = '2026-08-04T20:00:00.000Z';

function record(
  name: string,
  epistemicClass: EpistemicClass,
  sourceKind: SourceKind,
): IntentRecord {
  return buildRecord({
    kind: `${name}_statement`,
    action: epistemicClass === 'fact' ? 'declare' : 'add',
    object: name,
    target: { paths: [`src/${name}.ts`], symbols: [name] },
    text: `${name} evidence`,
    lifecycle: epistemicClass === 'fact' ? 'implemented' : 'planned',
    sourceKind,
    sourcePath: sourceKind === 'git' ? null : `${sourceKind}/${name}.md`,
    revision: sourceKind === 'git' ? 'a'.repeat(40) : null,
    commitIndex: sourceKind === 'git' ? 3 : null,
    extractor: `test/${sourceKind}@1`,
    epistemicClass,
    confidence: 1,
    basis: ['fixture'],
    ...(epistemicClass === 'llm_inference'
      ? { generation: { used: 'llm' as const, provider: 'fixture', model: 'fixture/model' } }
      : {}),
  });
}

function relation(from: IntentRecord, to: IntentRecord, type: RelationType): IntentRelation {
  const value = { from: from.id, to: to.id, type, confidence: 1, basis: ['fixture'] };
  return { id: createRelationId(value), ...value };
}

function graph(records: IntentRecord[], relations: IntentRelation[]): IntentGraph {
  const sortedRecords = [...records].sort((left, right) => left.id.localeCompare(right.id));
  const sortedRelations = [...relations].sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: 't2c.graph/v1',
    generatedAt: CREATED_AT,
    fingerprint: graphFingerprint(sortedRecords, sortedRelations),
    records: sortedRecords,
    relations: sortedRelations,
    stats: {
      bySource: counts(sortedRecords, (item) => item.source.kind),
      byAction: counts(sortedRecords, (item) => item.statement.action),
      byStatus: counts(sortedRecords, (item) => item.lifecycle.status),
    },
  };
}

function counts<T>(values: T[], key: (value: T) => string): Record<string, number> {
  const output: Record<string, number> = {};
  for (const value of values) output[key(value)] = (output[key(value)] ?? 0) + 1;
  return output;
}

test('truth map groups explicit semantic evidence and preserves complete lineage', () => {
  const declaration = record('validator', 'declaration', 'nl');
  const claim = record('validator-claim', 'claim', 'git');
  const fact = record('validator-fact', 'fact', 'ast');
  const mappings = [
    relation(declaration, claim, 'claimed_by'),
    relation(claim, fact, 'evidenced_by'),
  ];
  const sourceGraph = graph([declaration, claim, fact], mappings);

  const result = projectTruthMap(sourceGraph, '2026-08-04T21:00:00.000Z');

  assert.equal(result.schemaVersion, 't2c.truth-map/v1');
  assert.equal(result.graphFingerprint, sourceGraph.fingerprint);
  assert.equal(result.assertions.length, 1);
  const assertion = result.assertions[0];
  assert.ok(assertion);
  assert.equal(assertion.status, 'supported');
  assert.deepEqual(assertion.recordIds, [claim.id, declaration.id, fact.id].sort());
  assert.deepEqual(assertion.relationIds, mappings.map((item) => item.id).sort());
  assert.deepEqual(assertion.evidence.declared, [declaration.id]);
  assert.deepEqual(assertion.evidence.observed, [fact.id]);
  assert.deepEqual(assertion.evidence.claimed, [claim.id]);
  assert.deepEqual(assertion.sources.map((source) => source.recordId), assertion.recordIds);
  assert.equal(assertion.sources.find((source) => source.recordId === claim.id)?.revision, 'a'.repeat(40));
  assert.equal(assertion.sources.find((source) => source.recordId === claim.id)?.commitIndex, 3);
  assert.equal(assertion.sources[0]?.generation.runtimeVersion, T2C_VERSION);
  for (const recordId of assertion.recordIds) assert.equal(result.recordToAssertion[recordId], assertion.id);
  assertTruthMap(result, sourceGraph);
});

test('structural relations do not collapse independent assertions', () => {
  const left = record('left', 'declaration', 'todo');
  const middle = record('middle', 'fact', 'ast');
  const right = record('right', 'claim', 'git');
  const structural = [
    relation(left, middle, 'depends_on'),
    relation(middle, right, 'blocks'),
    relation(left, right, 'related_to'),
  ];
  const result = projectTruthMap(graph([left, middle, right], structural));

  assert.equal(result.assertions.length, 3);
  assert.deepEqual(result.assertions.map((item) => item.status).sort(), [
    'claimed_only', 'declared_only', 'observed_only',
  ]);
  assert.ok(result.assertions.every((item) => item.relationIds.length === 0));
});

test('explicit contradiction is visible and never selects a winner', () => {
  const required = record('required', 'declaration', 'todo');
  const forbidden = record('forbidden', 'declaration', 'document');
  const contradiction = relation(required, forbidden, 'contradicts');
  const result = projectTruthMap(graph([required, forbidden], [contradiction]));

  assert.equal(result.assertions.length, 1);
  assert.equal(result.assertions[0]?.status, 'conflicted');
  assert.deepEqual(result.assertions[0]?.relationIds, [contradiction.id]);
});

test('mixed claims remain distinct from factual support', () => {
  const declaration = record('intent', 'plan', 'todo');
  const claim = record('report', 'llm_inference', 'agent_log');
  const result = projectTruthMap(graph(
    [declaration, claim],
    [relation(declaration, claim, 'claimed_by')],
  ));

  assert.equal(result.assertions[0]?.status, 'mixed');
  assert.deepEqual(result.assertions[0]?.evidence.observed, []);
});

test('IDs and fingerprints are invariant to graph ordering and generatedAt', () => {
  const declaration = record('order-intent', 'declaration', 'nl');
  const fact = record('order-fact', 'fact', 'test');
  const mapping = relation(declaration, fact, 'tests');
  const ordered = graph([declaration, fact], [mapping]);
  const reversed = graph([fact, declaration], [mapping]);
  reversed.records.reverse();
  reversed.relations.reverse();

  const first = projectTruthMap(ordered, '2026-08-04T21:00:00.000Z');
  const second = projectTruthMap(reversed, '2026-08-05T09:00:00.000Z');

  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.assertions, second.assertions);
  assert.deepEqual(first.recordToAssertion, second.recordToAssertion);
  assert.notEqual(first.generatedAt, second.generatedAt);
});

test('invalid graph fingerprint and dangling relation endpoints fail closed', () => {
  const left = record('invalid-left', 'declaration', 'nl');
  const right = record('invalid-right', 'fact', 'ast');
  const valid = graph([left, right], [relation(left, right, 'evidenced_by')]);
  const wrongFingerprint = { ...valid, fingerprint: '0'.repeat(64) };
  assert.throws(() => projectTruthMap(wrongFingerprint), /Graph fingerprint does not match/);

  const danglingRelation = relation(left, right, 'evidenced_by');
  danglingRelation.to = 'INT-AST-00000000000000000000';
  const dangling = graph([left], [danglingRelation]);
  assert.throws(() => projectTruthMap(dangling), /unknown record/);
});

test('truth map validator rejects duplicate assertion membership and reverse drift', () => {
  const item = record('duplicate', 'fact', 'system');
  const sourceGraph = graph([item], []);
  const valid = projectTruthMap(sourceGraph);
  const duplicate = structuredClone(valid) as TruthMap;
  const assertion = duplicate.assertions[0];
  assert.ok(assertion);
  duplicate.assertions.push({ ...structuredClone(assertion), id: `TRUTH-${'f'.repeat(20)}` });
  assert.throws(() => assertTruthMap(duplicate, sourceGraph), /more than one assertion/);

  const reverseDrift = structuredClone(valid) as TruthMap;
  reverseDrift.recordToAssertion[item.id] = `TRUTH-${'e'.repeat(20)}`;
  assert.throws(() => assertTruthMap(reverseDrift, sourceGraph), /reverse index mismatch/);
});

test('truth map validator rejects omitted mapping relations and artificial grouping', () => {
  const left = record('tampered-left', 'declaration', 'todo');
  const right = record('tampered-right', 'fact', 'ast');
  const mapping = relation(left, right, 'evidenced_by');
  const sourceGraph = graph([left, right], [mapping]);
  const omitted = structuredClone(projectTruthMap(sourceGraph)) as TruthMap;
  const assertion = omitted.assertions[0];
  assert.ok(assertion);
  assertion.relationIds = [];
  assert.throws(() => assertTruthMap(omitted, sourceGraph), /retain every mapping relation/);

  const independentGraph = graph([left, right], []);
  const independent = projectTruthMap(independentGraph);
  const merged = structuredClone(independent) as TruthMap;
  const [first, second] = merged.assertions;
  assert.ok(first && second);
  first.recordIds = [...first.recordIds, ...second.recordIds].sort();
  first.evidence.declared = [...first.evidence.declared, ...second.evidence.declared].sort();
  first.evidence.observed = [...first.evidence.observed, ...second.evidence.observed].sort();
  first.evidence.claimed = [...first.evidence.claimed, ...second.evidence.claimed].sort();
  first.sources = [...first.sources, ...second.sources]
    .sort((a, b) => a.recordId.localeCompare(b.recordId));
  first.status = 'supported';
  merged.assertions = [first];
  for (const recordId of first.recordIds) merged.recordToAssertion[recordId] = first.id;
  assert.throws(() => assertTruthMap(merged, independentGraph), /disconnected records/);

  const unsorted = projectTruthMap(independentGraph);
  unsorted.assertions.reverse();
  assert.throws(() => assertTruthMap(unsorted, independentGraph), /assertions must be sorted/);
});
