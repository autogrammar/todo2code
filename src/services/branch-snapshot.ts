import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256, stableStringify } from '../core/id.js';

export type BranchTextualMergeStatus = 'clean' | 'conflict' | 'unknown';

export interface BranchGitSnapshotOptions {
  root: string;
  repository: string;
  toolVersion: string;
  baseRef: string;
  candidateRefs: string[];
}

export interface BranchGitBaseSnapshot {
  ref: string;
  sha: string;
  treeSha: string;
}

export interface BranchGitCandidateSnapshot {
  ref: string;
  headSha: string;
  treeSha: string;
  mergeBaseSha: string;
  aheadBy: number;
  behindBy: number;
  changedPaths: string[];
  patchId: string | null;
  baseTextualMerge: BranchTextualMergeStatus;
}

export interface BranchGitInteractionSnapshot {
  left: string;
  right: string;
  textualMerge: BranchTextualMergeStatus;
}

export interface BranchGitMaterialization {
  repository: string;
  toolVersion: string;
  base: BranchGitBaseSnapshot;
  candidates: BranchGitCandidateSnapshot[];
  interactions: BranchGitInteractionSnapshot[];
  fingerprint: string;
}

export interface BranchSnapshotHooks {
  /** Test seam used to prove that a moved ref invalidates the capture. */
  afterCapture?: () => Promise<void>;
  /** Test-only parent used to assert temporary-state cleanup. */
  temporaryParent?: string;
}

interface RefSnapshot {
  ref: string;
  sha: string;
  treeSha: string;
}

interface GitCommandOptions {
  input?: string | Buffer;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stdoutBuffer: Buffer;
  stderr: string;
}

const SHA = /^[a-f0-9]{40}$/;
const PATCH_ID = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const FULL_REF = /^refs\/(?:heads|remotes)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$/;
const MAX_CANDIDATES = 32;
const MAX_CHANGED_PATHS = 4096;
const MAX_GIT_OUTPUT = 64 * 1024 * 1024;

export function assertBranchGitMaterialization(
  value: unknown,
): asserts value is BranchGitMaterialization {
  const materialization = materializationObject<BranchGitMaterialization>(value);
  requireMaterializationKeys(materialization, [
    'repository', 'toolVersion', 'base', 'candidates', 'interactions', 'fingerprint',
  ], 'Branch Git materialization');
  validateMaterializationIdentity(materialization);
  const candidates = validateMaterializationCandidates(materialization.candidates, materialization.base.ref);
  validateMaterializationInteractions(materialization.interactions, candidates);
  const { fingerprint, ...content } = materialization;
  if (!/^[a-f0-9]{64}$/.test(fingerprint)
    || fingerprint !== sha256(stableStringify(content))) {
    throw new Error('Branch Git materialization fingerprint does not match content');
  }
}

export async function materializeBranchGitSnapshot(
  options: BranchGitSnapshotOptions,
  hooks: BranchSnapshotHooks = {},
): Promise<BranchGitMaterialization> {
  validateOptions(options);
  const root = await repositoryRoot(options.root);
  const refs = [options.baseRef, ...options.candidateRefs].sort();
  const captured = new Map<string, RefSnapshot>();
  for (const ref of refs) captured.set(ref, await captureRef(root, ref));

  const base = requiredSnapshot(captured, options.baseRef);
  const temporaryRoot = await fs.mkdtemp(path.join(hooks.temporaryParent ?? os.tmpdir(), 't2c-branch-snapshot-'));
  try {
    const mergeEnvironment = await isolatedObjectEnvironment(root, temporaryRoot);
    const inspect = (mergeRoot: string, left: string, right: string) => inspectTextualMerge(
      mergeRoot,
      left,
      right,
      mergeEnvironment,
    );
    const candidates: BranchGitCandidateSnapshot[] = [];
    for (const ref of [...options.candidateRefs].sort()) {
      candidates.push(await captureCandidate(root, base, requiredSnapshot(captured, ref), inspect));
    }
    const interactions = await captureInteractions(root, candidates, inspect);
    await hooks.afterCapture?.();
    await assertRefsUnchanged(root, captured);
    const result = fingerprintMaterialization({
      repository: options.repository,
      toolVersion: options.toolVersion,
      base: { ref: base.ref, sha: base.sha, treeSha: base.treeSha },
      candidates,
      interactions,
    });
    assertBranchGitMaterialization(result);
    return result;
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

const validateOptions = (options: BranchGitSnapshotOptions): void => {
  if (!options || typeof options !== 'object') throw new Error('Branch snapshot options are required');
  validateSnapshotIdentity(options);
  validateCandidateRefs(options);
};

const validateSnapshotIdentity = (options: BranchGitSnapshotOptions): void => {
  if (typeof options.root !== 'string' || options.root.trim().length === 0) {
    throw new Error('Branch snapshot root must be non-empty');
  }
  if (!REPOSITORY.test(options.repository) || options.repository.includes('..')) {
    throw new Error('Branch snapshot repository must be owner/name');
  }
  if (!VERSION.test(options.toolVersion)) throw new Error('Branch snapshot toolVersion must be semantic version');
  validateRef(options.baseRef, 'baseRef');
};

const validateCandidateRefs = (options: BranchGitSnapshotOptions): void => {
  if (!Array.isArray(options.candidateRefs)
    || options.candidateRefs.length === 0
    || options.candidateRefs.length > MAX_CANDIDATES) {
    throw new Error(`Branch snapshot candidateRefs must contain 1..${MAX_CANDIDATES} items`);
  }
  const seen = new Set<string>();
  for (const ref of options.candidateRefs) {
    validateRef(ref, 'candidateRef');
    if (ref === options.baseRef) throw new Error(`Candidate ref duplicates base ref ${ref}`);
    if (seen.has(ref)) throw new Error(`Duplicate candidate ref ${ref}`);
    seen.add(ref);
  }
};

const validateRef = (ref: string, field: string): void => {
  const invalid = typeof ref !== 'string'
    || !FULL_REF.test(ref)
    || ref.includes('..')
    || ref.includes('//')
    || ref.includes('@{')
    || ref.endsWith('/')
    || ref.endsWith('.')
    || ref.endsWith('.lock');
  if (invalid) throw new Error(`Invalid branch snapshot ${field}: ${String(ref)}`);
};

async function repositoryRoot(requestedRoot: string): Promise<string> {
  let requested: string;
  try {
    requested = await fs.realpath(path.resolve(requestedRoot));
    if (!(await fs.stat(requested)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new Error('Branch snapshot root is not a Git work tree');
  }
  const inside = await runGit(requested, ['rev-parse', '--is-inside-work-tree']);
  if (inside.exitCode !== 0 || inside.stdout.trim() !== 'true') {
    throw new Error('Branch snapshot root is not a Git work tree');
  }
  const result = await requiredGit(requested, ['rev-parse', '--show-toplevel']);
  return fs.realpath(result.trim());
}

async function captureRef(root: string, ref: string): Promise<RefSnapshot> {
  const symbolic = await runGit(root, ['symbolic-ref', '-q', ref]);
  if (symbolic.exitCode === 0) throw new Error(`Symbolic ref is not allowed: ${ref}`);
  if (symbolic.exitCode !== 1) throw new Error(`Could not classify ref ${ref}`);
  const resolved = (await requiredGit(root, [
    'rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`,
  ])).trim();
  requireSha(resolved, `commit for ${ref}`);
  const treeSha = (await requiredGit(root, [
    'rev-parse', '--verify', '--end-of-options', `${resolved}^{tree}`,
  ])).trim();
  requireSha(treeSha, `tree for ${ref}`);
  return { ref, sha: resolved, treeSha };
}

async function captureCandidate(
  root: string,
  base: RefSnapshot,
  candidate: RefSnapshot,
  inspect: (root: string, leftSha: string, rightSha: string) => Promise<BranchTextualMergeStatus>,
): Promise<BranchGitCandidateSnapshot> {
  const mergeBaseSha = (await requiredGit(root, ['merge-base', base.sha, candidate.sha])).trim();
  requireSha(mergeBaseSha, `merge base for ${candidate.ref}`);
  const counts = parseCounts(await requiredGit(root, [
    'rev-list', '--left-right', '--count', `${base.sha}...${candidate.sha}`,
  ]), candidate.ref);
  const changedPaths = await readChangedPaths(root, mergeBaseSha, candidate.sha);
  return {
    ref: candidate.ref,
    headSha: candidate.sha,
    treeSha: candidate.treeSha,
    mergeBaseSha,
    aheadBy: counts.right,
    behindBy: counts.left,
    changedPaths,
    patchId: await stablePatchId(root, mergeBaseSha, candidate.sha),
    baseTextualMerge: await inspect(root, base.sha, candidate.sha),
  };
}

async function captureInteractions(
  root: string,
  candidates: BranchGitCandidateSnapshot[],
  inspect: (root: string, leftSha: string, rightSha: string) => Promise<BranchTextualMergeStatus>,
): Promise<BranchGitInteractionSnapshot[]> {
  const interactions: BranchGitInteractionSnapshot[] = [];
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      if (!left || !right) throw new Error('Branch candidate disappeared during pair capture');
      const textualMerge = pathsOverlap(left.changedPaths, right.changedPaths)
        ? await inspect(root, left.headSha, right.headSha)
        : 'clean';
      interactions.push({ left: left.ref, right: right.ref, textualMerge });
    }
  }
  return interactions;
}

async function readChangedPaths(root: string, baseSha: string, headSha: string): Promise<string[]> {
  const output = await requiredGit(root, [
    'diff', '--name-only', '-z', '--no-ext-diff', baseSha, headSha, '--',
  ]);
  const values = output.split('\0').filter(Boolean).sort();
  if (values.length > MAX_CHANGED_PATHS) {
    throw new Error(`Branch changes exceed ${MAX_CHANGED_PATHS} paths`);
  }
  for (const value of values) {
    if (path.isAbsolute(value) || value.split('/').includes('..')) {
      throw new Error('Git returned an unsafe repository-relative path');
    }
  }
  return [...new Set(values)];
}

async function stablePatchId(root: string, baseSha: string, headSha: string): Promise<string | null> {
  const diff = await requiredGitBuffer(root, [
    'diff', '--binary', '--full-index', '--no-ext-diff', baseSha, headSha, '--',
  ], { maxBuffer: MAX_GIT_OUTPUT });
  if (diff.length === 0) return null;
  const result = await runGit(root, ['patch-id', '--stable'], {
    input: diff,
    maxBuffer: MAX_GIT_OUTPUT,
  });
  if (result.exitCode !== 0) throw gitFailure('patch-id', result);
  const patchId = result.stdout.trim().split(/\s+/)[0] ?? '';
  if (!PATCH_ID.test(patchId)) throw new Error('Git returned an invalid stable patch identity');
  return patchId;
}

async function isolatedObjectEnvironment(root: string, temporaryRoot: string): Promise<NodeJS.ProcessEnv> {
  const gitCommonDir = (await requiredGit(root, ['rev-parse', '--git-common-dir'])).trim();
  const commonDirectory = path.isAbsolute(gitCommonDir) ? gitCommonDir : path.resolve(root, gitCommonDir);
  const sourceObjects = path.join(commonDirectory, 'objects');
  const temporaryObjects = path.join(temporaryRoot, 'objects');
  await fs.mkdir(temporaryObjects, { recursive: true });
  return {
    ...process.env,
    GIT_OBJECT_DIRECTORY: temporaryObjects,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: sourceObjects,
  };
}

async function inspectTextualMerge(
  root: string,
  leftSha: string,
  rightSha: string,
  env: NodeJS.ProcessEnv,
): Promise<BranchTextualMergeStatus> {
  const result = await runGit(root, [
    'merge-tree', '--write-tree', '--messages', leftSha, rightSha,
  ], { env, maxBuffer: MAX_GIT_OUTPUT });
  return classifyMergeTreeResult(result.exitCode, result.stdout);
}

export function classifyMergeTreeResult(exitCode: number, stdout: string): BranchTextualMergeStatus {
  if (exitCode === 0 && startsWithSha(stdout)) return 'clean';
  if (exitCode === 1 && startsWithSha(stdout)) return 'conflict';
  return 'unknown';
}

async function assertRefsUnchanged(root: string, captured: Map<string, RefSnapshot>): Promise<void> {
  for (const [ref, snapshot] of captured) {
    let current: RefSnapshot;
    try {
      current = await captureRef(root, ref);
    } catch {
      throw new Error(`Branch snapshot ref moved or disappeared during capture: ${ref}`);
    }
    if (current.sha !== snapshot.sha || current.treeSha !== snapshot.treeSha) {
      throw new Error(`Branch snapshot ref moved during capture: ${ref}`);
    }
  }
}

const fingerprintMaterialization = (
  value: Omit<BranchGitMaterialization, 'fingerprint'>,
): BranchGitMaterialization => {
  return { ...value, fingerprint: sha256(stableStringify(value)) };
};

const validateMaterializationIdentity = (value: BranchGitMaterialization): void => {
  if (!REPOSITORY.test(value.repository) || value.repository.includes('..')) {
    throw new Error('Branch Git materialization repository must be owner/name');
  }
  if (!VERSION.test(value.toolVersion)) {
    throw new Error('Branch Git materialization toolVersion must be semantic version');
  }
  const base = materializationObject(value.base);
  requireMaterializationKeys(base, ['ref', 'sha', 'treeSha'], 'Branch Git materialization base');
  validateRef(value.base.ref, 'base ref');
  requireMaterializationSha(value.base.sha, 'base sha');
  requireMaterializationSha(value.base.treeSha, 'base treeSha');
};

const validateMaterializationCandidates = (
  values: BranchGitCandidateSnapshot[],
  baseRef: string,
): Map<string, BranchGitCandidateSnapshot> => {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_CANDIDATES) {
    throw new Error(`Branch Git materialization candidates must contain 1..${MAX_CANDIDATES} items`);
  }
  const candidates = new Map<string, BranchGitCandidateSnapshot>();
  for (const candidate of values) {
    validateMaterializationCandidate(candidate, baseRef);
    if (candidates.has(candidate.ref)) throw new Error(`Duplicate materialized candidate ${candidate.ref}`);
    candidates.set(candidate.ref, candidate);
  }
  const ordered = [...candidates.keys()].sort();
  if (stableStringify(values.map((candidate) => candidate.ref)) !== stableStringify(ordered)) {
    throw new Error('Branch Git materialization candidates must be sorted by ref');
  }
  return candidates;
};

const validateMaterializationCandidate = (
  candidate: BranchGitCandidateSnapshot,
  baseRef: string,
): void => {
  const value = materializationObject(candidate);
  requireMaterializationKeys(value, [
    'ref', 'headSha', 'treeSha', 'mergeBaseSha', 'aheadBy', 'behindBy',
    'changedPaths', 'patchId', 'baseTextualMerge',
  ], 'Branch Git materialization candidate');
  validateRef(candidate.ref, 'candidate ref');
  if (candidate.ref === baseRef) throw new Error('Materialized candidate duplicates base ref');
  requireMaterializationSha(candidate.headSha, `${candidate.ref} head sha`);
  requireMaterializationSha(candidate.treeSha, `${candidate.ref} tree sha`);
  requireMaterializationSha(candidate.mergeBaseSha, `${candidate.ref} merge-base sha`);
  requireMaterializationCount(candidate.aheadBy, `${candidate.ref} aheadBy`);
  requireMaterializationCount(candidate.behindBy, `${candidate.ref} behindBy`);
  validateMaterializedPaths(candidate.changedPaths, candidate.ref);
  if (candidate.patchId !== null && !PATCH_ID.test(candidate.patchId)) {
    throw new Error(`Invalid materialized patch ID for ${candidate.ref}`);
  }
  requireMaterializationMerge(candidate.baseTextualMerge, `${candidate.ref} base textual merge`);
};

const validateMaterializedPaths = (values: string[], ref: string): void => {
  if (!Array.isArray(values) || values.length > MAX_CHANGED_PATHS) {
    throw new Error(`Materialized changed paths exceed ${MAX_CHANGED_PATHS} for ${ref}`);
  }
  const canonical = [...new Set(values)].sort();
  if (stableStringify(values) !== stableStringify(canonical)) {
    throw new Error(`Materialized changed paths must be sorted and unique for ${ref}`);
  }
  for (const value of values) {
    if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.split('/').includes('..')) {
      throw new Error(`Materialized changed path is unsafe for ${ref}`);
    }
  }
};

const validateMaterializationInteractions = (
  values: BranchGitInteractionSnapshot[],
  candidates: Map<string, BranchGitCandidateSnapshot>,
): void => {
  if (!Array.isArray(values)) throw new Error('Branch Git materialization interactions must be an array');
  const expected = materializationPairKeys([...candidates.keys()]);
  const observed: string[] = [];
  for (const interaction of values) {
    const value = materializationObject(interaction);
    requireMaterializationKeys(value, ['left', 'right', 'textualMerge'], 'Branch Git interaction');
    if (!candidates.has(interaction.left) || !candidates.has(interaction.right)) {
      throw new Error('Branch Git interaction references an unknown candidate');
    }
    if (interaction.left.localeCompare(interaction.right) >= 0) {
      throw new Error('Branch Git interaction refs must be distinct and sorted');
    }
    requireMaterializationMerge(interaction.textualMerge, 'Branch Git interaction textual merge');
    observed.push(`${interaction.left}\u0000${interaction.right}`);
  }
  if (stableStringify(observed) !== stableStringify(expected)) {
    throw new Error('Branch Git materialization must contain exactly one sorted interaction per candidate pair');
  }
};

const materializationPairKeys = (refs: string[]): string[] => {
  const ordered = [...refs].sort();
  const keys: string[] = [];
  for (let left = 0; left < ordered.length; left += 1) {
    for (let right = left + 1; right < ordered.length; right += 1) {
      keys.push(`${ordered[left]}\u0000${ordered[right]}`);
    }
  }
  return keys;
};

const materializationObject = <T extends object>(value: T | unknown): T => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Branch Git materialization value must be an object');
  }
  return value as T;
};

const requireMaterializationKeys = (value: object, keys: string[], name: string): void => {
  if (stableStringify(Object.keys(value).sort()) !== stableStringify([...keys].sort())) {
    throw new Error(`${name} has unexpected or missing fields`);
  }
};

const requireMaterializationSha = (value: string, name: string): void => {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error(`Invalid materialized ${name}`);
};

const requireMaterializationCount = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid materialized ${name}`);
};

const requireMaterializationMerge = (value: BranchTextualMergeStatus, name: string): void => {
  if (value !== 'clean' && value !== 'conflict' && value !== 'unknown') {
    throw new Error(`Invalid ${name}`);
  }
};

const requiredSnapshot = (values: Map<string, RefSnapshot>, ref: string): RefSnapshot => {
  const value = values.get(ref);
  if (!value) throw new Error(`Missing captured ref ${ref}`);
  return value;
};

const parseCounts = (value: string, ref: string): { left: number; right: number } => {
  const parts = value.trim().split(/\s+/).map(Number);
  const left = parts[0];
  const right = parts[1];
  if (parts.length !== 2 || !Number.isSafeInteger(left) || !Number.isSafeInteger(right)
    || left === undefined || right === undefined || left < 0 || right < 0) {
    throw new Error(`Git returned invalid ahead/behind counts for ${ref}`);
  }
  return { left, right };
};

const pathsOverlap = (left: string[], right: string[]): boolean => {
  const rightPaths = new Set(right);
  return left.some((value) => rightPaths.has(value));
};

const startsWithSha = (value: string): boolean => {
  return SHA.test(value.split(/\r?\n/, 1)[0]?.trim() ?? '');
};

const requireSha = (value: string, name: string): void => {
  if (!SHA.test(value)) throw new Error(`Git returned invalid ${name}`);
};

const requiredGit = async (
  root: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<string> => {
  const result = await runGit(root, args, options);
  if (result.exitCode !== 0) throw gitFailure(args[0] ?? 'unknown', result);
  return result.stdout;
};

const requiredGitBuffer = async (
  root: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<Buffer> => {
  const result = await runGit(root, args, options);
  if (result.exitCode !== 0) throw gitFailure(args[0] ?? 'unknown', result);
  return result.stdoutBuffer;
};

const gitFailure = (command: string, result: GitCommandResult): Error => {
  const detail = result.stderr.trim().split(/\r?\n/, 1)[0]?.slice(0, 300);
  return new Error(`Git ${command} failed with exit ${result.exitCode}${detail ? `: ${detail}` : ''}`);
};

const runGit = (
  root: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<GitCommandResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', root, ...args], {
      cwd: root,
      env: options.env ?? process.env,
      shell: false,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const maxBuffer = options.maxBuffer ?? 4 * 1024 * 1024;
    let bytes = 0;
    let overflow = false;
    const collect = (target: Buffer[], chunk: Buffer): void => {
      bytes += chunk.length;
      if (bytes > maxBuffer) {
        overflow = true;
        child.kill();
        return;
      }
      target.push(chunk);
    };
    child.stdout?.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr?.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (overflow) {
        reject(new Error(`Git ${args[0] ?? 'command'} exceeded its output limit`));
        return;
      }
      const stdoutBuffer = Buffer.concat(stdout);
      resolve({
        exitCode: code ?? 128,
        stdout: stdoutBuffer.toString('utf8'),
        stdoutBuffer,
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    if (child.stdin) {
      child.stdin.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EPIPE') reject(error);
      });
      child.stdin.end(options.input);
    }
  });
};
