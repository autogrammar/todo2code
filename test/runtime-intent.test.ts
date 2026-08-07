import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractAstIntent } from '../src/extractors/ast.js';
import { extractRuntimeIntentLedger } from '../src/extractors/runtime-intent.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { makeConfig } from './helpers.js';

const LEDGER = {
  schema: 'subactor.autonom-intent/v1',
  observed_at: '2026-08-07T10:00:00+00:00',
  host: 'llm-account-hub',
  intents: [
    {
      intent_id: 'i-verify-plesk',
      ticket: 'PLF-3816',
      resource: 'plesk-host-x',
      plan_ref: 'docs/AUTONOMY-IMPLEMENTATION.md',
      grant_id: 'g-plesk',
      watches: ['scripts/audit.mjs'],
      state: 'started',
      result: '',
    },
    {
      intent_id: 'i-paused',
      ticket: 'PLF-9000',
      resource: 'plesk-host-y',
      watches: [],
      state: 'paused',
      result: '',
    },
    {
      intent_id: 'i-done',
      ticket: '',
      resource: 'plesk-host-z',
      watches: [],
      state: 'completed',
      result: 'verified',
    },
  ],
  grants: [
    {
      grant_id: 'g-plesk',
      subject: 'project-operator-bot',
      resource: 'plesk-host-x',
      scope: ['verify', 'configure'],
      ticket: 'PLF-3816',
      vault_path: 'secret/data/plesk/admin/host-X',
      expires_at: '2999-01-01T00:00:00+00:00',
      state: 'issued',
      effective_state: 'issued',
      revoked_reason: '',
    },
    {
      grant_id: 'g-revoked',
      subject: 'project-operator-bot',
      resource: 'plesk-host-y',
      scope: ['verify'],
      ticket: 'PLF-9000',
      vault_path: 'secret/data/plesk/admin/host-Y',
      expires_at: '2999-01-01T00:00:00+00:00',
      state: 'revoked',
      effective_state: 'revoked',
      revoked_reason: 'ticket closed',
    },
  ],
};

async function writeLedger(document: unknown = LEDGER): Promise<{ root: string; ledger: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-intent-'));
  const ledger = path.join(root, 'ledger.json');
  await fs.writeFile(ledger, JSON.stringify(document), 'utf8');
  return { root, ledger };
}

test('runtime-intent extractor turns intents and grants into records', async () => {
  const { root, ledger } = await writeLedger();

  const result = await extractRuntimeIntentLedger(ledger, makeConfig(root), root);

  assert.equal(result.warnings.length, 0);
  const kinds = result.records.map((record) => record.statement.kind).sort();
  assert.deepEqual(kinds, [
    'autonomy_access_grant',
    'autonomy_access_grant',
    'autonomy_intent',
    'autonomy_intent',
    'autonomy_intent',
  ]);
  for (const record of result.records) {
    assert.equal(record.schemaVersion, 't2c.intent/v1');
    assert.equal(record.source.kind, 'system');
    assert.ok(record.id.startsWith('INT-SYS-'), `unexpected id ${record.id}`);
    assert.equal(record.observedAt, LEDGER.observed_at);
    // Ledger evidence enters as observed fact, never a plan.
    assert.equal(record.epistemic.class, 'fact');
  }
});

test('intent lifecycle and polarity map from runtime state', async () => {
  const { root, ledger } = await writeLedger();

  const records = (await extractRuntimeIntentLedger(ledger, makeConfig(root), root)).records;
  const byObject = new Map(records.map((record) => [record.statement.object, record]));

  const started = byObject.get('i-verify-plesk');
  assert.equal(started?.lifecycle.status, 'in_progress');
  assert.equal(started?.statement.polarity, 'positive');

  const paused = byObject.get('i-paused');
  assert.equal(paused?.lifecycle.status, 'blocked');
  assert.equal(paused?.statement.polarity, 'negative');

  const done = byObject.get('i-done');
  assert.equal(done?.lifecycle.status, 'completed');
});

test('an active grant is verified and positive, a revoked grant negative', async () => {
  const { root, ledger } = await writeLedger();

  const records = (await extractRuntimeIntentLedger(ledger, makeConfig(root), root)).records;
  const byObject = new Map(records.map((record) => [record.statement.object, record]));

  const issued = byObject.get('g-plesk');
  assert.equal(issued?.lifecycle.status, 'verified');
  assert.equal(issued?.statement.polarity, 'positive');
  assert.equal(issued?.metadata.scope, 'verify,configure');
  // Only the vault path reference is carried, never a secret value.
  assert.equal(issued?.metadata.vaultPath, 'secret/data/plesk/admin/host-X');

  const revoked = byObject.get('g-revoked');
  assert.equal(revoked?.statement.polarity, 'negative');
  assert.equal(revoked?.metadata.revokedReason, 'ticket closed');
});

test('a watched path lets a live intent link to the code that governs it', async () => {
  const { root, ledger } = await writeLedger();
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(root, 'scripts', 'audit.mjs'), 'export function auditPleskProfile() {}\n', 'utf8');
  const config = makeConfig(root);

  const intents = (await extractRuntimeIntentLedger(ledger, config, root)).records;
  const code = (await extractAstIntent({ root }, config)).records;
  const graph = linkIntentRecords([...code, ...intents]);

  const intentIds = new Set(intents.map((record) => record.id));
  const crossing = graph.relations.filter(
    (relation) => intentIds.has(relation.from) !== intentIds.has(relation.to),
  );
  assert.ok(crossing.length > 0, 'runtime intents linked to nothing in the code graph');
});

test('intents and grants sharing a ticket link to each other', async () => {
  const { root, ledger } = await writeLedger();

  const records = (await extractRuntimeIntentLedger(ledger, makeConfig(root), root)).records;
  const graph = linkIntentRecords(records);

  // The started intent and its grant both carry ticket PLF-3816.
  assert.ok(graph.relations.length > 0, 'expected intent<->grant relations via shared ticket');
});

test('a document that is not an intent ledger is refused by schema', async () => {
  const { root, ledger } = await writeLedger({ schema: 'something-else/v1', intents: [] });

  await assert.rejects(
    () => extractRuntimeIntentLedger(ledger, makeConfig(root), root),
    /expected schema subactor\.autonom-intent\/v1/,
  );
});
