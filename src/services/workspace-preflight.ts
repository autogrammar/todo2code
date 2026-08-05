import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256, stableStringify } from '../core/id.js';
export type WorkspaceActor = 'agent' | 'human' | 'ci';
export type WorkspaceEntryKind = 'tracked' | 'untracked' | 'renamed' | 'conflicted';
export type WorkspaceDiagnosticCode = 'WS-ROOT-001' | 'WS-BASE-002' | 'WS-BRANCH-003'
  | 'WS-SYNC-004' | 'WS-DIRTY-005' | 'WS-GOVERNANCE-006' | 'WS-TICKET-007';
export type WorkspaceSafeAction = 'PRESERVE_CHANGES' | 'USE_ISOLATED_WORKTREE'
  | 'FAST_FORWARD_AFTER_PRESERVE' | 'RESOLVE_TICKET_SCOPE';
export interface WorkspacePreflightOptions {
  root: string;
  baselineRef: string;
  expectedBranch: string;
  actor?: WorkspaceActor;
  pythonExecutable?: string;
}
export interface WorkspaceDirtyEntry {
  kind: WorkspaceEntryKind;
  path: string;
  originalPath?: string;
  indexStatus: string;
  worktreeStatus: string;
}
export interface WorkspaceDiagnostic {
  code: WorkspaceDiagnosticCode;
  severity: 'ERROR' | 'WARNING';
  message: string;
  evidence: string[];
}
export interface WorkspaceGovernanceReport {
  schema: string;
  runtimeVersion: string;
  status: 'passed' | 'failed';
  summary: { errors: number; findings: number; warnings: number };
  findings: unknown[];
}
export interface WorkspacePreflightReport {
  schemaVersion: 't2c.workspace-preflight/v1';
  root: '.';
  branch: string | null;
  expectedBranch: string;
  headSha: string;
  baseline: { ref: string; sha: string; aheadBy: number; behindBy: number };
  dirtyEntries: WorkspaceDirtyEntry[];
  activeTicket: string | null;
  governance: WorkspaceGovernanceReport;
  diagnostics: WorkspaceDiagnostic[];
  safeActions: WorkspaceSafeAction[];
  verdict: 'PASS' | 'BLOCKED';
  fingerprint: string;
}
interface CommandResult { exitCode: number; stdout: Buffer; stderr: string }
interface GovernanceResult { report: WorkspaceGovernanceReport; activeTicket: string | null }
const SHA = /^[a-f0-9]{40}$/;
const FULL_REF = /^refs\/(?:heads|remotes)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$/;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$/;
const TICKET = /^ticket-\d{3,}$/;
const MAX_OUTPUT = 64 * 1024 * 1024;
const MAX_DIRTY_PATHS = 4096;
const MAX_CHANGED_ARGUMENT_BYTES = 256 * 1024;

export class WorkspacePreflightError extends Error {
  constructor(public readonly code: WorkspaceDiagnosticCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'WorkspacePreflightError';
  }
}

export async function inspectWorkspace(options: WorkspacePreflightOptions): Promise<WorkspacePreflightReport> {
  validateOptions(options);
  const root = await repositoryRoot(options.root);
  const baselineSha = await resolveBaseline(root, options.baselineRef);
  const headSha = await requiredSha(root, ['rev-parse', '--verify', 'HEAD^{commit}'], 'HEAD');
  const branch = await currentBranch(root);
  const { aheadBy, behindBy } = await aheadBehind(root, baselineSha, headSha);
  const dirtyEntries = parsePorcelainV2((await requiredGit(root, [
    'status', '--porcelain=v2', '-z', '--untracked-files=all',
  ], 'status')).stdout);
  const changedPaths = await governanceChangedPaths(root, baselineSha, headSha, dirtyEntries);
  const governance = await runGovernance(root, options, baselineSha, headSha, changedPaths);
  const diagnostics = buildDiagnostics(options, branch, aheadBy, behindBy, dirtyEntries, governance);
  const safeActions = actionsFor(diagnostics);
  const semantic = {
    schemaVersion: 't2c.workspace-preflight/v1' as const,
    root: '.' as const,
    branch,
    expectedBranch: options.expectedBranch,
    headSha,
    baseline: { ref: options.baselineRef, sha: baselineSha, aheadBy, behindBy },
    dirtyEntries,
    activeTicket: governance.activeTicket,
    governance: governance.report,
    diagnostics,
    safeActions,
    verdict: diagnostics.some((item) => item.severity === 'ERROR') ? 'BLOCKED' as const : 'PASS' as const,
  };
  return { ...semantic, fingerprint: sha256(stableStringify(semantic)) };
}

const validateOptions = (options: WorkspacePreflightOptions): void => {
  if (!options || typeof options !== 'object') {
    throw new WorkspacePreflightError('WS-ROOT-001', 'workspace preflight options are required');
  }
  validateRootOption(options.root);
  validateBaselineOption(options.baselineRef);
  validateBranchOption(options.expectedBranch);
  validateRuntimeOptions(options.actor, options.pythonExecutable);
};

const validateRootOption = (root: string): void => {
  if (typeof root !== 'string' || root.trim() === '') {
    throw new WorkspacePreflightError('WS-ROOT-001', 'root must name a Git worktree');
  }
};

const validateBaselineOption = (baselineRef: string): void => {
  const invalidRef = typeof baselineRef !== 'string'
    || !FULL_REF.test(baselineRef)
    || baselineRef.includes('..')
    || baselineRef.includes('//')
    || baselineRef.includes('@{')
    || baselineRef.endsWith('/')
    || baselineRef.endsWith('.lock');
  if (invalidRef) throw new WorkspacePreflightError('WS-BASE-002', 'baselineRef must be a safe full local ref');
};

const validateBranchOption = (expectedBranch: string): void => {
  if (typeof expectedBranch !== 'string'
    || !BRANCH.test(expectedBranch)
    || expectedBranch.includes('..')
    || expectedBranch.includes('//')) {
    throw new WorkspacePreflightError('WS-BRANCH-003', 'expectedBranch is invalid');
  }
};

const validateRuntimeOptions = (actor: WorkspaceActor | undefined, pythonExecutable: string | undefined): void => {
  if (actor !== undefined && !['agent', 'human', 'ci'].includes(actor)) {
    throw new WorkspacePreflightError('WS-GOVERNANCE-006', 'actor must be agent, human or ci');
  }
  if (pythonExecutable !== undefined && (pythonExecutable.trim() === '' || pythonExecutable.startsWith('-'))) {
    throw new WorkspacePreflightError('WS-GOVERNANCE-006', 'pythonExecutable is invalid');
  }
};

async function repositoryRoot(requestedRoot: string): Promise<string> {
  let requested: string;
  try {
    requested = await fs.realpath(path.resolve(requestedRoot));
    if (!(await fs.stat(requested)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new WorkspacePreflightError('WS-ROOT-001', 'root is not a Git worktree');
  }
  const result = await run(requested, 'git', ['--no-optional-locks', 'rev-parse', '--show-toplevel']);
  if (result.exitCode !== 0) throw new WorkspacePreflightError('WS-ROOT-001', 'root is not a Git worktree');
  const discovered = await fs.realpath(result.stdout.toString('utf8').trim());
  if (discovered !== requested) {
    throw new WorkspacePreflightError('WS-ROOT-001', 'root must be the worktree top level');
  }
  return requested;
}

async function resolveBaseline(root: string, ref: string): Promise<string> {
  const symbolic = await runGit(root, ['symbolic-ref', '-q', ref]);
  if (symbolic.exitCode === 0) {
    throw new WorkspacePreflightError('WS-BASE-002', `symbolic baseline ref is not allowed: ${ref}`);
  }
  if (symbolic.exitCode !== 1) {
    throw new WorkspacePreflightError('WS-BASE-002', `baseline ref could not be inspected: ${ref}`);
  }
  return requiredSha(root, ['rev-parse', '--verify', `${ref}^{commit}`], `baseline ref ${ref}`);
}

async function requiredSha(root: string, args: string[], label: string): Promise<string> {
  const result = await runGit(root, args);
  const value = result.stdout.toString('utf8').trim();
  if (result.exitCode !== 0 || !SHA.test(value)) {
    throw new WorkspacePreflightError('WS-BASE-002', `${label} is missing or unresolved`);
  }
  return value;
}

async function currentBranch(root: string): Promise<string | null> {
  const result = await runGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (result.exitCode === 1) return null;
  if (result.exitCode !== 0 || !BRANCH.test(result.stdout.toString('utf8').trim())) {
    throw new WorkspacePreflightError('WS-BRANCH-003', 'current branch could not be resolved');
  }
  return result.stdout.toString('utf8').trim();
}

async function aheadBehind(root: string, baselineSha: string, headSha: string): Promise<{ aheadBy: number; behindBy: number }> {
  const result = await requiredGit(root, ['rev-list', '--left-right', '--count', `${baselineSha}...${headSha}`], 'rev-list');
  const match = /^(\d+)\s+(\d+)\s*$/.exec(result.stdout.toString('utf8'));
  if (!match) throw new WorkspacePreflightError('WS-SYNC-004', 'ahead/behind output is malformed');
  const behindBy = Number(match[1]);
  const aheadBy = Number(match[2]);
  if (!Number.isSafeInteger(aheadBy) || !Number.isSafeInteger(behindBy)) {
    throw new WorkspacePreflightError('WS-SYNC-004', 'ahead/behind values are unsafe');
  }
  return { aheadBy, behindBy };
}

export function parsePorcelainV2(raw: Buffer): WorkspaceDirtyEntry[] {
  const records = raw.toString('utf8').split('\0');
  const output: WorkspaceDirtyEntry[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.startsWith('? ')) {
      output.push(entry('untracked', safePath(record.slice(2)), '?', '?'));
      continue;
    }
    if (record.startsWith('! ')) continue;
    const tag = record[0];
    if (tag === '1') {
      const { fields, remainder } = splitFixed(record, 8);
      output.push(entry('tracked', safePath(remainder), status(fields, 1, 0), status(fields, 1, 1)));
      continue;
    }
    if (tag === '2') {
      const { fields, remainder } = splitFixed(record, 9);
      const original = records[index + 1];
      if (!original) throw new WorkspacePreflightError('WS-DIRTY-005', 'rename record has no original path');
      index += 1;
      output.push({
        ...entry('renamed', safePath(remainder), status(fields, 1, 0), status(fields, 1, 1)),
        originalPath: safePath(original),
      });
      continue;
    }
    if (tag === 'u') {
      const { fields, remainder } = splitFixed(record, 10);
      output.push(entry('conflicted', safePath(remainder), status(fields, 1, 0), status(fields, 1, 1)));
      continue;
    }
    throw new WorkspacePreflightError('WS-DIRTY-005', `unsupported porcelain-v2 record: ${tag ?? ''}`);
  }
  if (output.length > MAX_DIRTY_PATHS) {
    throw new WorkspacePreflightError('WS-DIRTY-005', `more than ${MAX_DIRTY_PATHS} dirty paths`);
  }
  return output.sort((left, right) => left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || (left.originalPath ?? '').localeCompare(right.originalPath ?? ''));
}

function splitFixed(record: string, count: number): { fields: string[]; remainder: string } {
  const fields: string[] = [];
  let remainder = record;
  for (let index = 0; index < count; index += 1) {
    const separator = remainder.indexOf(' ');
    if (separator < 0) throw new WorkspacePreflightError('WS-DIRTY-005', 'malformed porcelain-v2 record');
    fields.push(remainder.slice(0, separator));
    remainder = remainder.slice(separator + 1);
  }
  if (!remainder) throw new WorkspacePreflightError('WS-DIRTY-005', 'porcelain-v2 path is empty');
  return { fields, remainder };
}

const status = (fields: string[], field: number, offset: number): string => {
  const pair = fields[field];
  if (!pair || pair.length !== 2) throw new WorkspacePreflightError('WS-DIRTY-005', 'porcelain-v2 status is malformed');
  return pair[offset] ?? '.';
};

const entry = (
  kind: WorkspaceEntryKind,
  relativePath: string,
  indexStatus: string,
  worktreeStatus: string,
): WorkspaceDirtyEntry => ({ kind, path: relativePath, indexStatus, worktreeStatus });

function safePath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized || normalized.includes('\0') || path.posix.isAbsolute(normalized)
    || normalized.split('/').some((part) => part === '..')) {
    throw new WorkspacePreflightError('WS-DIRTY-005', 'Git returned an unsafe repository path');
  }
  return normalized;
}

async function governanceChangedPaths(
  root: string,
  baselineSha: string,
  headSha: string,
  dirty: WorkspaceDirtyEntry[],
): Promise<string[]> {
  const committed = await requiredGit(root, [
    'diff', '--name-only', '-z', `${baselineSha}...${headSha}`,
  ], 'diff');
  const paths = new Set(committed.stdout.toString('utf8').split('\0').filter(Boolean).map(safePath));
  for (const item of dirty) {
    paths.add(item.path);
    if (item.originalPath) paths.add(item.originalPath);
  }
  if (paths.size > MAX_DIRTY_PATHS) {
    throw new WorkspacePreflightError('WS-DIRTY-005', `more than ${MAX_DIRTY_PATHS} changed paths`);
  }
  const sorted = [...paths].sort();
  if (sorted.reduce((total, item) => total + Buffer.byteLength(item) + 16, 0) > MAX_CHANGED_ARGUMENT_BYTES) {
    throw new WorkspacePreflightError('WS-DIRTY-005', 'changed-path arguments exceed the safe local process bound');
  }
  return sorted;
}

async function runGovernance(
  root: string,
  options: WorkspacePreflightOptions,
  baselineSha: string,
  headSha: string,
  changedPaths: string[],
): Promise<GovernanceResult> {
  const checker = path.join(root, '.governance', 'governance_check.py');
  try {
    if (!(await fs.stat(checker)).isFile()) throw new Error('not a file');
  } catch {
    throw new WorkspacePreflightError('WS-GOVERNANCE-006', 'managed governance checker is missing');
  }
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-preflight-'));
  const ticketOutput = path.join(temporary, 'ticket.txt');
  try {
    const args = [
      checker,
      '--root', '.',
      '--manifest', '.governance/manifest.json',
      '--lock', '.governance/manifest.lock.json',
      '--stack-profiles', '.governance/stack-profiles.json',
      '--base', baselineSha,
      '--head', headSha,
      '--actor', options.actor ?? 'agent',
      '--resolved-ticket-output', ticketOutput,
      '--format', 'json',
      ...changedPaths.flatMap((item) => ['--changed-file', item]),
    ];
    const result = await run(root, options.pythonExecutable ?? 'python3', args, {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
    });
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw new WorkspacePreflightError('WS-GOVERNANCE-006', 'managed governance checker could not run');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout.toString('utf8'));
    } catch {
      throw new WorkspacePreflightError('WS-GOVERNANCE-006', 'managed governance JSON is malformed');
    }
    const report = validateGovernanceReport(parsed);
    if ((result.exitCode === 0) !== (report.status === 'passed')) {
      throw new WorkspacePreflightError('WS-GOVERNANCE-006', 'managed governance exit status contradicts its report');
    }
    let activeTicket: string | null = null;
    try {
      activeTicket = (await fs.readFile(ticketOutput, 'utf8')).trim() || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (activeTicket !== null && !TICKET.test(activeTicket)) {
      throw new WorkspacePreflightError('WS-TICKET-007', 'managed governance returned an invalid ticket identifier');
    }
    return { report, activeTicket };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

const validateGovernanceReport = (value: unknown): WorkspaceGovernanceReport => {
  if (!isObject(value)) throw governanceContractViolation();
  const schema = requiredGovernanceString(value.schema);
  const runtimeVersion = requiredGovernanceString(value.runtimeVersion);
  const status = governanceStatus(value.status);
  const summary = governanceSummary(value.summary);
  const findings = governanceFindings(value.findings, summary.findings);
  return { schema, runtimeVersion, status, summary, findings };
};

const requiredGovernanceString = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) throw governanceContractViolation();
  return value;
};

const governanceStatus = (value: unknown): 'passed' | 'failed' => {
  if (value !== 'passed' && value !== 'failed') throw governanceContractViolation();
  return value;
};

const governanceSummary = (value: unknown): WorkspaceGovernanceReport['summary'] => {
  if (!isObject(value) || !isCount(value.errors) || !isCount(value.findings) || !isCount(value.warnings)) {
    throw governanceContractViolation();
  }
  return { errors: value.errors, findings: value.findings, warnings: value.warnings };
};

const governanceFindings = (value: unknown, expectedCount: number): unknown[] => {
  if (!Array.isArray(value) || value.length !== expectedCount) throw governanceContractViolation();
  for (const finding of value) {
    if (!isObject(finding) || typeof finding.code !== 'string' || !finding.code.startsWith('GOV-')) {
      throw new WorkspacePreflightError('WS-GOVERNANCE-006', 'managed governance finding is invalid');
    }
  }
  return value;
};

const governanceContractViolation = (): WorkspacePreflightError => new WorkspacePreflightError(
  'WS-GOVERNANCE-006',
  'managed governance report violates its JSON contract',
);

function buildDiagnostics(
  options: WorkspacePreflightOptions,
  branch: string | null,
  aheadBy: number,
  behindBy: number,
  dirty: WorkspaceDirtyEntry[],
  governance: GovernanceResult,
): WorkspaceDiagnostic[] {
  const diagnostics: WorkspaceDiagnostic[] = [];
  if (branch !== options.expectedBranch) diagnostics.push({
    code: 'WS-BRANCH-003', severity: 'ERROR',
    message: branch === null ? 'HEAD is detached' : 'current branch differs from expected branch',
    evidence: [branch ?? 'DETACHED', options.expectedBranch].sort(),
  });
  if (aheadBy !== 0 || behindBy !== 0) diagnostics.push({
    code: 'WS-SYNC-004', severity: behindBy > 0 ? 'ERROR' : 'WARNING',
    message: behindBy > 0 ? 'workspace is behind or diverged from baseline' : 'workspace contains local commits beyond baseline',
    evidence: [`ahead=${aheadBy}`, `behind=${behindBy}`],
  });
  if (dirty.length > 0) diagnostics.push({
    code: 'WS-DIRTY-005', severity: 'ERROR', message: 'workspace contains uncommitted changes',
    evidence: dirty.map((item) => item.path),
  });
  if (governance.report.status === 'failed' || governance.report.findings.length > 0) diagnostics.push({
    code: 'WS-GOVERNANCE-006', severity: 'ERROR', message: 'managed governance reported findings',
    evidence: governance.report.findings
      .map((finding) => isObject(finding) && typeof finding.code === 'string' ? finding.code : 'GOV-UNKNOWN')
      .sort(),
  });
  if (governance.report.status === 'failed' && governance.activeTicket === null) diagnostics.push({
    code: 'WS-TICKET-007', severity: 'ERROR', message: 'governance did not resolve one active ticket',
    evidence: ['activeTicket=null'],
  });
  return diagnostics.sort((left, right) => left.code.localeCompare(right.code));
}

function actionsFor(diagnostics: WorkspaceDiagnostic[]): WorkspaceSafeAction[] {
  const codes = new Set(diagnostics.map((item) => item.code));
  const actions = new Set<WorkspaceSafeAction>();
  if (codes.has('WS-DIRTY-005')) actions.add('PRESERVE_CHANGES');
  if (codes.has('WS-BRANCH-003') || codes.has('WS-DIRTY-005')) actions.add('USE_ISOLATED_WORKTREE');
  if (codes.has('WS-SYNC-004')) actions.add('FAST_FORWARD_AFTER_PRESERVE');
  if (codes.has('WS-GOVERNANCE-006') || codes.has('WS-TICKET-007')) actions.add('RESOLVE_TICKET_SCOPE');
  return [...actions].sort();
}

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

async function requiredGit(root: string, args: string[], label: string): Promise<CommandResult> {
  const result = await runGit(root, args);
  if (result.exitCode !== 0) throw new WorkspacePreflightError('WS-ROOT-001', `Git ${label} failed`);
  return result;
}

const runGit = (root: string, args: string[]): Promise<CommandResult> => run(
  root,
  'git',
  ['--no-optional-locks', ...args],
  { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
);

function run(root: string, command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let size = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_OUTPUT) child.kill('SIGKILL');
      else stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_OUTPUT) child.kill('SIGKILL');
      else stderr.push(chunk);
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (signal || size > MAX_OUTPUT) {
        reject(new WorkspacePreflightError('WS-ROOT-001', 'local command exceeded its output bound'));
        return;
      }
      resolve({ exitCode: code ?? 1, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString('utf8') });
    });
  });
}
