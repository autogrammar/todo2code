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

async function initializeRepository(
  root: string,
  relativePath?: string,
  content = 'export const shared = true;\n',
): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  await exec('git', ['init', '-q'], { cwd: root });
  await exec('git', ['config', 'user.email', 'umbrella@todo2code.local'], { cwd: root });
  await exec('git', ['config', 'user.name', 'umbrella test'], { cwd: root });
  if (!relativePath) return;
  const absolute = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content);
  await exec('git', ['add', relativePath], { cwd: root });
  await exec('git', ['commit', '-q', '-m', `feat: add ${relativePath}`], { cwd: root });
}

test('umbrella Git extraction namespaces nested repositories and prunes unsafe descendants', async () => {
  const umbrella = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-git-umbrella-'));
  const alpha = path.join(umbrella, 'alpha');
  const beta = path.join(umbrella, 'group', 'beta');
  const empty = path.join(umbrella, 'empty');
  await initializeRepository(alpha, 'src/shared.ts');
  await initializeRepository(beta, 'src/shared.ts', 'export const shared = false;\n');
  await initializeRepository(empty);

  // A repository below an already discovered repository is owned by that
  // checkout and must not be interpreted as another umbrella member.
  await initializeRepository(path.join(alpha, 'vendor', 'nested'), 'src/hidden.ts');

  // Directory discovery must use lstat/readdir semantics and never cross a
  // symlink into a repository outside the supplied umbrella root.
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-git-external-'));
  await initializeRepository(external, 'src/external.ts');
  await fs.symlink(external, path.join(umbrella, 'linked-external'), 'dir');

  const first = await extractGitIntent({ root: umbrella, count: 1 }, makeConfig(umbrella));
  const second = await extractGitIntent({ root: umbrella, count: 1 }, makeConfig(umbrella));

  assert.deepEqual(first, second);
  assert.equal(first.records.length, 2);
  assert.deepEqual(
    first.records.map((record) => record.statement.target.paths),
    [['alpha/src/shared.ts'], ['group/beta/src/shared.ts']],
  );
  assert.deepEqual(
    first.records.map((record) => record.metadata.repositoryRoot),
    ['alpha', 'group/beta'],
  );
  assert.ok(first.records.every((record) => record.source.extractor === 't2c/git@2'));
  assert.ok(first.records.every((record) => record.metadata.generation.generatorVersion === '2'));
  assert.equal(new Set(first.records.map((record) => record.id)).size, 2);
  assert.ok(first.records.every((record) => {
    const changed = record.metadata.changedFiles;
    return Array.isArray(changed)
      && changed.every((item) => typeof item === 'object' && item !== null
        && String((item as { path?: unknown }).path).startsWith(String(record.metadata.repositoryRoot)));
  }));
  assert.equal(first.warnings.length, 1);
  assert.match(first.warnings[0] ?? '', /empty.*no commits yet/i);
  assert.ok(!first.records.some((record) => record.statement.target.paths.some((item) => (
    item.includes('vendor/nested') || item.includes('linked-external') || item.includes('external.ts')
  ))));
});

test('a single repository keeps its existing unprefixed path and commit ordering contract', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-git-single-v2-'));
  await initializeRepository(root, 'src/first.ts');
  await fs.writeFile(path.join(root, 'src', 'second.ts'), 'export const second = true;\n');
  await exec('git', ['add', 'src/second.ts'], { cwd: root });
  await exec('git', ['commit', '-q', '-m', 'feat: add second'], { cwd: root });

  const result = await extractGitIntent({ root, count: 2 }, makeConfig(root));

  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records.map((record) => record.source.commitIndex), [1, 2]);
  assert.deepEqual(result.records[0]?.statement.target.paths, ['src/second.ts']);
  assert.deepEqual(result.records[1]?.statement.target.paths, ['src/first.ts']);
  assert.equal(result.records[0]?.metadata.repositoryRoot, '.');
  assert.ok(result.records.every((record) => record.source.extractor === 't2c/git@2'));
});

test('umbrella extraction prefixes both sides of a renamed path', async () => {
  const umbrella = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-git-rename-'));
  const repository = path.join(umbrella, 'service');
  await initializeRepository(repository, 'src/old.ts');
  await exec('git', ['mv', 'src/old.ts', 'src/new.ts'], { cwd: repository });
  await exec('git', ['commit', '-q', '-m', 'refactor: rename source'], { cwd: repository });

  const result = await extractGitIntent({ root: umbrella, count: 1 }, makeConfig(umbrella));
  const changedFiles = result.records[0]?.metadata.changedFiles;

  assert.deepEqual(result.records[0]?.statement.target.paths, ['service/src/new.ts']);
  assert.ok(Array.isArray(changedFiles));
  assert.deepEqual(changedFiles, [{
    status: 'R100',
    previousPath: 'service/src/old.ts',
    path: 'service/src/new.ts',
  }]);
});
