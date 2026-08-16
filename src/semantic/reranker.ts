import { createRelationId, graphFingerprint, sha256, stableStringify } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import type { IntentGraph, IntentRelation } from '../core/types.js';
import { T2C_VERSION } from '../version.js';
import type {
  SemanticCandidate,
  SemanticCandidateInput,
  SemanticCandidateSet,
  SemanticRerankDecisionInput,
  SemanticRerankGeneration,
  SemanticRerankGenerationInput,
  SemanticRerankResult,
  SemanticRetrievalIdentity,
  SemanticRetrievalInput,
} from './reranker-types.js';
import {
  assertSemanticCandidateSet,
  assertSemanticRerankResult,
  boundedScore,
  comparePair,
  requiredText,
  roundedConfidence,
} from './reranker-validate.js';

export type {
  SemanticCandidate,
  SemanticCandidateInput,
  SemanticCandidateSet,
  SemanticEvidenceCitation,
  SemanticRerankDecision,
  SemanticRerankDecisionInput,
  SemanticRerankGeneration,
  SemanticRerankGenerationInput,
  SemanticRerankReason,
  SemanticRerankResult,
  SemanticRerankVerdict,
  SemanticRetrievalIdentity,
  SemanticRetrievalInput,
} from './reranker-types.js';

export {
  SEMANTIC_RERANK_REASONS,
  SEMANTIC_RERANK_VERDICTS,
} from './reranker-types.js';

export {
  assertSemanticCandidateSet,
  assertSemanticRerankResult,
  assertSemanticVerdictReason,
} from './reranker-validate.js';

export function createSemanticCandidateSet(
  graph: IntentGraph,
  inputs: SemanticCandidateInput[],
  retrieval: SemanticRetrievalInput,
  maxCandidatesPerDeclaration = 5,
  generatedAt = new Date().toISOString(),
): SemanticCandidateSet {
  assertIntentGraph(graph);
  if (!Number.isInteger(maxCandidatesPerDeclaration)
    || maxCandidatesPerDeclaration < 1
    || maxCandidatesPerDeclaration > 10) {
    throw new Error('maxCandidatesPerDeclaration must be an integer between 1 and 10');
  }
  const identity = {
    provider: requiredText(retrieval.provider, 'retrieval.provider'),
    model: requiredText(retrieval.model, 'retrieval.model'),
    revision: requiredText(retrieval.revision, 'retrieval.revision'),
    metric: requiredText(retrieval.metric, 'retrieval.metric'),
    inputHash: sha256(stableStringify({
      graphFingerprint: graph.fingerprint,
      pairs: inputs.map((item) => ({
        declarationRecordId: item.declarationRecordId,
        moduleRecordId: item.moduleRecordId,
      })).sort(comparePair),
    })),
  } satisfies SemanticRetrievalIdentity;
  const grouped = new Map<string, SemanticCandidateInput[]>();
  for (const input of inputs) {
    const values = grouped.get(input.declarationRecordId);
    if (values) values.push(input);
    else grouped.set(input.declarationRecordId, [input]);
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

export function createSemanticRerankResult(
  graph: IntentGraph,
  candidateSet: SemanticCandidateSet,
  inputs: SemanticRerankDecisionInput[],
  generation: SemanticRerankGenerationInput,
  generatedAt = new Date().toISOString(),
): SemanticRerankResult {
  assertSemanticCandidateSet(candidateSet, graph);
  const generationValue: SemanticRerankGeneration = {
    generator: 't2c/cross-language-reranker',
    generatorVersion: '1',
    runtimeVersion: T2C_VERSION,
    provider: requiredText(generation.provider, 'generation.provider'),
    requestedModel: requiredText(generation.requestedModel ?? generation.model, 'generation.requestedModel'),
    model: requiredText(generation.model, 'generation.model'),
    modelRevision: requiredText(generation.modelRevision, 'generation.modelRevision'),
    responseId: generation.responseId ?? null,
    promptHash: sha256(stableStringify({
      graphFingerprint: graph.fingerprint,
      candidateSetHash: candidateSet.candidateSetHash,
      candidates: candidateSet.candidates,
    })),
  };
  const decisions = inputs.map((input) => {
    const seed = {
      candidateSetHash: candidateSet.candidateSetHash,
      candidateId: input.candidateId,
      verdict: input.verdict,
      confidence: roundedConfidence(input.confidence),
      reasonCode: input.reasonCode,
      rationale: requiredText(input.rationale, 'decision.rationale'),
      citedRecordIds: [...new Set(input.citedRecordIds)].sort(),
      evidence: [...input.evidence]
        .map((item) => ({
          recordId: item.recordId,
          quote: requiredText(item.quote, 'decision.evidence.quote'),
        }))
        .sort((left, right) => left.recordId.localeCompare(right.recordId) || left.quote.localeCompare(right.quote)),
    };
    return {
      id: `SDEC-${sha256(stableStringify(seed)).slice(0, 20)}`,
      ...seed,
    };
  }).sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const payload = {
    graphFingerprint: graph.fingerprint,
    candidateSetHash: candidateSet.candidateSetHash,
    generation: generationValue,
    decisions,
  };
  const result: SemanticRerankResult = {
    schemaVersion: 't2c.semantic-rerank/v1',
    generatedAt,
    ...payload,
    resultHash: sha256(stableStringify(payload)),
  };
  assertSemanticRerankResult(result, candidateSet, graph);
  return result;
}

export function applyAcceptedSemanticRelations(
  graph: IntentGraph,
  candidateSet: SemanticCandidateSet,
  rerank: SemanticRerankResult,
  generatedAt = new Date().toISOString(),
): IntentGraph {
  assertSemanticRerankResult(rerank, candidateSet, graph);
  const candidates = new Map(candidateSet.candidates.map((candidate) => [candidate.id, candidate]));
  const added = rerank.decisions
    .filter((decision) => decision.verdict === 'accept')
    .map((decision): IntentRelation => {
      const candidate = candidates.get(decision.candidateId);
      if (!candidate) throw new Error(`Accepted decision cites unknown candidate ${decision.candidateId}`);
      const relationWithoutId = {
        from: candidate.declarationRecordId,
        to: candidate.moduleRecordId,
        type: 'evidenced_by' as const,
        confidence: Math.min(0.95, decision.confidence),
        basis: [
          'cross_language_reranker',
          `candidate:${candidate.id}`,
          `decision:${decision.id}`,
          `retrieval:${candidateSet.retrieval.provider}/${candidateSet.retrieval.model}@${candidateSet.retrieval.revision}`,
          `retrieval_score:${candidate.score}`,
          `reranker:${rerank.generation.provider}/${rerank.generation.model}@${rerank.generation.modelRevision}`,
          ...decision.evidence.map((item) => `citation:${item.recordId}`),
        ],
      };
      return { id: createRelationId(relationWithoutId), ...relationWithoutId };
    });
  const relations = [...new Map([...graph.relations, ...added].map((relation) => [relation.id, relation])).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
  const output: IntentGraph = {
    ...graph,
    generatedAt,
    fingerprint: graphFingerprint(graph.records, relations),
    relations,
  };
  assertIntentGraph(output);
  return output;
}
