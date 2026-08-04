import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertBranchPortfolio,
  projectBranchPortfolio,
  type BranchAssertionChange,
  type BranchCandidateEvidence,
  type BranchPairEvidence,
  type BranchPortfolio,
  type BranchPortfolioEvidence,
} from '../src/core/branch-portfolio.js';

const BASE_SHA = 'a'.repeat(40);
const EMPTY_CITATIONS = { assertionIds: [], recordIds: [], relationIds: [] };

function change(marker: string, kind: BranchAssertionChange['kind'] = 'modified'): BranchAssertionChange {
  return {
    assertionIds: [`TRUTH-${marker.repeat(20)}`],
    recordIds: [`INT-${marker.repeat(20)}`],
    relationIds: [`REL-${marker.repeat(20)}`],
    kind,
  };
}

function candidate(
  name: string,
  marker: string,
  overrides: Partial<BranchCandidateEvidence> = {},
): BranchCandidateEvidence {
  return {
    name,
    headSha: marker.repeat(40),
    treeSha: marker.repeat(40),
    mergeBaseSha: BASE_SHA,
    aheadBy: 1,
    behindBy: 0,
    pullRequests: [],
    patchId: null,
    baseTextualMerge: 'clean',
    semanticEvidence: 'complete',
    graphFingerprint: marker.repeat(64),
    truthMapFingerprint: marker.repeat(64),
    assertionChanges: [change(marker)],
    baseSemanticConflict: structuredClone(EMPTY_CITATIONS),
    ...overrides,
  };
}

function pair(
  left: string,
  right: string,
  overrides: Partial<BranchPairEvidence> = {},
): BranchPairEvidence {
  return {
    left,
    right,
    textualMerge: 'clean',
    ordering: 'independent',
    semanticConflict: structuredClone(EMPTY_CITATIONS),
    ...overrides,
  };
}

function evidence(
  candidates: BranchCandidateEvidence[],
  pairs: BranchPairEvidence[],
): BranchPortfolioEvidence {
  return {
    schemaVersion: 't2c.branch-evidence/v1',
    repository: 'semcod/todo2code',
    toolVersion: '0.5.1',
    base: {
      sha: BASE_SHA,
      treeSha: 'b'.repeat(40),
      graphFingerprint: 'c'.repeat(64),
      truthMapFingerprint: 'd'.repeat(64),
    },
    candidates,
    pairs,
  };
}

test('disjoint immutable candidates are bound to exact snapshots and merge-ready', () => {
  const input = evidence(
    [candidate('feature/alpha', '1', { pullRequests: [12] }), candidate('feature/beta', '2')],
    [pair('feature/alpha', 'feature/beta')],
  );

  const result = projectBranchPortfolio(input, '2026-08-04T21:30:00.000Z');

  assert.equal(result.schemaVersion, 't2c.branch/v1');
  assert.equal(result.base.sha, BASE_SHA);
  assert.deepEqual(result.candidates.map((item) => item.name), ['feature/alpha', 'feature/beta']);
  assert.deepEqual(result.candidates.map((item) => item.recommendation), ['merge_ready', 'merge_ready']);
  assert.equal(result.interactions[0]?.classification, 'disjoint');
  assert.equal(result.interactions[0]?.leftHeadSha, '1'.repeat(40));
  assert.equal(result.interactions[0]?.rightHeadSha, '2'.repeat(40));
  assert.deepEqual(result.candidates[0]?.pullRequests, [12]);
  assertBranchPortfolio(result, input);
});

test('equivalent patch identity detects duplicate work across different commits', () => {
  const patchId = 'e'.repeat(40);
  const input = evidence(
    [
      candidate('feature/original', '1', { patchId }),
      candidate('feature/cherry-pick', '2', { patchId }),
    ],
    [pair('feature/original', 'feature/cherry-pick')],
  );

  const result = projectBranchPortfolio(input);

  assert.equal(result.interactions[0]?.classification, 'duplicate');
  assert.deepEqual(result.candidates.map((item) => item.recommendation), ['duplicate', 'duplicate']);
  assert.ok(result.candidates.every((item) => item.reasons.includes('EQUIVALENT_CHANGESET')));
});

test('textual and semantic conflicts stay separate and both block candidates', () => {
  const textual = evidence(
    [candidate('feature/text-left', '1'), candidate('feature/text-right', '2')],
    [pair('feature/text-left', 'feature/text-right', { textualMerge: 'conflict' })],
  );
  const shared = change('3');
  const semanticConflict = {
    assertionIds: [...shared.assertionIds],
    recordIds: [...shared.recordIds],
    relationIds: [...shared.relationIds],
  };
  const semantic = evidence(
    [
      candidate('feature/semantic-left', '1', { assertionChanges: [shared] }),
      candidate('feature/semantic-right', '2', { assertionChanges: [{ ...shared, kind: 'removed' }] }),
    ],
    [pair('feature/semantic-left', 'feature/semantic-right', { semanticConflict })],
  );

  const textualResult = projectBranchPortfolio(textual);
  const semanticResult = projectBranchPortfolio(semantic);

  assert.equal(textualResult.interactions[0]?.classification, 'textual_conflict');
  assert.deepEqual(textualResult.interactions[0]?.semanticConflict, EMPTY_CITATIONS);
  assert.equal(semanticResult.interactions[0]?.classification, 'semantic_conflict');
  assert.equal(semanticResult.interactions[0]?.textualMerge, 'clean');
  assert.ok([...textualResult.candidates, ...semanticResult.candidates]
    .every((item) => item.recommendation === 'conflict'));
});

test('contained or proven empty work is stale while unknown evidence requires review', () => {
  const input = evidence(
    [
      candidate('feature/contained', '1', { aheadBy: 0, assertionChanges: [] }),
      candidate('feature/unknown', '2', {
        semanticEvidence: 'unknown',
        baseTextualMerge: 'unknown',
        assertionChanges: [],
      }),
    ],
    [pair('feature/contained', 'feature/unknown', { textualMerge: 'unknown', ordering: 'unknown' })],
  );

  const result = projectBranchPortfolio(input);

  assert.equal(result.candidates.find((item) => item.name.endsWith('contained'))?.recommendation, 'stale');
  assert.equal(result.candidates.find((item) => item.name.endsWith('unknown'))?.recommendation, 'manual_review');
  assert.equal(result.interactions[0]?.classification, 'unknown');
});

test('ordering and target movement produce merge-after and rebase recommendations', () => {
  const input = evidence(
    [candidate('feature/first', '1'), candidate('feature/second', '2', { behindBy: 2 })],
    [pair('feature/second', 'feature/first', { ordering: 'right_after_left' })],
  );

  const result = projectBranchPortfolio(input);

  assert.equal(result.interactions[0]?.ordering, 'left_after_right');
  assert.equal(result.interactions[0]?.classification, 'ordered_after');
  assert.equal(result.candidates.find((item) => item.name === 'feature/first')?.recommendation, 'merge_after');
  assert.equal(result.candidates.find((item) => item.name === 'feature/second')?.recommendation, 'rebase_required');
});

test('ordering and generated time do not affect identity but a changed base does', () => {
  const alpha = candidate('feature/alpha', '1');
  const beta = candidate('feature/beta', '2');
  const firstInput = evidence([alpha, beta], [pair(alpha.name, beta.name)]);
  const secondInput = evidence([beta, alpha], [pair(beta.name, alpha.name)]);

  const first = projectBranchPortfolio(firstInput, '2026-08-04T21:30:00.000Z');
  const second = projectBranchPortfolio(secondInput, '2026-08-05T09:30:00.000Z');
  const movedBase = structuredClone(firstInput);
  movedBase.base.sha = 'f'.repeat(40);

  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.candidates, second.candidates);
  assert.deepEqual(first.interactions, second.interactions);
  assert.notEqual(first.generatedAt, second.generatedAt);
  assert.notEqual(first.fingerprint, projectBranchPortfolio(movedBase).fingerprint);
});

test('malformed identities and ungrounded semantic conflicts fail closed', () => {
  const left = candidate('feature/left', '1');
  const right = candidate('feature/right', '2');
  const invalidSha = evidence([candidate('feature/invalid', '3')], []);
  invalidSha.candidates[0]!.headSha = 'ABC';
  assert.throws(() => projectBranchPortfolio(invalidSha), /Invalid feature\/invalid headSha/);

  const unrelated = pair(left.name, right.name, {
    semanticConflict: {
      assertionIds: [`TRUTH-${'f'.repeat(20)}`],
      recordIds: [],
      relationIds: [],
    },
  });
  assert.throws(
    () => projectBranchPortfolio(evidence([left, right], [unrelated])),
    /references unrelated assertion/,
  );
});

test('missing, duplicate and self candidate pairs fail closed', () => {
  const left = candidate('feature/left', '1');
  const right = candidate('feature/right', '2');
  assert.throws(
    () => projectBranchPortfolio(evidence([left, right], [])),
    /exactly one result for every candidate pair/,
  );
  const validPair = pair(left.name, right.name);
  assert.throws(
    () => projectBranchPortfolio(evidence([left, right], [validPair, validPair])),
    /Duplicate branch pair/,
  );
  assert.throws(
    () => projectBranchPortfolio(evidence([left], [pair(left.name, left.name)])),
    /repeats candidate/,
  );
});

test('portfolio validation rejects tampering and authorization-like fields', () => {
  const input = evidence([candidate('feature/only', '1')], []);
  const valid = projectBranchPortfolio(input);
  const changedBase = structuredClone(valid) as BranchPortfolio;
  changedBase.base.sha = 'f'.repeat(40);
  assert.throws(() => assertBranchPortfolio(changedBase, input), /does not match its immutable evidence/);

  const unauthorized = structuredClone(valid) as BranchPortfolio & { approval: boolean };
  unauthorized.approval = true;
  assert.throws(() => assertBranchPortfolio(unauthorized, input), /does not match its immutable evidence/);
  assert.equal(stableJson(valid).includes('approval'), false);
  assert.equal(stableJson(valid).includes('token'), false);
  assert.equal(stableJson(valid).includes('command'), false);
});

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}
