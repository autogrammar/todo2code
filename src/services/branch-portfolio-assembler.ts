import {
  projectBranchPortfolio,
  type BranchAssertionChange,
  type BranchCandidateEvidence,
  type BranchCitationSet,
  type BranchEvidenceCompleteness,
  type BranchPairEvidence,
  type BranchPortfolio,
  type BranchPortfolioEvidence,
} from '../core/branch-portfolio.js';
import { stableStringify } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import {
  assertTruthMap,
  type TruthMap,
  type TruthMapAssertion,
} from '../core/truth-map.js';
import type { IntentGraph, IntentGraphDiff } from '../core/types.js';
import { diffIntentGraphs } from '../graph/diff.js';
import {
  assertBranchGitMaterialization,
  type BranchGitCandidateSnapshot,
  type BranchGitMaterialization,
} from './branch-snapshot.js';

export interface BranchSemanticTreeBundle {
  treeSha: string;
  graph: IntentGraph;
  truthMap: TruthMap;
  completeness: BranchEvidenceCompleteness;
}

export interface BranchPortfolioAssembly {
  gitSnapshotFingerprint: string;
  evidence: BranchPortfolioEvidence;
  portfolio: BranchPortfolio;
}

interface CandidateSemanticState {
  evidence: BranchCandidateEvidence;
  changes: Map<string, BranchAssertionChange>;
  unanchoredAdditions: boolean;
}

interface AssertionMapping {
  changes: BranchAssertionChange[];
  candidateByBase: Map<string, TruthMapAssertion[]>;
  ambiguous: boolean;
}

const SHA = /^[a-f0-9]{40}$/;
const EMPTY_CITATIONS: BranchCitationSet = {
  assertionIds: [],
  recordIds: [],
  relationIds: [],
};

export function assembleBranchPortfolio(
  gitSnapshot: BranchGitMaterialization,
  semanticBundles: BranchSemanticTreeBundle[],
  generatedAt = new Date().toISOString(),
): BranchPortfolioAssembly {
  assertBranchGitMaterialization(gitSnapshot);
  const bundles = indexSemanticBundles(gitSnapshot, semanticBundles);
  const baseBundle = requiredBundle(bundles, gitSnapshot.base.treeSha);
  const states = gitSnapshot.candidates.map((candidate) => buildCandidateState(
    candidate,
    requiredBundle(bundles, candidate.treeSha),
    baseBundle,
    generatedAt,
  ));
  const stateByRef = new Map(states.map((state) => [state.evidence.name, state]));
  const evidence: BranchPortfolioEvidence = {
    schemaVersion: 't2c.branch-evidence/v1',
    repository: gitSnapshot.repository,
    toolVersion: gitSnapshot.toolVersion,
    base: {
      sha: gitSnapshot.base.sha,
      treeSha: gitSnapshot.base.treeSha,
      graphFingerprint: baseBundle.graph.fingerprint,
      truthMapFingerprint: baseBundle.truthMap.fingerprint,
    },
    candidates: states.map((state) => state.evidence),
    pairs: gitSnapshot.interactions.map((interaction) => buildPairEvidence(
      interaction.left,
      interaction.right,
      interaction.textualMerge,
      requiredState(stateByRef, interaction.left),
      requiredState(stateByRef, interaction.right),
    )),
  };
  return {
    gitSnapshotFingerprint: gitSnapshot.fingerprint,
    evidence,
    portfolio: projectBranchPortfolio(evidence, generatedAt),
  };
}

const indexSemanticBundles = (
  snapshot: BranchGitMaterialization,
  values: BranchSemanticTreeBundle[],
): Map<string, BranchSemanticTreeBundle> => {
  if (!Array.isArray(values)) throw new Error('Branch semantic bundles must be an array');
  const bundles = new Map<string, BranchSemanticTreeBundle>();
  for (const bundle of values) {
    validateSemanticBundle(bundle);
    if (bundles.has(bundle.treeSha)) throw new Error(`Duplicate semantic tree bundle ${bundle.treeSha}`);
    bundles.set(bundle.treeSha, bundle);
  }
  const expected = [...new Set([
    snapshot.base.treeSha,
    ...snapshot.candidates.map((candidate) => candidate.treeSha),
  ])].sort();
  const actual = [...bundles.keys()].sort();
  if (stableStringify(actual) !== stableStringify(expected)) {
    const missing = expected.filter((tree) => !bundles.has(tree));
    const extra = actual.filter((tree) => !expected.includes(tree));
    throw new Error(`Semantic tree bundle set does not match snapshot; missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'}`);
  }
  return bundles;
};

const validateSemanticBundle = (bundle: BranchSemanticTreeBundle): void => {
  requireObject(bundle, 'Branch semantic bundle');
  requireExactKeys(bundle, ['treeSha', 'graph', 'truthMap', 'completeness'], 'Branch semantic bundle');
  if (!SHA.test(bundle.treeSha)) throw new Error('Branch semantic bundle treeSha must be a full SHA');
  if (bundle.completeness !== 'complete' && bundle.completeness !== 'unknown') {
    throw new Error('Branch semantic bundle completeness must be complete or unknown');
  }
  assertIntentGraph(bundle.graph);
  assertTruthMap(bundle.truthMap, bundle.graph);
};

const buildCandidateState = (
  candidate: BranchGitCandidateSnapshot,
  bundle: BranchSemanticTreeBundle,
  baseBundle: BranchSemanticTreeBundle,
  generatedAt: string,
): CandidateSemanticState => {
  const diff = diffIntentGraphs(baseBundle.graph, bundle.graph, generatedAt);
  const mapping = mapAssertionChanges(baseBundle.truthMap, bundle.truthMap, diff);
  const semanticEvidence = semanticCompleteness(baseBundle, bundle, mapping.ambiguous);
  const baseSemanticConflict = changedConflictCitations(mapping.changes, mapping.candidateByBase);
  const evidence: BranchCandidateEvidence = {
    name: candidate.ref,
    headSha: candidate.headSha,
    treeSha: candidate.treeSha,
    mergeBaseSha: candidate.mergeBaseSha,
    aheadBy: candidate.aheadBy,
    behindBy: candidate.behindBy,
    pullRequests: [],
    patchId: candidate.patchId,
    baseTextualMerge: candidate.baseTextualMerge,
    semanticEvidence,
    graphFingerprint: bundle.graph.fingerprint,
    truthMapFingerprint: bundle.truthMap.fingerprint,
    assertionChanges: mapping.changes,
    baseSemanticConflict,
  };
  return {
    evidence,
    changes: new Map(mapping.changes.map((change) => [requiredAssertionId(change), change])),
    unanchoredAdditions: mapping.changes.some((change) => change.kind === 'added'),
  };
};

const mapAssertionChanges = (
  base: TruthMap,
  candidate: TruthMap,
  diff: IntentGraphDiff,
): AssertionMapping => {
  const baseAssertions = new Map(base.assertions.map((assertion) => [assertion.id, assertion]));
  const candidateByBase = new Map<string, TruthMapAssertion[]>();
  const afterToBefore = new Map(diff.records.changed.map((change) => [change.after.id, change.before.id]));
  const unanchored: TruthMapAssertion[] = [];
  for (const assertion of candidate.assertions) {
    const anchors = assertionAnchors(assertion, base.recordToAssertion, afterToBefore);
    if (anchors.length === 0) unanchored.push(assertion);
    for (const anchor of anchors) {
      const values = candidateByBase.get(anchor) ?? [];
      values.push(assertion);
      candidateByBase.set(anchor, values);
    }
  }
  const changes = [...baseAssertions.values()].flatMap((assertion) => {
    const mapped = uniqueAssertions(candidateByBase.get(assertion.id) ?? []);
    if (mapped.length === 0) return [changeFromAssertions(assertion.id, 'removed', [assertion])];
    if (mapped.length === 1 && mapped[0]?.id === assertion.id) return [];
    return [changeFromAssertions(assertion.id, 'modified', [assertion, ...mapped])];
  });
  for (const assertion of unanchored) {
    changes.push(changeFromAssertions(assertion.id, 'added', [assertion]));
  }
  changes.sort((left, right) => requiredAssertionId(left).localeCompare(requiredAssertionId(right)));
  return {
    changes,
    candidateByBase,
    ambiguous: changedIdentityIsAmbiguous(diff),
  };
};

const assertionAnchors = (
  assertion: TruthMapAssertion,
  baseRecordToAssertion: Record<string, string>,
  afterToBefore: Map<string, string>,
): string[] => {
  const anchors = new Set<string>();
  for (const recordId of assertion.recordIds) {
    const baseRecord = afterToBefore.get(recordId) ?? recordId;
    const anchor = baseRecordToAssertion[baseRecord];
    if (anchor) anchors.add(anchor);
  }
  return [...anchors].sort();
};

const changeFromAssertions = (
  assertionId: string,
  kind: BranchAssertionChange['kind'],
  assertions: TruthMapAssertion[],
): BranchAssertionChange => ({
  assertionIds: [assertionId],
  recordIds: uniqueSorted(assertions.flatMap((assertion) => assertion.recordIds)),
  relationIds: uniqueSorted(assertions.flatMap((assertion) => assertion.relationIds)),
  kind,
});

const changedIdentityIsAmbiguous = (diff: IntentGraphDiff): boolean => {
  const counts = new Map<string, number>();
  for (const change of diff.records.changed) {
    const count = (counts.get(change.identity) ?? 0) + 1;
    if (count > 1) return true;
    counts.set(change.identity, count);
  }
  return false;
};

const semanticCompleteness = (
  base: BranchSemanticTreeBundle,
  candidate: BranchSemanticTreeBundle,
  ambiguous: boolean,
): BranchEvidenceCompleteness => (
  base.completeness === 'complete' && candidate.completeness === 'complete' && !ambiguous
    ? 'complete'
    : 'unknown'
);

const changedConflictCitations = (
  changes: BranchAssertionChange[],
  candidateByBase: Map<string, TruthMapAssertion[]>,
): BranchCitationSet => {
  const conflicted = changes.filter((change) => {
    const assertionId = requiredAssertionId(change);
    return (candidateByBase.get(assertionId) ?? []).some((assertion) => assertion.status === 'conflicted');
  });
  return citationsForChanges(conflicted);
};

const buildPairEvidence = (
  leftName: string,
  rightName: string,
  textualMerge: BranchPairEvidence['textualMerge'],
  left: CandidateSemanticState,
  right: CandidateSemanticState,
): BranchPairEvidence => {
  const shared = [...left.changes.keys()].filter((id) => right.changes.has(id)).sort();
  const complete = left.evidence.semanticEvidence === 'complete'
    && right.evidence.semanticEvidence === 'complete'
    && !left.unanchoredAdditions
    && !right.unanchoredAdditions;
  const semanticEvidence: BranchEvidenceCompleteness = complete ? 'complete' : 'unknown';
  const semanticConflict = pairConflictCitations(shared, left, right);
  return {
    left: leftName,
    right: rightName,
    textualMerge,
    semanticEvidence,
    ordering: complete && shared.length === 0 ? 'independent' : 'unknown',
    orderingEvidence: cloneEmptyCitations(),
    semanticConflict,
  };
};

const pairConflictCitations = (
  shared: string[],
  left: CandidateSemanticState,
  right: CandidateSemanticState,
): BranchCitationSet => {
  const conflicts: BranchAssertionChange[] = [];
  for (const assertionId of shared) {
    const leftChange = left.changes.get(assertionId);
    const rightChange = right.changes.get(assertionId);
    if (!leftChange || !rightChange) continue;
    const removalConflict = (leftChange.kind === 'removed') !== (rightChange.kind === 'removed');
    const explicitConflict = left.evidence.baseSemanticConflict.assertionIds.includes(assertionId)
      || right.evidence.baseSemanticConflict.assertionIds.includes(assertionId);
    if (removalConflict || explicitConflict) conflicts.push(leftChange, rightChange);
  }
  return citationsForChanges(conflicts);
};

const citationsForChanges = (changes: BranchAssertionChange[]): BranchCitationSet => {
  if (changes.length === 0) return cloneEmptyCitations();
  return {
    assertionIds: uniqueSorted(changes.flatMap((change) => change.assertionIds)),
    recordIds: uniqueSorted(changes.flatMap((change) => change.recordIds)),
    relationIds: uniqueSorted(changes.flatMap((change) => change.relationIds)),
  };
};

const requiredBundle = (
  bundles: Map<string, BranchSemanticTreeBundle>,
  treeSha: string,
): BranchSemanticTreeBundle => {
  const bundle = bundles.get(treeSha);
  if (!bundle) throw new Error(`Missing semantic tree bundle ${treeSha}`);
  return bundle;
};

const requiredState = (
  states: Map<string, CandidateSemanticState>,
  ref: string,
): CandidateSemanticState => {
  const state = states.get(ref);
  if (!state) throw new Error(`Missing candidate semantic state ${ref}`);
  return state;
};

const requiredAssertionId = (change: BranchAssertionChange): string => {
  const id = change.assertionIds[0];
  if (!id) throw new Error('Branch assertion change lost its assertion ID');
  return id;
};

const uniqueAssertions = (values: TruthMapAssertion[]): TruthMapAssertion[] => {
  const unique = new Map(values.map((assertion) => [assertion.id, assertion]));
  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

const cloneEmptyCitations = (): BranchCitationSet => ({
  assertionIds: [...EMPTY_CITATIONS.assertionIds],
  recordIds: [...EMPTY_CITATIONS.recordIds],
  relationIds: [...EMPTY_CITATIONS.relationIds],
});

const requireObject: (value: unknown, name: string) => asserts value is object = (value, name) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
};

const requireExactKeys = (value: object, keys: string[], name: string): void => {
  if (stableStringify(Object.keys(value).sort()) !== stableStringify([...keys].sort())) {
    throw new Error(`${name} has unexpected or missing fields`);
  }
};
