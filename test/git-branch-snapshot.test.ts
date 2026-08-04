import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  classifyMergeTreeResult,
  materializeBranchGitSnapshot,
  type BranchGitMaterialization,
} from '../src/services/branch-snapshot.js';

const exec = promisify(execFile);
const BASE = 'refs/heads/main';

interface Fixture {
  parent: string;
  root: string;
  refs: {
    contained: string;
    disjointLeft: string;
    disjointRight: string;
    conflictLeft: string;
    conflictRight: string;
    cherryOne: string;
    cherryTwo: string;
  };
}

test('materializes exact topology, conflicts, disjoint paths and equivalent patches read-only', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const before = await repositoryState(fixture.root);
  const temporaryParent = path.join(fixture.parent, 'temporary');
  await fs.mkdir(temporaryParent);

  const result = await materialize(fixture, [
    fixture.refs.conflictRight,
    fixture.refs.disjointLeft,
    fixture.refs.cherryTwo,
    fixture.refs.contained,
    fixture.refs.conflictLeft,
    fixture.refs.cherryOne,
    fixture.refs.disjointRight,
  ], temporaryParent);

  assert.deepEqual(await repositoryState(fixture.root), before);
  assert.deepEqual(await fs.readdir(temporaryParent), []);
  assert.equal(result.base.sha, await git(fixture.root, 'rev-parse', `${BASE}^{commit}`));
  assert.equal(result.base.treeSha, await git(fixture.root, 'rev-parse', `${BASE}^{tree}`));
  assert.deepEqual(result.candidates.map((candidate) => candidate.ref), [...result.candidates.map((candidate) => candidate.ref)].sort());

  const left = candidate(result, fixture.refs.disjointLeft);
  assert.equal(left.mergeBaseSha, result.base.sha);
  assert.equal(left.aheadBy, 1);
  assert.equal(left.behindBy, 0);
  assert.deepEqual(left.changedPaths, ['left.txt']);
  assert.match(left.patchId ?? '', /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/);
  assert.equal(candidate(result, fixture.refs.contained).patchId, null);
  assert.equal(candidate(result, fixture.refs.contained).aheadBy, 0);
  assert.equal(candidate(result, fixture.refs.contained).behindBy, 1);
  assert.deepEqual(candidate(result, fixture.refs.contained).changedPaths, []);
  assert.equal(candidate(result, fixture.refs.cherryOne).patchId, candidate(result, fixture.refs.cherryTwo).patchId);
  assert.notEqual(candidate(result, fixture.refs.cherryOne).headSha, candidate(result, fixture.refs.cherryTwo).headSha);
  assert.equal(interaction(result, fixture.refs.disjointLeft, fixture.refs.disjointRight), 'clean');
  assert.equal(interaction(result, fixture.refs.conflictLeft, fixture.refs.conflictRight), 'conflict');
  assert.equal(Object.hasOwn(result, 'root'), false);
  assert.equal(JSON.stringify(result).includes(fixture.root), false);
  assert.equal(result.interactions.length, 21);
});

test('fingerprint is invariant to ref order and contains no clock metadata', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const refs = [fixture.refs.disjointLeft, fixture.refs.conflictLeft, fixture.refs.conflictRight];
  const first = await materialize(fixture, refs);
  const second = await materialize(fixture, [...refs].reverse());
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first, second);
  assert.equal(Object.hasOwn(first, 'generatedAt'), false);
});

test('merge-tree result classifier fails closed on unavailable or ambiguous output', () => {
  const sha = 'a'.repeat(40);
  assert.equal(classifyMergeTreeResult(0, `${sha}\n`), 'clean');
  assert.equal(classifyMergeTreeResult(1, `${sha}\nCONFLICT`), 'conflict');
  assert.equal(classifyMergeTreeResult(129, 'unknown option'), 'unknown');
  assert.equal(classifyMergeTreeResult(0, 'not-a-tree'), 'unknown');
});

test('rejects unsafe, duplicate, symbolic, missing and over-limit refs', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const valid = fixture.refs.disjointLeft;
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: path.join(fixture.parent, 'not-a-repository'), repository: 'semcod/fixture',
    toolVersion: '0.5.1', baseRef: BASE, candidateRefs: [valid],
  }), /not a Git work tree/);
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: fixture.root, repository: '../fixture', toolVersion: '0.5.1', baseRef: BASE, candidateRefs: [valid],
  }), /repository must be owner\/name/);
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: fixture.root, repository: 'semcod/fixture', toolVersion: '0.5.1', baseRef: 'main', candidateRefs: [valid],
  }), /Invalid branch snapshot baseRef/);
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: fixture.root, repository: 'semcod/fixture', toolVersion: '0.5.1', baseRef: BASE, candidateRefs: [valid, valid],
  }), /Duplicate candidate ref/);
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: fixture.root, repository: 'semcod/fixture', toolVersion: '0.5.1', baseRef: BASE,
    candidateRefs: Array.from({ length: 33 }, (_, index) => `refs/heads/candidate-${index}`),
  }), /1\.\.32 items/);
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: fixture.root, repository: 'semcod/fixture', toolVersion: '0.5.1', baseRef: BASE,
    candidateRefs: ['refs/heads/symbolic'],
  }), /Symbolic ref is not allowed/);
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: fixture.root, repository: 'semcod/fixture', toolVersion: '0.5.1', baseRef: BASE,
    candidateRefs: ['refs/heads/missing'],
  }), /Git rev-parse failed/);
});

test('detects ref movement and removes temporary state after failure', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const temporaryParent = path.join(fixture.parent, 'temporary');
  await fs.mkdir(temporaryParent);
  const movingRef = fixture.refs.disjointLeft;
  const original = await git(fixture.root, 'rev-parse', movingRef);
  await assert.rejects(() => materializeBranchGitSnapshot({
    root: fixture.root,
    repository: 'semcod/fixture',
    toolVersion: '0.5.1',
    baseRef: BASE,
    candidateRefs: [movingRef],
  }, {
    temporaryParent,
    afterCapture: async () => {
      await git(fixture.root, 'branch', '-f', movingRef.slice('refs/heads/'.length), fixture.refs.disjointRight);
    },
  }), /ref moved during capture/);
  assert.deepEqual(await fs.readdir(temporaryParent), []);
  await git(fixture.root, 'branch', '-f', movingRef.slice('refs/heads/'.length), original);
});

async function materialize(fixture: Fixture, candidateRefs: string[], temporaryParent?: string): Promise<BranchGitMaterialization> {
  return materializeBranchGitSnapshot({
    root: fixture.root,
    repository: 'semcod/fixture',
    toolVersion: '0.5.1',
    baseRef: BASE,
    candidateRefs,
  }, temporaryParent ? { temporaryParent } : {});
}

function candidate(result: BranchGitMaterialization, ref: string) {
  const value = result.candidates.find((item) => item.ref === ref);
  assert.ok(value, `missing candidate ${ref}`);
  return value;
}

function interaction(result: BranchGitMaterialization, first: string, second: string): string {
  const [left, right] = [first, second].sort();
  const value = result.interactions.find((item) => item.left === left && item.right === right);
  assert.ok(value, `missing interaction ${left} / ${right}`);
  return value.textualMerge;
}

async function createFixture(): Promise<Fixture> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-branch-fixture-'));
  const root = path.join(parent, 'repo');
  await fs.mkdir(root);
  await git(root, 'init', '-q', '--initial-branch=main');
  await git(root, 'config', 'user.email', 'fixture@todo2code.local');
  await git(root, 'config', 'user.name', 'todo2code fixture');
  await fs.writeFile(path.join(root, 'shared.txt'), 'base\n', 'utf8');
  await git(root, 'add', 'shared.txt');
  await git(root, 'commit', '-q', '-m', 'base');

  await git(root, 'branch', 'contained');
  const contained = 'refs/heads/contained';
  await write(root, 'base-later.txt', 'new base work\n');
  await git(root, 'add', 'base-later.txt');
  await git(root, 'commit', '-q', '-m', 'advance base');
  const disjointLeft = await branch(root, 'disjoint-left', () => write(root, 'left.txt', 'left\n'), 'left');
  const disjointRight = await branch(root, 'disjoint-right', () => write(root, 'right.txt', 'right\n'), 'right');
  const conflictLeft = await branch(root, 'conflict-left', () => write(root, 'shared.txt', 'left\n'), 'conflict left');
  const conflictRight = await branch(root, 'conflict-right', () => write(root, 'shared.txt', 'right\n'), 'conflict right');
  const cherryOne = await branch(root, 'cherry-one', () => write(root, 'duplicate.txt', 'same patch\n'), 'first message');
  const cherryTwo = await branch(root, 'cherry-two', () => write(root, 'duplicate.txt', 'same patch\n'), 'second message');
  await git(root, 'symbolic-ref', 'refs/heads/symbolic', BASE);
  await git(root, 'switch', '-q', 'main');
  return {
    parent,
    root,
    refs: { contained, disjointLeft, disjointRight, conflictLeft, conflictRight, cherryOne, cherryTwo },
  };
}

async function branch(
  root: string,
  name: string,
  change: () => Promise<unknown>,
  message?: string,
): Promise<string> {
  await git(root, 'switch', '-q', '-C', name, 'main');
  await change();
  if (message) {
    await git(root, 'add', '.');
    await git(root, 'commit', '-q', '-m', message);
  }
  return `refs/heads/${name}`;
}

async function write(root: string, file: string, content: string): Promise<void> {
  await fs.writeFile(path.join(root, file), content, 'utf8');
}

async function repositoryState(root: string): Promise<Record<string, string>> {
  return {
    head: await git(root, 'rev-parse', 'HEAD'),
    status: await git(root, 'status', '--porcelain=v1', '--untracked-files=all'),
    refs: await git(root, 'for-each-ref', '--format=%(refname)%00%(objectname)'),
    objects: await git(root, 'count-objects', '-v'),
  };
}

async function git(root: string, ...args: string[]): Promise<string> {
  const result = await exec('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.stdout.trim();
}
