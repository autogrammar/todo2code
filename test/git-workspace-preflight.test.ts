import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  inspectWorkspace,
  parsePorcelainV2,
  WorkspacePreflightError,
  type WorkspacePreflightReport,
} from '../src/services/workspace-preflight.js';

const exec = promisify(execFile);
const BASELINE = 'refs/heads/main';

interface Fixture {
  parent: string;
  root: string;
}

test('clean expected branch produces an exact deterministic PASS without changing Git state', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const before = await repositoryState(fixture.root);

  const first = await inspect(fixture);
  const second = await inspect(fixture);

  assert.equal(first.verdict, 'PASS');
  assert.equal(first.branch, 'main');
  assert.equal(first.headSha, await git(fixture.root, 'rev-parse', 'HEAD'));
  assert.equal(first.baseline.sha, await git(fixture.root, 'rev-parse', BASELINE));
  assert.deepEqual(first.baseline, { ref: BASELINE, sha: first.headSha, aheadBy: 0, behindBy: 0 });
  assert.deepEqual(first.dirtyEntries, []);
  assert.deepEqual(first.diagnostics, []);
  assert.equal(first.activeTicket, null);
  assert.equal(first.governance.status, 'passed');
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first, second);
  assert.equal(Object.hasOwn(first, 'generatedAt'), false);
  assert.equal(JSON.stringify(first).includes(fixture.root), false);
  assert.deepEqual(await repositoryState(fixture.root), before);
});

test('tracked, untracked and renamed paths are sorted and block a dirty workspace', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  await fs.writeFile(path.join(fixture.root, 'tracked.txt'), 'modified\n', 'utf8');
  await fs.writeFile(path.join(fixture.root, 'z untracked.txt'), 'new\n', 'utf8');
  await git(fixture.root, 'mv', 'rename-me.txt', 'a renamed.txt');
  const before = await repositoryState(fixture.root);

  const result = await inspect(fixture);

  assert.equal(result.verdict, 'BLOCKED');
  assert.deepEqual(result.dirtyEntries.map((item) => [item.kind, item.path, item.originalPath ?? null]), [
    ['renamed', 'a renamed.txt', 'rename-me.txt'],
    ['tracked', 'tracked.txt', null],
    ['untracked', 'z untracked.txt', null],
  ]);
  assert.deepEqual(result.diagnostics.map((item) => item.code), ['WS-DIRTY-005']);
  assert.deepEqual(result.safeActions, ['PRESERVE_CHANGES', 'USE_ISOLATED_WORKTREE']);
  assert.deepEqual(await repositoryState(fixture.root), before);
});

test('porcelain-v2 conflict facts and path bounds fail closed deterministically', () => {
  const conflict = Buffer.from(`u UU N... 100644 100644 100644 100644 ${'a'.repeat(40)} ${'b'.repeat(40)} ${'c'.repeat(40)} conflict file.txt\0`);
  assert.deepEqual(parsePorcelainV2(conflict), [{
    kind: 'conflicted', path: 'conflict file.txt', indexStatus: 'U', worktreeStatus: 'U',
  }]);
  const excessive = Buffer.from(Array.from({ length: 4097 }, (_, index) => `? path-${index}`).join('\0') + '\0');
  assert.throws(() => parsePorcelainV2(excessive), (error: unknown) => hasCode(error, 'WS-DIRTY-005'));
  assert.throws(() => parsePorcelainV2(Buffer.from('? ../escape\0')), (error: unknown) => hasCode(error, 'WS-DIRTY-005'));
});

test('behind, detached and unexpected branches expose stable diagnostics and safe actions', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  await git(fixture.root, 'branch', 'stale');
  await fs.writeFile(path.join(fixture.root, 'advance.txt'), 'advance\n', 'utf8');
  await git(fixture.root, 'add', 'advance.txt');
  await git(fixture.root, 'commit', '-q', '-m', 'advance main');
  await git(fixture.root, 'switch', '-q', 'stale');

  const stale = await inspect(fixture, 'stale');
  assert.equal(stale.verdict, 'BLOCKED');
  assert.deepEqual(stale.diagnostics.map((item) => item.code), ['WS-SYNC-004']);
  assert.deepEqual(stale.safeActions, ['FAST_FORWARD_AFTER_PRESERVE']);
  assert.equal(stale.baseline.behindBy, 1);
  assert.equal(stale.baseline.aheadBy, 0);

  await git(fixture.root, 'checkout', '-q', '--detach');
  const detached = await inspect(fixture, 'stale');
  assert.deepEqual(detached.diagnostics.map((item) => item.code), ['WS-BRANCH-003', 'WS-SYNC-004']);
  assert.ok(detached.safeActions.includes('USE_ISOLATED_WORKTREE'));

  await git(fixture.root, 'switch', '-q', 'stale');
  const wrong = await inspect(fixture, 'main');
  assert.deepEqual(wrong.diagnostics.map((item) => item.code), ['WS-BRANCH-003', 'WS-SYNC-004']);
});

test('an ahead-only isolated branch remains usable but records a sync warning', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  await git(fixture.root, 'switch', '-q', '-c', 'ticket-123');
  await fs.writeFile(path.join(fixture.root, 'docs.txt'), 'plan\n', 'utf8');
  await git(fixture.root, 'add', 'docs.txt');
  await git(fixture.root, 'commit', '-q', '-m', 'plan');

  const result = await inspect(fixture, 'ticket-123');
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.baseline.aheadBy, 1);
  assert.equal(result.baseline.behindBy, 0);
  assert.deepEqual(result.diagnostics, [{
    code: 'WS-SYNC-004', severity: 'WARNING',
    message: 'workspace contains local commits beyond baseline', evidence: ['ahead=1', 'behind=0'],
  }]);
});

test('managed governance findings remain authoritative and unresolved scope blocks', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  await fs.writeFile(path.join(fixture.root, 'fail-governance'), 'trigger\n', 'utf8');

  const result = await inspect(fixture);

  assert.equal(result.governance.status, 'failed');
  assert.deepEqual(result.governance.findings, [{
    code: 'GOV-SCOPE-001', message: 'fixture scope failure', remediation: 'fix fixture', severity: 'ERROR', paths: [],
  }]);
  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    'WS-DIRTY-005', 'WS-GOVERNANCE-006', 'WS-TICKET-007',
  ]);
  assert.ok(result.safeActions.includes('RESOLVE_TICKET_SCOPE'));
});

test('governance process failures keep their domain code and redact stderr', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  const sensitiveStderr = 'fixture-sensitive-stderr';
  const checker = `#!/usr/bin/env python3\nimport sys\nsys.stderr.write('${sensitiveStderr}')\nsys.exit(2)\n`;
  await fs.writeFile(path.join(fixture.root, '.governance', 'governance_check.py'), checker, { mode: 0o755 });

  await assert.rejects(() => inspect(fixture), (error: unknown) => {
    assert.ok(error instanceof WorkspacePreflightError);
    assert.equal(error.code, 'WS-GOVERNANCE-006');
    assert.equal(error.message.includes(sensitiveStderr), false);
    assert.match(error.message, /stderrBytes=24 stderrSha256=[a-f0-9]{64}$/);
    return true;
  });
});

test('implementation paths receive only the ticket selected by managed governance', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  await fs.mkdir(path.join(fixture.root, 'src'));
  await fs.writeFile(path.join(fixture.root, 'src', 'change.ts'), 'export {};\n', 'utf8');

  const result = await inspect(fixture);

  assert.equal(result.activeTicket, 'ticket-123');
  assert.equal(result.governance.status, 'passed');
  assert.equal(result.verdict, 'BLOCKED');
  assert.deepEqual(result.diagnostics.map((item) => item.code), ['WS-DIRTY-005']);
});

test('invalid roots, refs, checker output and options fail closed with stable codes', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  await assert.rejects(() => inspectWorkspace({
    root: fixture.parent, baselineRef: BASELINE, expectedBranch: 'main',
  }), (error: unknown) => hasCode(error, 'WS-ROOT-001'));
  await assert.rejects(() => inspectWorkspace({
    root: fixture.root, baselineRef: 'main', expectedBranch: 'main',
  }), (error: unknown) => hasCode(error, 'WS-BASE-002'));
  await assert.rejects(() => inspectWorkspace({
    root: fixture.root, baselineRef: 'refs/heads/missing', expectedBranch: 'main',
  }), (error: unknown) => hasCode(error, 'WS-BASE-002'));
  await git(fixture.root, 'symbolic-ref', 'refs/heads/symbolic', BASELINE);
  await assert.rejects(() => inspectWorkspace({
    root: fixture.root, baselineRef: 'refs/heads/symbolic', expectedBranch: 'main',
  }), (error: unknown) => hasCode(error, 'WS-BASE-002'));

  await fs.writeFile(path.join(fixture.root, '.governance', 'governance_check.py'), '#!/usr/bin/env python3\nprint("not-json")\n', 'utf8');
  await assert.rejects(() => inspect(fixture), (error: unknown) => hasCode(error, 'WS-GOVERNANCE-006'));
  await fs.rm(path.join(fixture.root, '.governance', 'governance_check.py'));
  await assert.rejects(() => inspect(fixture), (error: unknown) => hasCode(error, 'WS-GOVERNANCE-006'));
  await fs.writeFile(path.join(fixture.root, '.governance', 'governance_check.py'), CHECKER, { mode: 0o755 });
  await assert.rejects(() => inspectWorkspace({
    root: fixture.root, baselineRef: BASELINE, expectedBranch: 'main', pythonExecutable: 'missing-python-command',
  }), (error: unknown) => hasCode(error, 'WS-GOVERNANCE-006'));
});

test('report has no command, credential or absolute-root output and failure is read-only', async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.parent, { recursive: true, force: true }));
  await fs.writeFile(path.join(fixture.root, 'tracked.txt'), 'dirty\n', 'utf8');
  const before = await repositoryState(fixture.root);

  const result = await inspect(fixture);
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes(fixture.root), false);
  assert.equal(/(?:command|credential|token|password|secret)/i.test(serialized), false);
  assert.deepEqual(await repositoryState(fixture.root), before);
});

async function inspect(fixture: Fixture, expectedBranch = 'main'): Promise<WorkspacePreflightReport> {
  return inspectWorkspace({ root: fixture.root, baselineRef: BASELINE, expectedBranch, actor: 'agent' });
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof WorkspacePreflightError && error.code === code;
}

async function createFixture(): Promise<Fixture> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-preflight-test-'));
  const root = path.join(parent, 'repo');
  await fs.mkdir(root);
  await git(root, 'init', '-q', '--initial-branch=main');
  await git(root, 'config', 'user.email', 'fixture@todo2code.local');
  await git(root, 'config', 'user.name', 'todo2code fixture');
  await fs.mkdir(path.join(root, '.governance'));
  await fs.writeFile(path.join(root, '.governance', 'governance_check.py'), CHECKER, { mode: 0o755 });
  await fs.writeFile(path.join(root, 'tracked.txt'), 'base\n', 'utf8');
  await fs.writeFile(path.join(root, 'rename-me.txt'), 'rename\n', 'utf8');
  await git(root, 'add', '.');
  await git(root, 'commit', '-q', '-m', 'base');
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
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  return result.stdout.trim();
}

const CHECKER = `#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys

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
args = parser.parse_args()

failed = pathlib.Path('fail-governance').exists()
findings = []
if failed:
    findings.append({
        'code': 'GOV-SCOPE-001',
        'message': 'fixture scope failure',
        'remediation': 'fix fixture',
        'severity': 'ERROR',
        'paths': [],
    })
if not failed and any(item.startswith(('src/', 'test/')) for item in args.changed_file):
    pathlib.Path(args.resolved_ticket_output).write_text('ticket-123\\n', encoding='utf-8')
payload = {
    'schema': 'new-project.governance-report/v1',
    'runtimeVersion': 'fixture-1',
    'status': 'failed' if failed else 'passed',
    'summary': {'errors': len(findings), 'findings': len(findings), 'warnings': 0},
    'findings': findings,
}
print(json.dumps(payload))
sys.exit(1 if failed else 0)
`;
