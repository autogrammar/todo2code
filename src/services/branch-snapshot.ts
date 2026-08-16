import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type {
  BranchGitCandidateSnapshot,
  BranchGitMaterialization,
  BranchGitSnapshotOptions,
  BranchSnapshotHooks,
  RefSnapshot,
} from './branch-snapshot-types.js';
import {
  assertRefsUnchanged,
  captureCandidate,
  captureInteractions,
  captureRef,
  inspectTextualMerge,
  isolatedObjectEnvironment,
  repositoryRoot,
  requiredSnapshot,
} from './branch-snapshot-git.js';
import {
  assertBranchGitMaterialization,
  fingerprintMaterialization,
  validateOptions,
} from './branch-snapshot-validate.js';

export type {
  BranchGitBaseSnapshot,
  BranchGitCandidateSnapshot,
  BranchGitInteractionSnapshot,
  BranchGitMaterialization,
  BranchGitSnapshotOptions,
  BranchSnapshotHooks,
  BranchTextualMergeStatus,
} from './branch-snapshot-types.js';

export { assertBranchGitMaterialization } from './branch-snapshot-validate.js';
export { classifyMergeTreeResult } from './branch-snapshot-git.js';

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
