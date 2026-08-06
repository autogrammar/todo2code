import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { parseEventLog } from '../src/pipeline/event-log.js';

const exec = promisify(execFile);
const verifier = path.resolve('scripts/verify-workflow-yaml.mjs');
const workspacePreflight = path.resolve('scripts/workspace-preflight.mjs');
const githubEventLog = path.resolve('scripts/github-event-log.mjs');
const eventLogFixtures = path.resolve('test/fixtures/event-log/v1/github-event-payloads.json');

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

test('GitHub event collector maps supported push payloads to canonical event logs', async (t) => {
  const payloads = JSON.parse(await fs.readFile(eventLogFixtures, 'utf8')) as Record<string, unknown>;
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-github-event-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const payload = path.join(fixture, 'push.json');
  const output = path.join(fixture, 'push.dsl.txt');
  await fs.writeFile(payload, JSON.stringify(payloads.push, null, 2), 'utf8');

  const runResult = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'push',
    '--event-path',
    payload,
    '--output',
    output,
    '--repository',
    'semcod/todo2code',
    '--ticket',
    'ticket-047',
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'push-047',
    '--stream-id',
    'stream-push-047',
  ]);

  assert.equal(runResult.code, 0);
  const commandResult = JSON.parse(runResult.stdout);
  assert.equal(commandResult.status, 'ok');
  const log = parseEventLog(await fs.readFile(output, 'utf8'));
  assert.equal(log.events.length, 2);
  const pushEvent = log.events.at(0);
  assert.ok(pushEvent);
  const commitEvent = log.events.at(1);
  assert.ok(commitEvent);
  const eventTypes = [pushEvent.type, commitEvent.type].sort();
  assert.deepEqual(eventTypes, ['git.commit.created', 'git.push.received'].sort());
  assert.equal(pushEvent.trustClass, 'SYSTEM_FACT');
  assert.equal(commitEvent.trustClass, 'SYSTEM_FACT');
  assert.match([pushEvent.subjectId, commitEvent.subjectId].join(','), /git:ref\/refs\/heads\/main/);
});

test('GitHub review events are SYSTEM_FACT and cannot become approval attestation', async (t) => {
  const payloads = JSON.parse(await fs.readFile(eventLogFixtures, 'utf8')) as Record<string, unknown>;
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-github-review-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const payload = path.join(fixture, 'review.json');
  const output = path.join(fixture, 'review.dsl.txt');
  await fs.writeFile(payload, JSON.stringify(payloads.pull_request_review, null, 2), 'utf8');

  const runResult = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'pull_request_review',
    '--event-path',
    payload,
    '--output',
    output,
    '--repository',
    'semcod/todo2code',
    '--ticket',
    'ticket-047',
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'review-047',
    '--stream-id',
    'stream-review-047',
  ]);

  assert.equal(runResult.code, 0);
  const log = parseEventLog(await fs.readFile(output, 'utf8'));
  assert.equal(log.events.length, 1);
  const event = log.events.at(0);
  assert.ok(event);
  assert.equal(event.type, 'pull_request.reviewed');
  assert.equal(event.trustClass, 'SYSTEM_FACT');
  assert.equal(event.outcome, 'APPROVED');
});

test('GitHub review with unsupported state fails closed', async (t) => {
  const payloads = JSON.parse(await fs.readFile(eventLogFixtures, 'utf8')) as Record<string, unknown>;
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-github-review-fail-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const payload = path.join(fixture, 'review.json');
  const output = path.join(fixture, 'review.dsl.txt');
  await fs.writeFile(payload, JSON.stringify(payloads.pull_request_review_unsupported, null, 2), 'utf8');

  const runResult = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'pull_request_review',
    '--event-path',
    payload,
    '--output',
    output,
    '--repository',
    'semcod/todo2code',
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'review-047',
    '--stream-id',
    'stream-review-fail-047',
  ]);

  assert.equal(runResult.code, 1);
  assert.match(runResult.stderr, /unsupported pull_request_review state: needs_reply/);
});

test('Evidence projection is allowlisted and extra payload fields do not leak into logs', async (t) => {
  const payloads = JSON.parse(await fs.readFile(eventLogFixtures, 'utf8')) as Record<string, unknown>;
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-github-evidence-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));

  const basePayload = path.join(fixture, 'workflow-run.json');
  const leakPayload = path.join(fixture, 'workflow-run-leak.json');
  const baseOutput = path.join(fixture, 'workflow-run.dsl.txt');
  const leakOutput = path.join(fixture, 'workflow-run-leak.dsl.txt');
  await fs.writeFile(basePayload, JSON.stringify(payloads.workflow_run, null, 2), 'utf8');
  await fs.writeFile(leakPayload, JSON.stringify(payloads.workflow_run_secret, null, 2), 'utf8');

  const runBase = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'workflow_run',
    '--event-path',
    basePayload,
    '--output',
    baseOutput,
    '--repository',
    'semcod/todo2code',
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'workflow-run-047',
    '--stream-id',
    'stream-workflow-047',
  ]);

  const runLeak = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'workflow_run',
    '--event-path',
    leakPayload,
    '--output',
    leakOutput,
    '--repository',
    'semcod/todo2code',
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'workflow-run-047',
    '--stream-id',
    'stream-workflow-047',
  ]);

  assert.equal(runBase.code, 0);
  assert.equal(runLeak.code, 0);
  const baseContent = await fs.readFile(baseOutput, 'utf8');
  const leakContent = await fs.readFile(leakOutput, 'utf8');
  assert.equal(baseContent, leakContent);
  const log = parseEventLog(baseContent);
  const event = log.events.at(0);
  assert.ok(event);
  assert.match(event.evidenceRef, /^github:check-run\/\d+$/);
  assert.doesNotMatch(baseContent, /query/);
  assert.doesNotMatch(baseContent, /raw_payload/);
});

test('GitHub acquisition ignores ambient environment and requires explicit input', async (t) => {
  const payloads = JSON.parse(await fs.readFile(eventLogFixtures, 'utf8')) as Record<string, unknown>;
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-github-env-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const payload = path.join(fixture, 'push.json');
  const output = path.join(fixture, 'push.dsl.txt');
  await fs.writeFile(payload, JSON.stringify(payloads.push, null, 2), 'utf8');

  const ambient = {
    GITHUB_EVENT_PATH: payload,
    GITHUB_REPOSITORY: 'attacker/elsewhere',
  };

  const withoutEventPath = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'push',
    '--output',
    output,
    '--repository',
    'semcod/todo2code',
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'push-048',
    '--stream-id',
    'stream-push-048',
  ], ambient);

  assert.equal(withoutEventPath.code, 1);
  assert.match(withoutEventPath.stderr, /missing --event-path/);
  await assert.rejects(fs.access(output));

  const bare = JSON.parse(JSON.stringify(payloads.push)) as Record<string, unknown>;
  delete bare.repository;
  delete bare.repository_name;
  const barePayload = path.join(fixture, 'push-bare.json');
  await fs.writeFile(barePayload, JSON.stringify(bare, null, 2), 'utf8');

  const withoutRepository = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'push',
    '--event-path',
    barePayload,
    '--output',
    output,
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'push-048',
    '--stream-id',
    'stream-push-048',
  ], ambient);

  assert.equal(withoutRepository.code, 1);
  assert.match(withoutRepository.stderr, /repository is required; pass --repository/);
  assert.doesNotMatch(withoutRepository.stderr, /attacker\/elsewhere/);
  await assert.rejects(fs.access(output));

  const accepted = await run(process.execPath, [
    githubEventLog,
    '--event-name',
    'push',
    '--event-path',
    payload,
    '--output',
    output,
    '--repository',
    'semcod/todo2code',
    '--recorded-at',
    '2026-08-05T08:20:00Z',
    '--correlation-id',
    'push-048',
    '--stream-id',
    'stream-push-048',
  ], ambient);

  assert.equal(accepted.code, 0);
  const log = parseEventLog(await fs.readFile(output, 'utf8'));
  for (const event of log.events) {
    assert.equal(event.source, 'github-actions');
  }
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
