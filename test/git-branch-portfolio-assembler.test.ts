import assert from 'node:assert/strict';
import test from 'node:test';
import { graphFingerprint, sha256, stableStringify } from '../src/core/id.js';
import { buildRecord } from '../src/core/record.js';
import { projectTruthMap } from '../src/core/truth-map.js';
import type {
  IntentGraph,
  IntentRecord,
  IntentRelation,
  RelationType,
} from '../src/core/types.js';
import {
  assembleBranchPortfolio,
  type BranchSemanticTreeBundle,
} from '../src/services/branch-portfolio-assembler.js';
import {
  assertBranchGitMaterialization,
  type BranchGitMaterialization,
  type BranchTextualMergeStatus,
} from '../src/services/branch-snapshot.js';

const GENERATED_AT = '2026-08-05T07:00:00.000Z';
const BASE_SHA = 'a'.repeat(40);
const BASE_TREE = 'b'.repeat(40);
const LEFT_TREE = 'c'.repeat(40);
const RIGHT_TREE = 'd'.repeat(40);
const LEFT_REF = 'refs/heads/feature-left';
const RIGHT_REF = 'refs/heads/feature-right';

test('assembles cited added, removed and modified truth changes', () => {
  const alpha = record('alpha', 'base alpha');
  const removed = record('removed', 'remove me');
  const stable = record('stable', 'unchanged');
  const changedAlpha = record('alpha', 'changed alpha');
  const added = record('added', 'new evidence');
  const base = bundle(BASE_TREE, [alpha, removed, stable]);
  const candidate = bundle(LEFT_TREE, [changedAlpha, stable, added]);
  const git = snapshot([
    candidateSnapshot(LEFT_REF, '1', LEFT_TREE),
  ]);
  const before = structuredClone({ git, bundles: [base, candidate] });

  const result = assembleBranchPortfolio(git, [candidate, base], GENERATED_AT);

  assert.deepEqual({ git, bundles: [base, candidate] }, before);
  assert.equal(result.gitSnapshotFingerprint, git.fingerprint);
  assert.equal(result.portfolio.schemaVersion, 't2c.branch/v1');
  assert.equal(result.portfolio.base.graphFingerprint, base.graph.fingerprint);
  const changes = result.evidence.candidates[0]?.assertionChanges;
  assert.ok(changes);
  assert.deepEqual(changes.map((change) => change.kind).sort(), ['added', 'modified', 'removed']);
  assert.equal(changeForRecord(changes, alpha.id).kind, 'modified');
  assert.equal(changeForRecord(changes, removed.id).kind, 'removed');
  assert.equal(changeForRecord(changes, added.id).kind, 'added');
  assert.equal(result.portfolio.candidates[0]?.recommendation, 'merge_ready');
  assert.deepEqual(result.portfolio.candidates[0]?.pullRequests, []);
  assert.equal(Object.hasOwn(result, 'schemaVersion'), false);
});

test('keeps textual and semantic conflicts separate and cited', () => {
  const alpha = record('alpha', 'base alpha');
  const stable = record('stable', 'unchanged');
  const modified = record('alpha', 'candidate alpha');
  const contradiction = record('alpha-conflict', 'alpha must not change');
  const conflictRelation = relation(modified, contradiction, 'contradicts');
  const base = bundle(BASE_TREE, [alpha, stable]);
  const left = bundle(LEFT_TREE, [stable]);
  const right = bundle(RIGHT_TREE, [modified, contradiction, stable], [conflictRelation]);
  const git = snapshot([
    candidateSnapshot(LEFT_REF, '1', LEFT_TREE, 'clean'),
    candidateSnapshot(RIGHT_REF, '2', RIGHT_TREE, 'conflict'),
  ], 'clean');

  const result = assembleBranchPortfolio(git, [base, left, right], GENERATED_AT);

  const rightEvidence = result.evidence.candidates.find((candidate) => candidate.name === RIGHT_REF);
  assert.ok(rightEvidence);
  assert.ok(rightEvidence.baseSemanticConflict.assertionIds.length > 0);
  assert.equal(rightEvidence.baseTextualMerge, 'conflict');
  const interaction = result.portfolio.interactions[0];
  assert.ok(interaction);
  assert.equal(interaction.textualMerge, 'clean');
  assert.equal(interaction.classification, 'semantic_conflict');
  assert.ok(interaction.semanticConflict.assertionIds.length > 0);
  assert.ok(result.portfolio.candidates.every((candidate) => candidate.recommendation === 'conflict'));
});

test('unanchored cross-branch additions fail closed as unknown manual review', () => {
  const stable = record('stable', 'unchanged');
  const base = bundle(BASE_TREE, [stable]);
  const left = bundle(LEFT_TREE, [stable, record('left-new', 'left addition')]);
  const right = bundle(RIGHT_TREE, [stable, record('right-new', 'right addition')]);
  const git = snapshot([
    candidateSnapshot(LEFT_REF, '1', LEFT_TREE),
    candidateSnapshot(RIGHT_REF, '2', RIGHT_TREE),
  ]);

  const result = assembleBranchPortfolio(git, [base, left, right], GENERATED_AT);

  assert.equal(result.evidence.pairs[0]?.semanticEvidence, 'unknown');
  assert.equal(result.portfolio.interactions[0]?.classification, 'unknown');
  assert.ok(result.portfolio.candidates.every((candidate) => candidate.recommendation === 'manual_review'));
});

test('duplicate changed source identities fail closed as unknown', () => {
  const firstBase = record('ambiguous', 'first base value');
  const secondBase = record('ambiguous', 'second base value');
  const firstCandidate = record('ambiguous', 'first candidate value');
  const secondCandidate = record('ambiguous', 'second candidate value');
  const base = bundle(BASE_TREE, [firstBase, secondBase]);
  const candidate = bundle(LEFT_TREE, [firstCandidate, secondCandidate]);
  const git = snapshot([candidateSnapshot(LEFT_REF, '1', LEFT_TREE)]);

  const result = assembleBranchPortfolio(git, [base, candidate], GENERATED_AT);

  assert.equal(result.evidence.candidates[0]?.semanticEvidence, 'unknown');
  assert.equal(result.portfolio.candidates[0]?.recommendation, 'manual_review');
});

test('reuses one semantic bundle for refs sharing an exact tree', () => {
  const stable = record('stable', 'unchanged');
  const added = record('shared-addition', 'same tree evidence');
  const base = bundle(BASE_TREE, [stable]);
  const shared = bundle(LEFT_TREE, [stable, added]);
  const patchId = 'e'.repeat(40);
  const git = snapshot([
    candidateSnapshot(LEFT_REF, '1', LEFT_TREE, 'clean', patchId),
    candidateSnapshot(RIGHT_REF, '2', LEFT_TREE, 'clean', patchId),
  ]);

  const result = assembleBranchPortfolio(git, [shared, base], GENERATED_AT);

  assert.equal(result.portfolio.interactions[0]?.classification, 'duplicate');
  assert.ok(result.portfolio.candidates.every((candidate) => candidate.truthMapFingerprint === shared.truthMap.fingerprint));
  assert.throws(() => assembleBranchPortfolio(git, [base]), /bundle set does not match snapshot/);
  assert.throws(() => assembleBranchPortfolio(git, [base, shared, shared]), /Duplicate semantic tree bundle/);
  const extra = bundle('f'.repeat(40), [record('extra', 'extra')]);
  assert.throws(() => assembleBranchPortfolio(git, [base, shared, extra]), /extra=/);
});

test('rejects tampered Git materialization and mismatched semantic artifacts', () => {
  const stable = record('stable', 'unchanged');
  const base = bundle(BASE_TREE, [stable]);
  const candidate = bundle(LEFT_TREE, [stable, record('added', 'new')]);
  const git = snapshot([candidateSnapshot(LEFT_REF, '1', LEFT_TREE)]);
  const tampered = structuredClone(git);
  tampered.candidates[0]!.aheadBy = 999;

  assert.throws(() => assertBranchGitMaterialization(tampered), /fingerprint does not match/);
  assert.throws(() => assembleBranchPortfolio(tampered, [base, candidate]), /fingerprint does not match/);
  const mismatched = { ...candidate, truthMap: base.truthMap };
  assert.throws(() => assembleBranchPortfolio(git, [base, mismatched]), /graph fingerprint mismatch/);
  const malformed = { ...candidate, approval: true } as BranchSemanticTreeBundle & { approval: boolean };
  assert.throws(() => assembleBranchPortfolio(git, [base, malformed]), /unexpected or missing fields/);
});

test('semantic bundle order and generated time do not alter portfolio identity', () => {
  const stable = record('stable', 'unchanged');
  const base = bundle(BASE_TREE, [stable]);
  const left = bundle(LEFT_TREE, [stable, record('left-new', 'left')], [], 'unknown');
  const right = bundle(RIGHT_TREE, [stable, record('right-new', 'right')]);
  const git = snapshot([
    candidateSnapshot(LEFT_REF, '1', LEFT_TREE),
    candidateSnapshot(RIGHT_REF, '2', RIGHT_TREE),
  ]);

  const first = assembleBranchPortfolio(git, [base, left, right], GENERATED_AT);
  const second = assembleBranchPortfolio(git, [right, left, base], '2026-08-06T08:00:00.000Z');

  assert.equal(first.portfolio.fingerprint, second.portfolio.fingerprint);
  assert.deepEqual(first.evidence, second.evidence);
  assert.notEqual(first.portfolio.generatedAt, second.portfolio.generatedAt);
  assert.equal(first.evidence.candidates.find((item) => item.name === LEFT_REF)?.semanticEvidence, 'unknown');
});

function bundle(
  treeSha: string,
  records: IntentRecord[],
  relations: IntentRelation[] = [],
  completeness: BranchSemanticTreeBundle['completeness'] = 'complete',
): BranchSemanticTreeBundle {
  const sourceGraph = graph(records, relations);
  return {
    treeSha,
    graph: sourceGraph,
    truthMap: projectTruthMap(sourceGraph, GENERATED_AT),
    completeness,
  };
}

function record(key: string, text: string): IntentRecord {
  return buildRecord({
    kind: `${key}_statement`,
    action: 'change',
    object: key,
    target: { paths: [`src/${key}.ts`], symbols: [key] },
    text,
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: `src/${key}.ts`,
    sourceLines: { start: 1, end: 1 },
    symbol: key,
    extractor: 'test/branch-assembler@1',
    rawExcerpt: text,
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['offline fixture'],
  });
}

function relation(from: IntentRecord, to: IntentRecord, type: RelationType): IntentRelation {
  const value = { from: from.id, to: to.id, type, confidence: 1, basis: ['offline fixture'] };
  return { id: `REL-${sha256(stableStringify(value)).slice(0, 20)}`, ...value };
}

function graph(records: IntentRecord[], relations: IntentRelation[]): IntentGraph {
  const sortedRecords = [...records].sort((left, right) => left.id.localeCompare(right.id));
  const sortedRelations = [...relations].sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: 't2c.graph/v1',
    generatedAt: GENERATED_AT,
    fingerprint: graphFingerprint(sortedRecords, sortedRelations),
    records: sortedRecords,
    relations: sortedRelations,
    stats: {
      bySource: counts(sortedRecords, (item) => item.source.kind),
      byAction: counts(sortedRecords, (item) => item.statement.action),
      byStatus: counts(sortedRecords, (item) => item.lifecycle.status),
    },
  };
}

function counts<T>(values: T[], key: (value: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[key(value)] = (result[key(value)] ?? 0) + 1;
  return result;
}

function candidateSnapshot(
  ref: string,
  marker: string,
  treeSha: string,
  baseTextualMerge: BranchTextualMergeStatus = 'clean',
  patchId: string | null = marker.repeat(40),
) {
  return {
    ref,
    headSha: marker.repeat(40),
    treeSha,
    mergeBaseSha: BASE_SHA,
    aheadBy: 1,
    behindBy: 0,
    changedPaths: [`${marker}.txt`],
    patchId,
    baseTextualMerge,
  };
}

function snapshot(
  candidates: ReturnType<typeof candidateSnapshot>[],
  pairTextualMerge: BranchTextualMergeStatus = 'clean',
): BranchGitMaterialization {
  const ordered = [...candidates].sort((left, right) => left.ref.localeCompare(right.ref));
  const interactions = [];
  for (let left = 0; left < ordered.length; left += 1) {
    for (let right = left + 1; right < ordered.length; right += 1) {
      interactions.push({ left: ordered[left]!.ref, right: ordered[right]!.ref, textualMerge: pairTextualMerge });
    }
  }
  const content = {
    repository: 'semcod/fixture',
    toolVersion: '0.5.1',
    base: { ref: 'refs/heads/main', sha: BASE_SHA, treeSha: BASE_TREE },
    candidates: ordered,
    interactions,
  };
  const result = { ...content, fingerprint: sha256(stableStringify(content)) };
  assertBranchGitMaterialization(result);
  return result;
}

function changeForRecord(
  changes: NonNullable<BranchPortfolioAssemblyCandidate>['assertionChanges'],
  recordId: string,
) {
  const value = changes.find((change) => change.recordIds.includes(recordId));
  assert.ok(value, `missing change citing ${recordId}`);
  return value;
}

type BranchPortfolioAssemblyCandidate = ReturnType<typeof assembleBranchPortfolio>['evidence']['candidates'][number];
