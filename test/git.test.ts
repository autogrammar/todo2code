import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { extractGitIntent } from '../src/extractors/git.js';
import { makeConfig } from './helpers.js';

const exec = promisify(execFile);

test('Git extractor emits one record per requested commit', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-git-'));
  await exec('git', ['init', '-q'], { cwd: root });
  await exec('git', ['config', 'user.email', 'test@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 't2c test'], { cwd: root });
  for (let index = 1; index <= 12; index += 1) {
    await fs.writeFile(path.join(root, 'runtime.ts'), `export const version = ${index};\n`);
    await exec('git', ['add', 'runtime.ts'], { cwd: root });
    await exec('git', ['commit', '-q', '-m', `${index === 1 ? 'feat' : 'fix'}: update runtime T2C-${index}`], { cwd: root });
  }
  const result = await extractGitIntent({ root, count: 10 }, makeConfig(root));
  assert.equal(result.records.length, 10);
  assert.equal(result.records[0]?.source.commitIndex, 1);
  assert.equal(result.records[9]?.source.commitIndex, 10);
  assert.ok(result.records.every((record) => record.source.revision?.length === 40));
  assert.ok(result.records.every((record) => record.metadata.llmUsed === false));
});

test('An empty repository degrades to a warning instead of failing the run', async () => {
  // `t2c init` leaves exactly this state, and `t2c watch` reaches it first.
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-git-empty-'));
  await exec("git", ["init", "-q", root]);
  await fs.writeFile(path.join(root, 'a.ts'), 'export const a = 1;\n', 'utf8');

  const result = await extractGitIntent({ root, count: 10 }, makeConfig(root));
  assert.deepEqual(result.records, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? '', /no commits yet/);
});
