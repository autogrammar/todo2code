import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const verifier = path.resolve('scripts/verify-workflow-yaml.mjs');
const workspacePreflight = path.resolve('scripts/workspace-preflight.mjs');

test('workflow verifier rejects duplicate top-level YAML keys', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workflow-yaml-'));
  const valid = path.join(root, 'valid.yml');
  const duplicate = path.join(root, 'duplicate.yml');
  await fs.writeFile(valid, 'name: ci\non:\n  push:\njobs:\n  test:\n    runs-on: ubuntu-latest\n');
  await fs.writeFile(duplicate, 'name: ci\non:\n  push:\non:\n  schedule:\n');

  await assert.doesNotReject(() => exec(process.execPath, [verifier, valid]));
  await assert.rejects(
    () => exec(process.execPath, [verifier, duplicate]),
    (error: unknown) => error instanceof Error && /duplicate top-level key "on"/.test(error.message),
  );
});

test('workspace preflight help and required input fail before repository inspection', async () => {
  const help = await run(process.execPath, [workspacePreflight, '--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /^Usage: make preflight /);
  assert.equal(help.stderr, '');

  const missing = await run(process.execPath, [workspacePreflight, '--root', '/does/not/exist']);
  assert.deepEqual(missing, {
    code: 1,
    stdout: '',
    stderr: 'workspace preflight input error: expected branch is required\n',
  });

  const unsafe = await run(process.execPath, [workspacePreflight,
    '--root', '/does/not/exist', '--baseline', 'origin/main', '--expected-branch', 'main']);
  assert.equal(unsafe.code, 1);
  assert.match(unsafe.stderr, /WS-BASE-002: baselineRef must be a safe full local ref/);
  assert.doesNotMatch(unsafe.stderr, /WS-ROOT-001/);
});

test('workspace preflight maps canonical PASS and BLOCKED reports without Git mutation', async (t) => {
  const fixture = await createWorkspaceFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const arguments_ = [workspacePreflight,
    '--root', fixture.root,
    '--baseline', 'refs/remotes/origin/main',
    '--expected-branch', 'main',
    '--actor', 'agent'];
  const cleanBefore = await repositoryState(fixture.root);

  const passing = await run(process.execPath, arguments_);
  assert.equal(passing.code, 0);
  assert.equal(passing.stderr, '');
  const passReport = JSON.parse(passing.stdout);
  assert.equal(passReport.schemaVersion, 't2c.workspace-preflight/v1');
  assert.equal(passReport.verdict, 'PASS');
  assert.equal(passing.stdout, `${JSON.stringify(passReport)}\n`);
  assert.deepEqual(await repositoryState(fixture.root), cleanBefore);

  await fs.writeFile(path.join(fixture.root, 'tracked.txt'), 'dirty\n', 'utf8');
  const dirtyBefore = await repositoryState(fixture.root);
  const blocked = await run(process.execPath, arguments_);
  assert.equal(blocked.code, 2);
  assert.equal(blocked.stderr, '');
  const blockedReport = JSON.parse(blocked.stdout);
  assert.equal(blockedReport.schemaVersion, 't2c.workspace-preflight/v1');
  assert.equal(blockedReport.verdict, 'BLOCKED');
  assert.deepEqual(blockedReport.diagnostics.map((item: { code: string }) => item.code), ['WS-DIRTY-005']);
  assert.equal(blocked.stdout, `${JSON.stringify(blockedReport)}\n`);
  assert.deepEqual(await repositoryState(fixture.root), dirtyBefore);
});

test('Make quotes caller input as one argument in its preflight recipe', async () => {
  const result = await exec('make', ['--dry-run', 'preflight', 'PREFLIGHT_EXPECTED_BRANCH=branch; exit 99'], {
    encoding: 'utf8',
  });
  assert.match(result.stdout, /npm run build/);
  assert.match(result.stdout, /node scripts\/workspace-preflight\.mjs/);
  assert.match(result.stdout, /--expected-branch 'branch; exit 99'/);
});

test('Make preflight reserves stdout for one canonical report', async (t) => {
  const fixture = await createWorkspaceFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const before = await repositoryState(fixture.root);
  const result = await run('make', [
    '--no-print-directory',
    'preflight',
    `PREFLIGHT_ROOT=${fixture.root}`,
    'PREFLIGHT_BASELINE=refs/remotes/origin/main',
    'PREFLIGHT_EXPECTED_BRANCH=main',
    'PREFLIGHT_ACTOR=agent',
  ]);

  assert.equal(result.code, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 't2c.workspace-preflight/v1');
  assert.equal(report.verdict, 'PASS');
  assert.equal(result.stdout, `${JSON.stringify(report)}\n`);
  assert.match(result.stderr, /> todo2code@.* build/);
  assert.deepEqual(await repositoryState(fixture.root), before);
});

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function run(
  command: string,
  args: string[],
  environment: Record<string, string> = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

async function createWorkspaceFixture(): Promise<{ parent: string; root: string }> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-command-'));
  const root = path.join(parent, 'repo');
  await fs.mkdir(root);
  await git(root, 'init', '-q', '--initial-branch=main');
  await git(root, 'config', 'user.email', 'fixture@todo2code.local');
  await git(root, 'config', 'user.name', 'todo2code fixture');
  await fs.mkdir(path.join(root, '.governance'));
  await fs.writeFile(path.join(root, '.governance', 'governance_check.py'), WORKSPACE_CHECKER, { mode: 0o755 });
  await fs.writeFile(path.join(root, 'tracked.txt'), 'base\n', 'utf8');
  await git(root, 'add', '.');
  await git(root, 'commit', '-q', '-m', 'base');
  await git(root, 'update-ref', 'refs/remotes/origin/main', await git(root, 'rev-parse', 'HEAD'));
  return { parent, root };
}

async function repositoryState(root: string): Promise<Record<string, string>> {
  return {
    head: await git(root, 'rev-parse', 'HEAD'),
    index: await git(root, 'write-tree'),
    status: await git(root, 'status', '--porcelain=v2', '--untracked-files=all'),
    refs: await git(root, 'for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)'),
    stash: await git(root, 'stash', 'list'),
    remotes: await git(root, 'remote', '-v'),
  };
}

async function git(root: string, ...args: string[]): Promise<string> {
  const result = await exec('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  return result.stdout.trim();
}

const WORKSPACE_CHECKER = `#!/usr/bin/env python3
import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument('--root')
parser.add_argument('--manifest')
parser.add_argument('--lock')
parser.add_argument('--stack-profiles')
parser.add_argument('--base')
parser.add_argument('--head')
parser.add_argument('--actor')
parser.add_argument('--resolved-ticket-output')
parser.add_argument('--format')
parser.add_argument('--changed-file', action='append', default=[])
parser.parse_args()

print(json.dumps({
    'schema': 'new-project.governance-report/v1',
    'runtimeVersion': 'fixture-1',
    'status': 'passed',
    'summary': {'errors': 0, 'findings': 0, 'warnings': 0},
    'findings': [],
}))
`;
