import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractAstIntent } from '../src/extractors/ast.js';
import { extractRuntimeCycleIntent } from '../src/extractors/runtime-cycle.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { makeConfig } from './helpers.js';

const CYCLE = {
  schema: 'subactor.autonom-cycle/v1',
  observed_at: '2026-08-01T09:52:42+00:00',
  host: 'nvidia/linux',
  program: '/repo/autonom/organism.yaml',
  summary: { probes: 2, healthy: 1, violating: 1, unevaluable: 0, drifted: 1, proposals: 1 },
  results: [
    {
      id: 'capability-drift',
      ask: 'command',
      tags: ['twin', 'gate'],
      watches: ['scripts/audit.mjs'],
      note: 'Rozjazd między tym, co connector serwuje, a tym, co platforma o nim wie.',
      facts: { served: '39', mapped: '39', findings: '0' },
      violations: [],
      ratchet_slack: [],
      error: null,
      ok: true,
      duration_ms: 32,
    },
    {
      id: 'components-pin-drift',
      ask: 'command',
      tags: ['pin'],
      watches: ['scripts/audit.mjs'],
      note: '',
      facts: { dirty: '6' },
      violations: [{ fact: 'dirty', expected: '0', actual: '6' }],
      ratchet_slack: [],
      error: null,
      ok: false,
      duration_ms: 11,
    },
  ],
  drift: [{ probe: 'capability-drift', fact: 'served', was: '38', now: '39', tags: ['twin'] }],
  proposals: [
    {
      kind: 'expectation_violated',
      probe: 'components-pin-drift',
      detail: 'dirty: expected 0, observed 6',
      suggestion: 'Investigate before changing anything.',
      evidence: { fact: 'dirty' },
      acts: false,
    },
  ],
};

async function writeCycle(document: unknown = CYCLE): Promise<{ root: string; cycle: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-runtime-'));
  const cycle = path.join(root, 'cycle.json');
  await fs.writeFile(cycle, JSON.stringify(document), 'utf8');
  return { root, cycle };
}

test('runtime cycle extractor turns probes, violations, drift and proposals into records', async () => {
  const { root, cycle } = await writeCycle();

  const result = await extractRuntimeCycleIntent(cycle, makeConfig(root), root);

  assert.equal(result.warnings.length, 0);
  const kinds = result.records.map((record) => record.statement.kind).sort();
  assert.deepEqual(kinds, [
    'runtime_cycle_proposal',
    'runtime_expectation_violated',
    'runtime_fact_drifted',
    'runtime_probe_observation',
    'runtime_probe_observation',
  ]);
  for (const record of result.records) {
    assert.equal(record.schemaVersion, 't2c.intent/v1');
    assert.equal(record.source.kind, 'system');
    assert.ok(record.id.startsWith('INT-SYS-'), `unexpected id ${record.id}`);
    assert.equal(record.observedAt, CYCLE.observed_at);
  }
});

test('measurements enter as fact and the cycle own suggestions as inference', async () => {
  const { root, cycle } = await writeCycle();

  const records = (await extractRuntimeCycleIntent(cycle, makeConfig(root), root)).records;

  const byKind = new Map(records.map((record) => [record.statement.kind, record]));
  assert.equal(byKind.get('runtime_probe_observation')?.epistemic.class, 'fact');
  assert.equal(byKind.get('runtime_expectation_violated')?.epistemic.class, 'fact');
  assert.equal(byKind.get('runtime_fact_drifted')?.epistemic.class, 'fact');
  // A proposal is derived from those facts, never measured, and never a plan.
  const proposal = byKind.get('runtime_cycle_proposal');
  assert.equal(proposal?.epistemic.class, 'inference');
  assert.equal(proposal?.lifecycle.status, 'proposed');
  assert.equal(proposal?.metadata.acts, false);
});

test('a violated expectation is negative and blocked, a healthy probe positive and verified', async () => {
  const { root, cycle } = await writeCycle();

  const records = (await extractRuntimeCycleIntent(cycle, makeConfig(root), root)).records;

  const healthy = records.find((record) => record.statement.object === 'capability-drift');
  assert.equal(healthy?.statement.polarity, 'positive');
  assert.equal(healthy?.lifecycle.status, 'verified');
  const violated = records.find((record) => record.statement.kind === 'runtime_expectation_violated');
  assert.equal(violated?.statement.polarity, 'negative');
  assert.equal(violated?.lifecycle.status, 'blocked');
  assert.equal(violated?.statement.modality, 'required');
});

test('a probe that could not run is unknown, not failing', async () => {
  const unevaluable = {
    ...CYCLE,
    results: [{ ...CYCLE.results[0], error: 'command_failed:TimeoutExpired', ok: false, facts: {} }],
    drift: [],
    proposals: [],
  };
  const { root, cycle } = await writeCycle(unevaluable);

  const records = (await extractRuntimeCycleIntent(cycle, makeConfig(root), root)).records;

  assert.equal(records.length, 1);
  const probe = records[0];
  assert.ok(probe, 'expected one probe record');
  assert.equal(probe.lifecycle.status, 'unknown');
  assert.equal(probe.metadata.unevaluable, true);
});

test('a watched path lets a runtime fact link to the code that produces it', async () => {
  const { root, cycle } = await writeCycle();
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(root, 'scripts', 'audit.mjs'), 'export function auditCapabilityDrift() {}\n', 'utf8');
  const config = makeConfig(root);

  const runtime = (await extractRuntimeCycleIntent(cycle, config, root)).records;
  const code = (await extractAstIntent({ root }, config)).records;
  const graph = linkIntentRecords([...code, ...runtime]);

  const runtimeIds = new Set(runtime.map((record) => record.id));
  const crossing = graph.relations.filter(
    (relation) => runtimeIds.has(relation.from) !== runtimeIds.has(relation.to),
  );
  assert.ok(crossing.length > 0, 'runtime records linked to nothing in the code graph');
});

test('a document that is not an autonom cycle is refused by schema, not silently empty', async () => {
  const { root, cycle } = await writeCycle({ schema: 'something-else/v1', results: [] });

  await assert.rejects(
    () => extractRuntimeCycleIntent(cycle, makeConfig(root), root),
    /expected schema subactor\.autonom-cycle\/v1/,
  );
});
