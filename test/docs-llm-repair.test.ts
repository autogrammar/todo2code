// Deterministic repair of documentation records.
//
// The model reliably returns line 1 of a chunk, an empty target and
// `action: unknown`. These tests stub `fetch`, so they pin what the runtime
// does with such a response rather than any model's behaviour.

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDocumentationIntent } from '../src/extractors/docs-llm.js';
import { makeConfig } from './helpers.js';

const DOC = [
  '# Example backend',                                            // 1
  '',                                                             // 2
  'Minimalny backend HTTP bez zewnętrznych zależności.',          // 3
  '',                                                             // 4
  'Należy dodać walidację ładunku przed `enqueueEvent`.',         // 5
  '',                                                             // 6
  'Klient `src/api.ts` obsługuje `POST /events` w wersji 1.2.0.', // 7
  '',                                                             // 8
  'Nie wolno zmieniać publicznego kontraktu. TASK-991',           // 9
  '',
].join('\n');

function rawRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'documented_intent',
    actor: null,
    action: 'unknown',
    subject: null,
    object: 'walidacja ładunku',
    modality: 'unknown',
    polarity: 'positive',
    lifecycle: 'proposed',
    confidence: 0.6,
    basis: [],
    target: { paths: [], symbols: [], tickets: [], versions: [] },
    // The observed failure mode: everything is reported at the chunk's first line.
    sourceLines: { start: 1, end: 1 },
    text: 'Należy dodać walidację ładunku przed `enqueueEvent`.',
    ...overrides,
  };
}

async function extract(records: unknown[]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-doc-repair-'));
  await fs.writeFile(path.join(root, 'README.md'), DOC, 'utf8');
  const config = makeConfig(root);
  config.openRouter.apiKey = 'test-key';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'gen-doc-1',
    model: 'test/model',
    provider: 'TestProvider',
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0 },
    choices: [{ message: { content: JSON.stringify({ records }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    return await extractDocumentationIntent({ root, patterns: ['README.md'] }, config);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('A record claiming line 1 is re-anchored to the line carrying its statement', async () => {
  const result = await extract([rawRecord()]);
  const record = result.records[0];
  assert.ok(record);
  assert.equal(record.source.lines?.start, 5, 'must point at the validation sentence');
  assert.match(record.source.rawExcerpt ?? '', /walidację ładunku/);
  assert.ok(record.epistemic.basis.includes('runtime_line_reanchor'));
});

test('An already correct line is kept and not reported as re-anchored', async () => {
  const result = await extract([rawRecord({ sourceLines: { start: 5, end: 5 } })]);
  const record = result.records[0];
  assert.equal(record?.source.lines?.start, 5);
  assert.ok(!record?.epistemic.basis.includes('runtime_line_reanchor'));
});

test('An empty target is backfilled from the statement text', async () => {
  const result = await extract([rawRecord({
    object: 'kontrakt POST /events',
    text: 'Klient `src/api.ts` obsługuje `POST /events` w wersji 1.2.0.',
  })]);
  const target = result.records[0]?.statement.target;
  assert.ok(target);
  assert.ok(target.paths.includes('src/api.ts'), `paths=${JSON.stringify(target.paths)}`);
  assert.ok(target.versions.includes('1.2.0'), `versions=${JSON.stringify(target.versions)}`);
  assert.ok(result.records[0]?.epistemic.basis.includes('runtime_target_backfill'));
});

test('A target supplied by the model is never overwritten', async () => {
  const result = await extract([rawRecord({
    target: { paths: ['docs/PROTOCOLS.md'], symbols: [], tickets: [], versions: [] },
    text: 'Klient `src/api.ts` obsługuje `POST /events`.',
  })]);
  assert.deepEqual(result.records[0]?.statement.target.paths, ['docs/PROTOCOLS.md']);
  assert.ok(!result.records[0]?.epistemic.basis.includes('runtime_target_backfill'));
});

test('An unclassified action and modality are derived from the statement', async () => {
  const result = await extract([rawRecord()]);
  const record = result.records[0];
  assert.equal(record?.statement.action, 'add', '"Należy dodać" is an addition');
  assert.equal(record?.statement.modality, 'required', '"Należy" is an obligation');
  assert.ok(record?.epistemic.basis.includes('runtime_action_backfill'));
  assert.ok(record?.epistemic.basis.includes('runtime_modality_backfill'));
});

test('A classified action from the model wins over the heuristic', async () => {
  const result = await extract([rawRecord({ action: 'validate', modality: 'recommended' })]);
  assert.equal(result.records[0]?.statement.action, 'validate');
  assert.equal(result.records[0]?.statement.modality, 'recommended');
  assert.ok(!result.records[0]?.epistemic.basis.includes('runtime_action_backfill'));
});

test('An action that stays unclassifiable is reported as a missing field', async () => {
  const result = await extract([rawRecord({ object: 'kontekst', text: 'Rozdział opisuje kontekst.' })]);
  const record = result.records[0];
  assert.equal(record?.statement.action, 'unknown');
  assert.deepEqual(record?.metadata.missingFields, ['action']);
});

test('A placeholder object is treated as a gap, not as content', async () => {
  const result = await extract([rawRecord({ object: 'unknown' })]);
  const record = result.records[0];
  assert.notEqual(record?.statement.object.toLowerCase(), 'unknown');
  assert.ok((record?.metadata.missingFields as string[]).includes('object'));
});

test('Every repair is attributable through epistemic.basis', async () => {
  // The record must stay auditable: a reader can tell which fields came from
  // the model and which the runtime derived.
  const result = await extract([rawRecord()]);
  const basis = result.records[0]?.epistemic.basis ?? [];
  assert.ok(basis.includes('openrouter_structured_extraction'), 'model origin is recorded');
  assert.ok(basis.some((item) => item.startsWith('runtime_')), 'runtime repairs are recorded');
  assert.equal(result.records[0]?.epistemic.class, 'llm_inference', 'repair does not promote the class');
  assert.ok((result.records[0]?.epistemic.confidence ?? 1) <= 0.85, 'repair does not raise the ceiling');
});
