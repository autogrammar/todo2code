import path from 'node:path';

import { sha256, stableStringify } from '../core/id.js';
import type {
  BranchGitCandidateSnapshot,
  BranchGitInteractionSnapshot,
  BranchGitMaterialization,
  BranchGitSnapshotOptions,
  BranchTextualMergeStatus,
} from './branch-snapshot-types.js';
import {
  FULL_REF,
  MAX_CANDIDATES,
  MAX_CHANGED_PATHS,
  PATCH_ID,
  REPOSITORY,
  SHA,
  VERSION,
} from './branch-snapshot-types.js';

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

export function validateOptions(options: BranchGitSnapshotOptions): void {
  if (!options || typeof options !== 'object') throw new Error('Branch snapshot options are required');
  validateSnapshotIdentity(options);
  validateCandidateRefs(options);
}

export function fingerprintMaterialization(
  value: Omit<BranchGitMaterialization, 'fingerprint'>,
): BranchGitMaterialization {
  return { ...value, fingerprint: sha256(stableStringify(value)) };
}

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
