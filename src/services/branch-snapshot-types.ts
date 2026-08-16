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

export interface RefSnapshot {
  ref: string;
  sha: string;
  treeSha: string;
}

export interface GitCommandOptions {
  input?: string | Buffer;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

export interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stdoutBuffer: Buffer;
  stderr: string;
}

export const SHA = /^[a-f0-9]{40}$/;
export const PATCH_ID = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
export const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const FULL_REF = /^refs\/(?:heads|remotes)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$/;
export const MAX_CANDIDATES = 32;
export const MAX_CHANGED_PATHS = 4096;
export const MAX_GIT_OUTPUT = 64 * 1024 * 1024;

export type TextualMergeInspector = (
  root: string,
  leftSha: string,
  rightSha: string,
) => Promise<BranchTextualMergeStatus>;
