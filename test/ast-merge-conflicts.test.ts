import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { code2dsl } from '../src/extractors/ast.js';
import { assertIntentRecords } from '../src/core/schema.js';
import { makeConfig } from './helpers.js';

async function workspace(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-conflicts-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = makeConfig(root);
  config.cacheEnabled = false;
  return { root, config };
}
const conflict = ['<<<<<<< HEAD', '    return 1', '=======', '    return 2', '>>>>>>> main'].join('\n');

test('code2dsl retains source-bound conflict facts when Python AST parsing fails', async (t) => {
  const { root, config } = await workspace(t);
  await fs.writeFile(path.join(root, 'broken.py'), `def choose():\n${conflict}\n`);
  const result = await code2dsl({ root }, config);
  assertIntentRecords(result.records);
  const records = result.records.filter((record) => record.statement.kind === 'merge_conflict_fact');
  assert.equal(records.length, 1);
  const record = records[0]!;
  assert.deepEqual(record.source.lines, { start: 2, end: 6 });
  assert.equal(record.source.rawExcerpt, conflict);
  assert.equal(record.source.kind, 'git');
  assert.equal(record.epistemic.class, 'fact');
  assert.equal(record.metadata.llmUsed, false);
  assert.equal(record.metadata.gitIndexVerified, false);
  assert.equal(record.metadata.conflictStyle, 'merge');
  assert.ok(result.warnings.length > 0, 'AST syntax failure remains visible');
  const repeated = await code2dsl({ root }, config);
  assert.equal(repeated.records.find((r) => r.statement.kind === 'merge_conflict_fact')?.id, record.id);
  await fs.writeFile(path.join(root, 'broken.py'), `def choose():\n${conflict.replace('return 2', 'return 3')}\n`);
  const changed = await code2dsl({ root }, config);
  assert.notEqual(changed.records.find((r) => r.statement.kind === 'merge_conflict_fact')?.id, record.id);
});

test('code2dsl handles diff3, multiple blocks, custom widths and CRLF without choosing a side', async (t) => {
  const { root, config } = await workspace(t);
  const diff3 = ['<<<<<<<<<< ours', 'one', '|||||||||| base', 'zero', '==========', 'two', '>>>>>>>>>> theirs'];
  await fs.writeFile(path.join(root, 'settings.toml'), [...diff3, 'unrelated = true', ...diff3].join('\r\n'));
  const records = (await code2dsl({ root }, config)).records.filter((r) => r.statement.kind === 'merge_conflict_fact');
  assert.deepEqual(records.map((r) => r.source.lines), [{ start: 1, end: 7 }, { start: 9, end: 15 }]);
  assert.ok(records.every((r) => r.metadata.conflictStyle === 'diff3' && r.metadata.markerWidth === 10));
  assert.equal(records[0]!.source.rawExcerpt, diff3.join('\r\n') + '\r');
  assert.notEqual(records[0]!.id, records[1]!.id);
});

test('malformed and nested blocks never become partial editable conflict evidence', async (t) => {
  const { root, config } = await workspace(t);
  const bodies = [conflict.replace('=======', '========'), conflict.replace('=======', ''),
    conflict.replace('    return 1', '<<<<<<< nested'), conflict.replace('>>>>>>> main', ''),
    `${conflict}\n<<<<<<< unfinished`, conflict.replace('=======', '||||||| base\n||||||| duplicate\n=======')];
  for (let index = 0; index < bodies.length; index++) await fs.writeFile(path.join(root, `bad${index}.py`), bodies[index]!);
  const result = await code2dsl({ root }, config);
  assert.equal(result.records.filter((r) => r.statement.kind === 'merge_conflict_fact').length, 0);
  assert.equal(result.warnings.filter((w) => w.includes('malformed merge conflict markers')).length, bodies.length);
});

test('conflict extraction respects ignore, file-size and binary boundaries', async (t) => {
  const { root, config } = await workspace(t);
  config.maxFileBytes = 200;
  await fs.writeFile(path.join(root, '.intentignore'), 'ignored.py\n');
  await fs.writeFile(path.join(root, 'ignored.py'), conflict);
  await fs.writeFile(path.join(root, 'binary.py'), `${conflict}\n\0`);
  await fs.writeFile(path.join(root, 'large.py'), `${conflict}\n${'x'.repeat(201)}`);
  await fs.writeFile(path.join(root, 'plain.py'), 'def invalid(:\n');
  const result = await code2dsl({ root }, config);
  assert.equal(result.records.filter((r) => r.statement.kind === 'merge_conflict_fact').length, 0);
  assert.ok(result.warnings.some((w) => w.includes('large.py')));
});


test('bounded excerpts still bind changes beyond their visible prefix', async (t) => {
  const { root, config } = await workspace(t);
  const body = ['<<<<<<< HEAD', 'x'.repeat(2100), '=======', 'old tail', '>>>>>>> main'].join('\n');
  await fs.writeFile(path.join(root, 'large.toml'), body);
  const first = (await code2dsl({ root }, config)).records.find((r) => r.statement.kind === 'merge_conflict_fact')!;
  await fs.writeFile(path.join(root, 'large.toml'), body.replace('old tail', 'new tail'));
  const second = (await code2dsl({ root }, config)).records.find((r) => r.statement.kind === 'merge_conflict_fact')!;
  assert.equal(first.source.rawExcerpt!.length, 2000);
  assert.equal(first.source.rawExcerpt, second.source.rawExcerpt);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.metadata.blockSha256, second.metadata.blockSha256);
});
