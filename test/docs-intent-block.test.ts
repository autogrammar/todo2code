import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractAstIntent } from '../src/extractors/ast.js';
import { extractDocsIntentBlocks } from '../src/extractors/docs-intent-block.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import { makeConfig } from './helpers.js';

const FENCE = '```';

function doc(...blocks: string[]): string {
  return ['# Design', '', 'Prose that the runtime ignores.', '', ...blocks, ''].join('\n');
}

function block(json: unknown): string {
  return [`${FENCE}t2c-intent`, JSON.stringify(json, null, 2), FENCE].join('\n');
}

async function write(content: string): Promise<{ root: string; file: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docintent-'));
  const file = path.join(root, 'DESIGN.md');
  await fs.writeFile(file, content, 'utf8');
  return { root, file };
}

test('a t2c-intent block becomes a declaration record with source range', async () => {
  const { root, file } = await write(doc(block({
    kind: 'access_delegation',
    action: 'configure',
    object: 'plesk-admin-profile',
    modality: 'required',
    lifecycle: 'implemented',
    text: 'Plesk admin access is gated by an AQL grant and sourced from Vault.',
    target: { paths: ['src/plesk-verify.mjs'], symbols: ['assertGrantAllows'], tickets: ['PLF-3816'] },
  })));

  const result = await extractDocsIntentBlocks(file, makeConfig(root), root);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.records.length, 1);
  const record = result.records[0]!;
  assert.equal(record.statement.object, 'plesk-admin-profile');
  assert.equal(record.statement.action, 'configure');
  assert.equal(record.lifecycle.status, 'implemented');
  assert.equal(record.source.kind, 'document');
  assert.equal(record.epistemic.class, 'declaration');
  assert.ok(record.id.startsWith('INT-DOC-'), `unexpected id ${record.id}`);
  assert.equal(typeof record.source.lines?.start, 'number');
  assert.deepEqual(record.statement.target.tickets, ['PLF-3816']);
});

test('a records array and defaults are honored', async () => {
  const { root, file } = await write(doc(block({
    records: [
      { object: 'a', text: 'first' },
      { object: 'b', action: 'block', polarity: 'negative', text: 'deprecated browser-credential harvest' },
    ],
  })));
  const result = await extractDocsIntentBlocks(file, makeConfig(root), root);
  assert.equal(result.records.length, 2);
  const a = result.records[0]!;
  const b = result.records[1]!;
  assert.equal(a.statement.action, 'declare');   // default
  assert.equal(a.lifecycle.status, 'planned');    // default
  assert.equal(b.statement.action, 'block');
  assert.equal(b.statement.polarity, 'negative');
});

test('invalid entries warn and are skipped, never fabricated', async () => {
  const { root, file } = await write(doc(
    block({ text: 'missing object' }),
    `${FENCE}t2c-intent`, '{ not json', FENCE,
  ));
  const result = await extractDocsIntentBlocks(file, makeConfig(root), root);
  assert.equal(result.records.length, 0);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings.join('\n'), /missing required "object"/);
  assert.match(result.warnings.join('\n'), /not JSON/);
});

test('authored doc intent links to the code it targets', async () => {
  const { root, file } = await write(doc(block({
    object: 'grant-guard',
    action: 'configure',
    text: 'assertGrantAllows enforces the delegation.',
    target: { paths: ['guard.mjs'], symbols: ['assertGrantAllows'] },
  })));
  await fs.writeFile(path.join(root, 'guard.mjs'), 'export function assertGrantAllows() {}\n', 'utf8');
  const config = makeConfig(root);

  const docRecords = (await extractDocsIntentBlocks(file, config, root)).records;
  const code = (await extractAstIntent({ root }, config)).records;
  const graph = linkIntentRecords([...code, ...docRecords]);

  const docIds = new Set(docRecords.map((r) => r.id));
  const crossing = graph.relations.filter((rel) => docIds.has(rel.from) !== docIds.has(rel.to));
  assert.ok(crossing.length > 0, 'documented intent linked to nothing in the code graph');
});

test('a document without any t2c-intent block yields no records', async () => {
  const { root, file } = await write('# Just prose\n\nNothing to extract here.\n');
  const result = await extractDocsIntentBlocks(file, makeConfig(root), root);
  assert.deepEqual(result, { records: [], warnings: [] });
});
