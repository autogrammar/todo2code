import { sha256, shortHash, stableStringify } from './id.js';
export type BranchTextualMerge = 'clean' | 'conflict' | 'unknown';
export type BranchEvidenceCompleteness = 'complete' | 'unknown';
export type BranchAssertionChangeKind = 'added' | 'modified' | 'removed';
export type BranchPairOrdering = 'independent' | 'left_after_right' | 'right_after_left' | 'unknown';
export type BranchInteractionClassification = 'disjoint' | 'overlap' | 'duplicate' | 'ordered_after'
  | 'textual_conflict' | 'semantic_conflict' | 'unknown';
export type BranchRecommendation = 'merge_ready' | 'merge_after' | 'conflict' | 'duplicate'
  | 'stale' | 'rebase_required' | 'manual_review';
export interface BranchCitationSet { assertionIds: string[]; recordIds: string[]; relationIds: string[] }
export interface BranchAssertionChange extends BranchCitationSet { kind: BranchAssertionChangeKind }
export interface BranchBaseEvidence { sha: string; treeSha: string; graphFingerprint: string; truthMapFingerprint: string }
export interface BranchCandidateEvidence {
  name: string; headSha: string; treeSha: string; mergeBaseSha: string;
  aheadBy: number; behindBy: number; pullRequests: number[]; patchId: string | null;
  baseTextualMerge: BranchTextualMerge; semanticEvidence: BranchEvidenceCompleteness;
  graphFingerprint: string; truthMapFingerprint: string;
  assertionChanges: BranchAssertionChange[]; baseSemanticConflict: BranchCitationSet;
}
export interface BranchPairEvidence {
  left: string; right: string; textualMerge: BranchTextualMerge;
  semanticEvidence: BranchEvidenceCompleteness; ordering: BranchPairOrdering;
  orderingEvidence: BranchCitationSet; semanticConflict: BranchCitationSet;
}
export interface BranchPortfolioEvidence {
  schemaVersion: 't2c.branch-evidence/v1'; repository: string; toolVersion: string;
  base: BranchBaseEvidence; candidates: BranchCandidateEvidence[]; pairs: BranchPairEvidence[];
}
export interface BranchCandidateResult {
  id: string; name: string; baseSha: string; headSha: string; treeSha: string; mergeBaseSha: string;
  aheadBy: number; behindBy: number; pullRequests: number[]; patchId: string | null;
  graphFingerprint: string; truthMapFingerprint: string; changedAssertionIds: string[];
  recordIds: string[]; relationIds: string[]; baseTextualMerge: BranchTextualMerge;
  semanticEvidence: BranchEvidenceCompleteness; baseSemanticConflict: BranchCitationSet;
  recommendation: BranchRecommendation; reasons: string[];
}
export interface BranchInteractionResult {
  id: string; left: string; right: string; leftHeadSha: string; rightHeadSha: string;
  leftMergeBaseSha: string; rightMergeBaseSha: string; baseSha: string;
  classification: BranchInteractionClassification; textualMerge: BranchTextualMerge;
  semanticEvidence: BranchEvidenceCompleteness; ordering: BranchPairOrdering;
  orderingEvidence: BranchCitationSet; sharedAssertionIds: string[]; semanticConflict: BranchCitationSet;
}
export interface BranchPortfolio {
  schemaVersion: 't2c.branch/v1'; generatedAt: string; repository: string; toolVersion: string;
  base: BranchBaseEvidence; fingerprint: string; candidates: BranchCandidateResult[];
  interactions: BranchInteractionResult[];
  stats: {
    candidates: number;
    interactions: number;
    byClassification: Record<BranchInteractionClassification, number>;
    byRecommendation: Record<BranchRecommendation, number>;
  };
}
type CandidateIndex = Map<string, BranchCandidateEvidence>;
type PortfolioFingerprintInput = Omit<BranchPortfolio, 'fingerprint'> | BranchPortfolio;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const PATCH_ID = /^[a-f0-9]{40}([a-f0-9]{24})?$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ASSERTION_ID = /^TRUTH-[a-f0-9]{20}$/;
const CITATION_ID = /^[A-Za-z][A-Za-z0-9._:-]{1,159}$/;
const MAX_CANDIDATES = 128;
const MAX_ASSERTION_CHANGES = 4096, MAX_CITATIONS = 4096, MAX_PULL_REQUESTS = 1000;
const TEXTUAL_MERGES = new Set<BranchTextualMerge>(['clean', 'conflict', 'unknown']);
const COMPLETENESS = new Set<BranchEvidenceCompleteness>(['complete', 'unknown']);
const CHANGE_KINDS = new Set<BranchAssertionChangeKind>(['added', 'modified', 'removed']);
const ORDERINGS = new Set<BranchPairOrdering>(['independent', 'left_after_right', 'right_after_left', 'unknown']);
export function projectBranchPortfolio(
  evidence: BranchPortfolioEvidence,
  generatedAt = new Date().toISOString(),
): BranchPortfolio {
  assertBranchPortfolioEvidence(evidence);
  requireDateTime(generatedAt, 'Branch portfolio generatedAt');
  const portfolio = buildPortfolio(evidence, generatedAt);
  assertBranchPortfolio(portfolio, evidence);
  return portfolio;
}
export function assertBranchPortfolioEvidence(value: BranchPortfolioEvidence): void {
  requireObject(value, 'Branch evidence');
  requireExactKeys(value, ['schemaVersion', 'repository', 'toolVersion', 'base', 'candidates', 'pairs'], 'Branch evidence');
  if (value.schemaVersion !== 't2c.branch-evidence/v1') throw new Error('Unsupported branch evidence schemaVersion');
  requireRepository(value.repository);
  requireText(value.toolVersion, 'Branch evidence toolVersion');
  validateBase(value.base);
  if (!Array.isArray(value.candidates) || value.candidates.length === 0 || value.candidates.length > MAX_CANDIDATES) {
    throw new Error(`Branch evidence candidates must contain 1..${MAX_CANDIDATES} items`);
  }
  if (!Array.isArray(value.pairs)) throw new Error('Branch evidence pairs must be an array');
  const candidates = validateCandidates(value.candidates);
  validatePairs(value.pairs, candidates);
}
export function assertBranchPortfolio(value: BranchPortfolio, evidence: BranchPortfolioEvidence): void {
  assertBranchPortfolioEvidence(evidence);
  requireObject(value, 'Branch portfolio');
  requireDateTime(value.generatedAt, 'Branch portfolio generatedAt');
  const expected = buildPortfolio(evidence, value.generatedAt);
  if (stableStringify(value) !== stableStringify(expected)) {
    throw new Error('Branch portfolio does not match its immutable evidence');
  }
}
const buildPortfolio = (evidence: BranchPortfolioEvidence, generatedAt: string): BranchPortfolio => {
  const candidateIndex = new Map(evidence.candidates.map((candidate) => [candidate.name, candidate]));
  const interactions = evidence.pairs
    .map((pair) => buildInteraction(evidence.base.sha, normalizePair(pair), candidateIndex))
    .sort(compareById);
  const candidates = [...evidence.candidates]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((candidate) => buildCandidate(evidence.repository, evidence.base.sha, candidate, interactions));
  const projection = {
    schemaVersion: 't2c.branch/v1' as const,
    generatedAt,
    repository: evidence.repository,
    toolVersion: evidence.toolVersion,
    base: { ...evidence.base },
    fingerprint: '',
    candidates,
    interactions,
    stats: buildStats(candidates, interactions),
  };
  return { ...projection, fingerprint: portfolioFingerprint(projection) };
};
const validateBase = (base: BranchBaseEvidence): void => {
  requireObject(base, 'Branch evidence base');
  requireExactKeys(base, ['sha', 'treeSha', 'graphFingerprint', 'truthMapFingerprint'], 'Branch evidence base');
  requireSha(base.sha, 'base sha');
  requireSha(base.treeSha, 'base treeSha');
  requireDigest(base.graphFingerprint, 'base graphFingerprint');
  requireDigest(base.truthMapFingerprint, 'base truthMapFingerprint');
};
const validateCandidates = (values: BranchCandidateEvidence[]): CandidateIndex => {
  const candidates = new Map<string, BranchCandidateEvidence>();
  for (const candidate of values) {
    validateCandidate(candidate);
    if (candidates.has(candidate.name)) throw new Error(`Duplicate branch candidate ${candidate.name}`);
    candidates.set(candidate.name, candidate);
  }
  return candidates;
};
const validateCandidate = (candidate: BranchCandidateEvidence): void => {
  requireObject(candidate, 'Branch candidate');
  requireExactKeys(candidate, [
    'name', 'headSha', 'treeSha', 'mergeBaseSha', 'aheadBy', 'behindBy', 'pullRequests', 'patchId',
    'baseTextualMerge', 'semanticEvidence', 'graphFingerprint', 'truthMapFingerprint', 'assertionChanges',
    'baseSemanticConflict',
  ], 'Branch candidate');
  requireBranchName(candidate.name);
  requireSha(candidate.headSha, `${candidate.name} headSha`);
  requireSha(candidate.treeSha, `${candidate.name} treeSha`);
  requireSha(candidate.mergeBaseSha, `${candidate.name} mergeBaseSha`);
  requireCount(candidate.aheadBy, `${candidate.name} aheadBy`);
  requireCount(candidate.behindBy, `${candidate.name} behindBy`);
  validatePullRequests(candidate.pullRequests, candidate.name);
  if (candidate.patchId !== null && !PATCH_ID.test(candidate.patchId)) throw new Error(`Invalid ${candidate.name} patchId`);
  requireEnum(candidate.baseTextualMerge, TEXTUAL_MERGES, `${candidate.name} baseTextualMerge`);
  requireEnum(candidate.semanticEvidence, COMPLETENESS, `${candidate.name} semanticEvidence`);
  requireDigest(candidate.graphFingerprint, `${candidate.name} graphFingerprint`);
  requireDigest(candidate.truthMapFingerprint, `${candidate.name} truthMapFingerprint`);
  validateAssertionChanges(candidate.assertionChanges, candidate.name);
  validateConflict(candidate.baseSemanticConflict, candidate.assertionChanges, `${candidate.name} baseSemanticConflict`);
};
const validatePullRequests = (values: number[], branch: string): void => {
  if (!Array.isArray(values)) throw new Error(`${branch} pullRequests must be an array`);
  if (values.length > MAX_PULL_REQUESTS) throw new Error(`${branch} pullRequests exceeds ${MAX_PULL_REQUESTS} items`);
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${branch} pullRequests must contain positive integers`);
    if (seen.has(value)) throw new Error(`${branch} pullRequests contains duplicate ${value}`);
    seen.add(value);
  }
};
const validateAssertionChanges = (values: BranchAssertionChange[], branch: string): void => {
  if (!Array.isArray(values)) throw new Error(`${branch} assertionChanges must be an array`);
  if (values.length > MAX_ASSERTION_CHANGES) throw new Error(`${branch} assertionChanges exceeds ${MAX_ASSERTION_CHANGES} items`);
  const seen = new Set<string>();
  for (const change of values) {
    requireObject(change, `${branch} assertion change`);
    requireExactKeys(change, ['assertionIds', 'recordIds', 'relationIds', 'kind'], `${branch} assertion change`);
    if (change.assertionIds.length !== 1) throw new Error(`${branch} assertion change must identify exactly one assertion`);
    validateCitations(change, `${branch} assertion change`);
    requireEnum(change.kind, CHANGE_KINDS, `${branch} assertion change kind`);
    const assertionId = change.assertionIds[0];
    if (assertionId === undefined) throw new Error(`${branch} assertion change is missing an assertion`);
    if (seen.has(assertionId)) throw new Error(`${branch} repeats assertion change ${assertionId}`);
    seen.add(assertionId);
  }
};
const validateConflict = (
  conflict: BranchCitationSet,
  changes: BranchAssertionChange[],
  name: string,
  otherChanges?: BranchAssertionChange[],
): void => {
  validateCitations(conflict, name);
  const allowed = new Set(changes.map((change) => change.assertionIds[0]));
  if (otherChanges) {
    const other = new Set(otherChanges.map((change) => change.assertionIds[0]));
    for (const assertionId of [...allowed]) if (!other.has(assertionId)) allowed.delete(assertionId);
  }
  for (const assertionId of conflict.assertionIds) {
    if (!allowed.has(assertionId)) throw new Error(`${name} references unrelated assertion ${assertionId}`);
  }
  validateConflictDetails(conflict, changes, name, otherChanges);
};
const validateConflictDetails = (
  conflict: BranchCitationSet,
  changes: BranchAssertionChange[],
  name: string,
  otherChanges?: BranchAssertionChange[],
): void => {
  const relevant = [...changes, ...(otherChanges ?? [])]
    .filter((change) => conflict.assertionIds.includes(change.assertionIds[0] ?? ''));
  const records = new Set(relevant.flatMap((change) => change.recordIds));
  const relations = new Set(relevant.flatMap((change) => change.relationIds));
  for (const recordId of conflict.recordIds) {
    if (!records.has(recordId)) throw new Error(`${name} references unrelated record ${recordId}`);
  }
  for (const relationId of conflict.relationIds) {
    if (!relations.has(relationId)) throw new Error(`${name} references unrelated relation ${relationId}`);
  }
};
const validateCitations = (citations: BranchCitationSet, name: string): void => {
  requireObject(citations, name);
  const allowedKeys = name.includes('assertion change')
    ? ['assertionIds', 'recordIds', 'relationIds', 'kind']
    : ['assertionIds', 'recordIds', 'relationIds'];
  requireExactKeys(citations, allowedKeys, name);
  requireUniqueIds(citations.assertionIds, ASSERTION_ID, `${name} assertionIds`);
  requireUniqueIds(citations.recordIds, CITATION_ID, `${name} recordIds`);
  requireUniqueIds(citations.relationIds, CITATION_ID, `${name} relationIds`);
};
const validatePairs = (pairs: BranchPairEvidence[], candidates: CandidateIndex): void => {
  const observed = new Set<string>();
  for (const pair of pairs) {
    validatePair(pair, candidates);
    const key = pairKey(pair.left, pair.right);
    if (observed.has(key)) throw new Error(`Duplicate branch pair ${key}`);
    observed.add(key);
  }
  const expected = expectedPairKeys([...candidates.keys()]);
  if (stableStringify([...observed].sort()) !== stableStringify(expected)) {
    throw new Error('Branch evidence must contain exactly one result for every candidate pair');
  }
};
const validatePair = (pair: BranchPairEvidence, candidates: CandidateIndex): void => {
  requireObject(pair, 'Branch pair');
  requireExactKeys(pair, [
    'left', 'right', 'textualMerge', 'semanticEvidence', 'ordering', 'orderingEvidence', 'semanticConflict',
  ], 'Branch pair');
  if (pair.left === pair.right) throw new Error(`Branch pair repeats candidate ${pair.left}`);
  const left = candidates.get(pair.left);
  const right = candidates.get(pair.right);
  if (!left || !right) throw new Error(`Branch pair references unknown candidate ${pair.left} / ${pair.right}`);
  requireEnum(pair.textualMerge, TEXTUAL_MERGES, 'Branch pair textualMerge');
  requireEnum(pair.semanticEvidence, COMPLETENESS, 'Branch pair semanticEvidence');
  requireEnum(pair.ordering, ORDERINGS, 'Branch pair ordering');
  validateConflict(pair.semanticConflict, left.assertionChanges, 'Branch pair semanticConflict', right.assertionChanges);
  validatePairCitations(pair.orderingEvidence, left, right, 'Branch pair orderingEvidence');
  validateOrderingEvidence(pair);
  if (isDuplicateIdentity(left, right) && hasConflict(pair)) {
    throw new Error(`Duplicate branch pair ${pairKey(pair.left, pair.right)} cannot also conflict`);
  }
};
const validatePairCitations = (
  citations: BranchCitationSet, left: BranchCandidateEvidence, right: BranchCandidateEvidence, name: string,
): void => {
  validateCitations(citations, name);
  const changes = [...left.assertionChanges, ...right.assertionChanges];
  requireSubset(citations.assertionIds, new Set(changes.map((change) => change.assertionIds[0])), name, 'assertion');
  requireSubset(citations.recordIds, new Set(changes.flatMap((change) => change.recordIds)), name, 'record');
  requireSubset(citations.relationIds, new Set(changes.flatMap((change) => change.relationIds)), name, 'relation');
};
const validateOrderingEvidence = (pair: BranchPairEvidence): void => {
  const ordered = pair.ordering === 'left_after_right' || pair.ordering === 'right_after_left';
  if (ordered !== (pair.orderingEvidence.relationIds.length > 0))
    throw new Error('Ordered branch pair must contain relation-backed orderingEvidence only');
};
const buildInteraction = (
  baseSha: string,
  pair: BranchPairEvidence,
  candidates: CandidateIndex,
): BranchInteractionResult => {
  const left = candidates.get(pair.left);
  const right = candidates.get(pair.right);
  if (!left || !right) throw new Error('Branch pair candidate disappeared after validation');
  const sharedAssertionIds = intersection(assertionIds(left), assertionIds(right));
  const identity = { baseSha, left: pair.left, right: pair.right,
    leftHeadSha: left.headSha, rightHeadSha: right.headSha,
    leftMergeBaseSha: left.mergeBaseSha, rightMergeBaseSha: right.mergeBaseSha };
  return {
    id: `BPAIR-${shortHash(stableStringify(identity), 20)}`, ...identity,
    classification: classifyInteraction(pair, left, right, sharedAssertionIds),
    textualMerge: pair.textualMerge, semanticEvidence: pair.semanticEvidence, ordering: pair.ordering,
    orderingEvidence: canonicalCitations(pair.orderingEvidence),
    sharedAssertionIds, semanticConflict: canonicalCitations(pair.semanticConflict),
  };
};
const classifyInteraction = (
  pair: BranchPairEvidence,
  left: BranchCandidateEvidence,
  right: BranchCandidateEvidence,
  sharedAssertionIds: string[],
): BranchInteractionClassification => {
  if (pair.semanticConflict.assertionIds.length > 0) return 'semantic_conflict';
  if (pair.textualMerge === 'conflict') return 'textual_conflict';
  if (isDuplicateIdentity(left, right)) return 'duplicate';
  if (pair.ordering === 'left_after_right' || pair.ordering === 'right_after_left') return 'ordered_after';
  if (pair.semanticEvidence === 'unknown') return 'unknown';
  if (sharedAssertionIds.length > 0) return 'overlap';
  if (pair.textualMerge === 'clean' && pair.ordering === 'independent') return 'disjoint';
  return 'unknown';
};
const buildCandidate = (
  repository: string,
  baseSha: string,
  candidate: BranchCandidateEvidence,
  interactions: BranchInteractionResult[],
): BranchCandidateResult => {
  const relevant = interactions.filter((item) => item.left === candidate.name || item.right === candidate.name);
  const reasons = candidateReasons(candidate, relevant);
  const changes = canonicalChanges(candidate.assertionChanges);
  return {
    id: `BRANCH-${shortHash(stableStringify({ repository, baseSha, name: candidate.name, headSha: candidate.headSha }), 20)}`,
    name: candidate.name, baseSha, headSha: candidate.headSha, treeSha: candidate.treeSha,
    mergeBaseSha: candidate.mergeBaseSha, aheadBy: candidate.aheadBy, behindBy: candidate.behindBy,
    pullRequests: [...candidate.pullRequests].sort((left, right) => left - right),
    patchId: candidate.patchId, graphFingerprint: candidate.graphFingerprint,
    truthMapFingerprint: candidate.truthMapFingerprint, baseTextualMerge: candidate.baseTextualMerge,
    semanticEvidence: candidate.semanticEvidence,
    baseSemanticConflict: canonicalCitations(candidate.baseSemanticConflict),
    changedAssertionIds: changes.map((change) => change.assertionIds[0] ?? ''),
    recordIds: uniqueSorted(changes.flatMap((change) => change.recordIds)),
    relationIds: uniqueSorted(changes.flatMap((change) => change.relationIds)),
    recommendation: recommendationFor(candidate, relevant), reasons,
  };
};
const recommendationFor = (
  candidate: BranchCandidateEvidence,
  interactions: BranchInteractionResult[],
): BranchRecommendation => {
  if (hasCandidateConflict(candidate, interactions)) return 'conflict';
  if (candidate.aheadBy === 0 || (candidate.semanticEvidence === 'complete' && candidate.assertionChanges.length === 0)) return 'stale';
  if (interactions.some((item) => item.classification === 'duplicate')) return 'duplicate';
  if (candidate.behindBy > 0) return 'rebase_required';
  if (interactions.some((item) => waitsForCandidate(candidate.name, item))) return 'merge_after';
  if (candidate.baseTextualMerge === 'unknown' || candidate.semanticEvidence === 'unknown') return 'manual_review';
  if (interactions.some((item) => item.classification === 'unknown')) return 'manual_review';
  return 'merge_ready';
};
const candidateReasons = (
  candidate: BranchCandidateEvidence,
  interactions: BranchInteractionResult[],
): string[] => {
  const reasons = new Set<string>();
  if (candidate.baseTextualMerge === 'conflict') reasons.add('BASE_TEXTUAL_CONFLICT');
  if (candidate.baseSemanticConflict.assertionIds.length > 0) reasons.add('BASE_SEMANTIC_CONFLICT');
  if (candidate.aheadBy === 0) reasons.add('NO_UNIQUE_COMMITS');
  if (candidate.semanticEvidence === 'complete' && candidate.assertionChanges.length === 0) reasons.add('NO_UNIQUE_ASSERTIONS');
  if (candidate.behindBy > 0) reasons.add('BASE_AHEAD_OF_BRANCH');
  if (candidate.baseTextualMerge === 'unknown') reasons.add('TEXTUAL_EVIDENCE_UNKNOWN');
  if (candidate.semanticEvidence === 'unknown') reasons.add('SEMANTIC_EVIDENCE_UNKNOWN');
  for (const interaction of interactions) addInteractionReason(reasons, candidate.name, interaction);
  if (reasons.size === 0) reasons.add('COMPLETE_DISJOINT_EVIDENCE');
  return [...reasons].sort();
};
const addInteractionReason = (
  reasons: Set<string>,
  candidateName: string,
  interaction: BranchInteractionResult,
): void => {
  if (interaction.classification === 'duplicate') reasons.add('EQUIVALENT_CHANGESET');
  if (interaction.classification === 'textual_conflict') reasons.add('PAIR_TEXTUAL_CONFLICT');
  if (interaction.classification === 'semantic_conflict') reasons.add('PAIR_SEMANTIC_CONFLICT');
  if (interaction.classification === 'unknown') reasons.add('PAIR_EVIDENCE_UNKNOWN');
  if (waitsForCandidate(candidateName, interaction)) reasons.add('ORDERED_AFTER_CANDIDATE');
};
const hasCandidateConflict = (
  candidate: BranchCandidateEvidence,
  interactions: BranchInteractionResult[],
): boolean => candidate.baseTextualMerge === 'conflict'
  || candidate.baseSemanticConflict.assertionIds.length > 0
  || interactions.some((item) => item.classification === 'textual_conflict' || item.classification === 'semantic_conflict');
const waitsForCandidate = (name: string, interaction: BranchInteractionResult): boolean => {
  return (interaction.left === name && interaction.ordering === 'left_after_right')
    || (interaction.right === name && interaction.ordering === 'right_after_left');
};
const normalizePair = (pair: BranchPairEvidence): BranchPairEvidence => {
  if (pair.left.localeCompare(pair.right) < 0) return pair;
  const ordering = pair.ordering === 'left_after_right'
    ? 'right_after_left'
    : pair.ordering === 'right_after_left' ? 'left_after_right' : pair.ordering;
  return { ...pair, left: pair.right, right: pair.left, ordering };
};
const canonicalChanges = (changes: BranchAssertionChange[]): BranchAssertionChange[] => {
  return changes.map((change) => ({ ...canonicalCitations(change), kind: change.kind }))
    .sort((left, right) => (left.assertionIds[0] ?? '').localeCompare(right.assertionIds[0] ?? ''));
};
const canonicalCitations = (value: BranchCitationSet): BranchCitationSet => ({
  assertionIds: uniqueSorted(value.assertionIds),
  recordIds: uniqueSorted(value.recordIds),
  relationIds: uniqueSorted(value.relationIds),
});
const buildStats = (
  candidates: BranchCandidateResult[],
  interactions: BranchInteractionResult[],
): BranchPortfolio['stats'] => {
  const byClassification = emptyClassificationCounts();
  const byRecommendation = emptyRecommendationCounts();
  for (const interaction of interactions) byClassification[interaction.classification] += 1;
  for (const candidate of candidates) byRecommendation[candidate.recommendation] += 1;
  return { candidates: candidates.length, interactions: interactions.length, byClassification, byRecommendation };
};
const emptyClassificationCounts = (): Record<BranchInteractionClassification, number> => ({
  disjoint: 0, overlap: 0, duplicate: 0, ordered_after: 0,
  textual_conflict: 0, semantic_conflict: 0, unknown: 0,
});
const emptyRecommendationCounts = (): Record<BranchRecommendation, number> => ({
  merge_ready: 0, merge_after: 0, conflict: 0, duplicate: 0,
  stale: 0, rebase_required: 0, manual_review: 0,
});
const portfolioFingerprint = (value: PortfolioFingerprintInput): string => sha256(stableStringify({
  schemaVersion: value.schemaVersion, repository: value.repository, toolVersion: value.toolVersion,
  base: value.base, candidates: value.candidates, interactions: value.interactions, stats: value.stats,
}));
const assertionIds = (candidate: BranchCandidateEvidence): string[] => {
  return candidate.assertionChanges.map((change) => change.assertionIds[0] ?? '');
};
const isDuplicateIdentity = (left: BranchCandidateEvidence, right: BranchCandidateEvidence): boolean => {
  return left.treeSha === right.treeSha
    || (left.patchId !== null && right.patchId !== null && left.patchId === right.patchId);
};
const hasConflict = (pair: BranchPairEvidence): boolean => {
  return pair.textualMerge === 'conflict' || pair.semanticConflict.assertionIds.length > 0;
};
const expectedPairKeys = (names: string[]): string[] => {
  const sorted = [...names].sort();
  const keys: string[] = [];
  for (let left = 0; left < sorted.length; left += 1) {
    for (let right = left + 1; right < sorted.length; right += 1) {
      const leftName = sorted[left];
      const rightName = sorted[right];
      if (leftName !== undefined && rightName !== undefined) keys.push(`${leftName}\u0000${rightName}`);
    }
  }
  return keys;
};
const pairKey = (left: string, right: string): string => {
  return left.localeCompare(right) < 0 ? `${left}\u0000${right}` : `${right}\u0000${left}`;
};
const intersection = (left: string[], right: string[]): string[] => {
  return uniqueSorted(left.filter((value) => new Set(right).has(value)));
};
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();
const requireObject: (value: unknown, name: string) => asserts value is Record<string, unknown> = (value, name) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`); };
const requireExactKeys = (value: object, keys: string[], name: string): void => {
  if (stableStringify(Object.keys(value).sort()) !== stableStringify([...keys].sort()))
    throw new Error(`${name} has unexpected or missing fields`); };
const requireRepository = (value: string): void => {
  if (typeof value !== 'string' || !REPOSITORY.test(value) || value.includes('..'))
    throw new Error('Branch evidence repository must be owner/name'); };
const requireBranchName = (value: string): void => {
  const malformed = typeof value !== 'string'
    || value.length === 0 || value.length > 200
    || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    || value.includes('..') || value.includes('//')
    || value.endsWith('/') || value.endsWith('.') || value.endsWith('.lock');
  if (malformed) throw new Error(`Invalid branch name ${String(value)}`);
};
const requireSha = (value: string, name: string): void => {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error(`Invalid ${name}`); };
const requireDigest = (value: string, name: string): void => {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(`Invalid ${name}`); };
const requireCount = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`); };
const requireText = (value: string, name: string): void => {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > 128)
    throw new Error(`${name} must be bounded non-empty text`); };
const requireUniqueIds = (values: string[], pattern: RegExp, name: string): void => {
  if (!Array.isArray(values)) throw new Error(`${name} must be an array`);
  if (values.length > MAX_CITATIONS) throw new Error(`${name} exceeds ${MAX_CITATIONS} items`);
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`Invalid ${name} value ${String(value)}`);
    if (seen.has(value)) throw new Error(`${name} contains duplicate ${value}`);
    seen.add(value);
  }
};
const requireSubset = (values: string[], allowed: Set<string | undefined>, name: string, kind: string): void => {
  for (const value of values) if (!allowed.has(value)) throw new Error(`${name} references unrelated ${kind} ${value}`);
};
const requireEnum = <T extends string>(value: T, allowed: Set<T>, name: string): void => {
  if (!allowed.has(value)) throw new Error(`Invalid ${name}: ${String(value)}`); };
const requireDateTime = (value: string, name: string): void => {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (parsed === null || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
    throw new Error(`${name} must be an ISO date-time`);
};
const compareById = (left: { id: string }, right: { id: string }): number => left.id.localeCompare(right.id);
