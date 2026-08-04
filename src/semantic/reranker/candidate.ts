import {
  sha256,
  stableStringify,
} from '../../core/id.js';
import { assertIntentGraph } from '../../core/schema.js';
import type { IntentGraph } from '../../core/types.js';
import { boundedScore, requiredText, validDate, validateRetrieval } from './validation.js';
import {
  type SemanticCandidate,
  type SemanticCandidateInput,
  type SemanticCandidateSet,
  type SemanticRetrievalIdentity,
  type SemanticRetrievalInput,
} from './types.js';

export function createSemanticCandidateSet(
  graph: IntentGraph,
  inputs: SemanticCandidateInput[],
  retrieval: SemanticRetrievalInput,
  maxCandidatesPerDeclaration = 5,
  generatedAt = new Date().toISOString(),
): SemanticCandidateSet {
  assertIntentGraph(graph);
  if (
    !Number.isInteger(maxCandidatesPerDeclaration)
    || maxCandidatesPerDeclaration < 1
    || maxCandidatesPerDeclaration > 10
  ) {
    throw new Error('maxCandidatesPerDeclaration must be an integer between 1 and 10');
  }

  const identity = {
    provider: requiredText(retrieval.provider, 'retrieval.provider'),
    model: requiredText(retrieval.model, 'retrieval.model'),
    revision: requiredText(retrieval.revision, 'retrieval.revision'),
    metric: requiredText(retrieval.metric, 'retrieval.metric'),
    inputHash: sha256(stableStringify({
      graphFingerprint: graph.fingerprint,
      pairs: inputs
        .map((item) => ({
          declarationRecordId: item.declarationRecordId,
          moduleRecordId: item.moduleRecordId,
        }))
        .sort(comparePair),
    })),
  } satisfies SemanticRetrievalIdentity;

  const grouped = new Map<string, SemanticCandidateInput[]>();
  for (const input of inputs) {
    const values = grouped.get(input.declarationRecordId);
    if (values) {
      values.push(input);
    } else {
      grouped.set(input.declarationRecordId, [input]);
    }
  }

  const candidates: SemanticCandidate[] = [];
  for (const [declarationRecordId, values] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const ranked = [...values]
      .sort((left, right) => right.score - left.score || left.moduleRecordId.localeCompare(right.moduleRecordId))
      .slice(0, maxCandidatesPerDeclaration);
    ranked.forEach((input, index) => {
      const seed = {
        graphFingerprint: graph.fingerprint,
        retrieval: identity,
        declarationRecordId,
        moduleRecordId: input.moduleRecordId,
        score: boundedScore(input.score),
        rank: index + 1,
      };
      candidates.push({
        id: `SCAND-${sha256(stableStringify(seed)).slice(0, 20)}`,
        declarationRecordId,
        moduleRecordId: input.moduleRecordId,
        score: seed.score,
        rank: seed.rank,
      });
    });
  }

  const payload = {
    graphFingerprint: graph.fingerprint,
    maxCandidatesPerDeclaration,
    retrieval: identity,
    candidates,
  };
  const result: SemanticCandidateSet = {
    schemaVersion: 't2c.semantic-candidate-set/v1',
    generatedAt,
    ...payload,
    candidateSetHash: sha256(stableStringify(payload)),
  };
  assertSemanticCandidateSet(result, graph);
  return result;
}

export function assertSemanticCandidateSet(
  value: SemanticCandidateSet,
  graph: IntentGraph,
): void {
  assertIntentGraph(graph);
  if (value.schemaVersion !== 't2c.semantic-candidate-set/v1') {
    throw new Error('Unsupported semantic candidate-set schemaVersion');
  }
  validDate(value.generatedAt, 'candidateSet.generatedAt');
  if (value.graphFingerprint !== graph.fingerprint) {
    throw new Error('Semantic candidate set graphFingerprint does not match the graph');
  }
  if (
    !Number.isInteger(value.maxCandidatesPerDeclaration)
    || value.maxCandidatesPerDeclaration < 1
    || value.maxCandidatesPerDeclaration > 10
  ) {
    throw new Error('candidateSet.maxCandidatesPerDeclaration must be an integer between 1 and 10');
  }

  validateRetrieval(value.retrieval);

  const records = new Map(graph.records.map((record) => [record.id, record]));
  const seenIds = new Set<string>();
  const seenPairs = new Set<string>();
  const byDeclaration = new Map<string, SemanticCandidate[]>();

  for (const candidate of value.candidates) {
    if (!/^SCAND-[a-f0-9]{20}$/.test(candidate.id)) {
      throw new Error(`Invalid semantic candidate ID: ${candidate.id}`);
    }
    if (seenIds.has(candidate.id)) {
      throw new Error(`Duplicate semantic candidate ID: ${candidate.id}`);
    }
    seenIds.add(candidate.id);

    const declaration = records.get(candidate.declarationRecordId);
    const module = records.get(candidate.moduleRecordId);
    if (!declaration || !module) {
      throw new Error(`Semantic candidate ${candidate.id} cites an unknown record`);
    }
    if (declaration.statement.kind === 'module_fact') {
      throw new Error(`Semantic candidate ${candidate.id} declarationRecordId points to a module`);
    }
    if (module.statement.kind !== 'module_fact' || module.source.kind !== 'ast') {
      throw new Error(`Semantic candidate ${candidate.id} moduleRecordId must point to an AST module_fact`);
    }

    const pair = `${candidate.declarationRecordId}|${candidate.moduleRecordId}`;
    if (seenPairs.has(pair)) {
      throw new Error(`Duplicate semantic candidate pair: ${pair}`);
    }
    seenPairs.add(pair);
    boundedScore(candidate.score);

    if (!Number.isInteger(candidate.rank)
      || candidate.rank < 1
      || candidate.rank > value.maxCandidatesPerDeclaration
    ) {
      throw new Error(`Semantic candidate ${candidate.id} has an invalid rank`);
    }

    const existing = byDeclaration.get(candidate.declarationRecordId);
    if (existing) {
      existing.push(candidate);
    } else {
      byDeclaration.set(candidate.declarationRecordId, [candidate]);
    }
  }

  for (const [declarationRecordId, candidates] of byDeclaration) {
    if (candidates.length > value.maxCandidatesPerDeclaration) {
      throw new Error(`Declaration ${declarationRecordId} exceeds the bounded candidate limit`);
    }
    const ranked = [...candidates].sort((left, right) => left.rank - right.rank);
    ranked.forEach((candidate, index) => {
      if (candidate.rank !== index + 1) {
        throw new Error(`Declaration ${declarationRecordId} has non-contiguous ranks`);
      }
      if (index > 0 && candidate.score > (ranked[index - 1]?.score ?? 1)) {
        throw new Error(`Declaration ${declarationRecordId} ranks a higher score below a lower score`);
      }
    });
  }

  const expectedHash = sha256(stableStringify({
    graphFingerprint: value.graphFingerprint,
    maxCandidatesPerDeclaration: value.maxCandidatesPerDeclaration,
    retrieval: value.retrieval,
    candidates: value.candidates,
  }));
  if (value.candidateSetHash !== expectedHash) {
    throw new Error('Semantic candidateSetHash does not match its content');
  }
}

function comparePair(
  left: Pick<SemanticCandidateInput, 'declarationRecordId' | 'moduleRecordId'>,
  right: Pick<SemanticCandidateInput, 'declarationRecordId' | 'moduleRecordId'>,
): number {
  return left.declarationRecordId.localeCompare(right.declarationRecordId)
    || left.moduleRecordId.localeCompare(right.moduleRecordId);
}
