import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  BranchGitCandidateSnapshot,
  BranchGitInteractionSnapshot,
  BranchTextualMergeStatus,
  GitCommandOptions,
  GitCommandResult,
  RefSnapshot,
  TextualMergeInspector,
} from './branch-snapshot-types.js';
import {
  MAX_CHANGED_PATHS,
  MAX_GIT_OUTPUT,
  PATCH_ID,
  SHA,
} from './branch-snapshot-types.js';

export function classifyMergeTreeResult(exitCode: number, stdout: string): BranchTextualMergeStatus {
  if (exitCode === 0 && startsWithSha(stdout)) return 'clean';
  if (exitCode === 1 && startsWithSha(stdout)) return 'conflict';
  return 'unknown';
}

export async function repositoryRoot(requestedRoot: string): Promise<string> {
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

export async function captureRef(root: string, ref: string): Promise<RefSnapshot> {
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

export async function captureCandidate(
  root: string,
  base: RefSnapshot,
  candidate: RefSnapshot,
  inspect: TextualMergeInspector,
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

export async function captureInteractions(
  root: string,
  candidates: BranchGitCandidateSnapshot[],
  inspect: TextualMergeInspector,
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

export async function isolatedObjectEnvironment(
  root: string,
  temporaryRoot: string,
): Promise<NodeJS.ProcessEnv> {
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

export async function inspectTextualMerge(
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

export async function assertRefsUnchanged(root: string, captured: Map<string, RefSnapshot>): Promise<void> {
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

export const requiredSnapshot = (values: Map<string, RefSnapshot>, ref: string): RefSnapshot => {
  const value = values.get(ref);
  if (!value) throw new Error(`Missing captured ref ${ref}`);
  return value;
};

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

async function requiredGit(
  root: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<string> {
  const result = await runGit(root, args, options);
  if (result.exitCode !== 0) throw gitFailure(args[0] ?? 'unknown', result);
  return result.stdout;
}

async function requiredGitBuffer(
  root: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<Buffer> {
  const result = await runGit(root, args, options);
  if (result.exitCode !== 0) throw gitFailure(args[0] ?? 'unknown', result);
  return result.stdoutBuffer;
}

const gitFailure = (command: string, result: GitCommandResult): Error => {
  const detail = result.stderr.trim().split(/\r?\n/, 1)[0]?.slice(0, 300);
  return new Error(`Git ${command} failed with exit ${result.exitCode}${detail ? `: ${detail}` : ''}`);
};

function runGit(
  root: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<GitCommandResult> {
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
}
