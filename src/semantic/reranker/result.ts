import { createRelationId, graphFingerprint, sha256, stableStringify } from '../../core/id.js';
import { assertIntentGraph } from '../../core/schema.js';
import { T2C_VERSION } from '../../version.js';
import type { IntentGraph, IntentRelation } from '../../core/types.js';
import { assertSemanticCandidateSet } from './candidate.js';
import {
  assertGroundedQuote,
  requiredText,
  roundedConfidence,
  validateGeneration,
  validateVerdictReason,
  validDate,
} from './validation.js';
import {
  type SemanticCandidateSet,
  type SemanticRerankDecision,
  type SemanticRerankDecisionInput,
  type SemanticRerankGeneration,
  type SemanticRerankGenerationInput,
  type SemanticRerankResult,
} from './types.js';

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

  const decisions = inputs
    .map((input) => {
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
          .sort((left, right) => left.recordId.localeCompare(right.recordId)
            || left.quote.localeCompare(right.quote)),
      };
      return {
        id: `SDEC-${sha256(stableStringify(seed)).slice(0, 20)}`,
        ...seed,
      } satisfies SemanticRerankDecision;
    })
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));

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

export function assertSemanticRerankResult(
  value: SemanticRerankResult,
  candidateSet: SemanticCandidateSet,
  graph: IntentGraph,
): void {
  assertSemanticCandidateSet(candidateSet, graph);

  if (value.schemaVersion !== 't2c.semantic-rerank/v1') {
    throw new Error('Unsupported semantic rerank schemaVersion');
  }
  validDate(value.generatedAt, 'rerank.generatedAt');

  if (value.graphFingerprint !== graph.fingerprint || value.candidateSetHash !== candidateSet.candidateSetHash) {
    throw new Error('Semantic rerank result does not match its graph or candidate set');
  }

  validateGeneration(value.generation);

  const candidates = new Map(candidateSet.candidates.map((candidate) => [candidate.id, candidate]));
  const records = new Map(graph.records.map((record) => [record.id, record]));
  const seenDecisions = new Set<string>();
  const acceptedDeclarations = new Set<string>();

  for (const decision of value.decisions) {
    if (!/^SDEC-[a-f0-9]{20}$/.test(decision.id)) {
      throw new Error(`Invalid semantic decision ID: ${decision.id}`);
    }
    if (seenDecisions.has(decision.candidateId)) {
      throw new Error(`Duplicate decision for candidate ${decision.candidateId}`);
    }
    seenDecisions.add(decision.candidateId);

    const candidate = candidates.get(decision.candidateId);
    if (!candidate) {
      throw new Error(`Semantic decision cites unknown candidate ${decision.candidateId}`);
    }

    roundedConfidence(decision.confidence);
    validateVerdictReason(decision);
    requiredText(decision.rationale, `Decision ${decision.id} rationale`);

    const expectedRecords = [candidate.declarationRecordId, candidate.moduleRecordId].sort();
    const citedRecords = [...new Set(decision.citedRecordIds)].sort();
    if (stableStringify(citedRecords) !== stableStringify(expectedRecords)) {
      throw new Error(`Decision ${decision.id} must cite exactly both candidate records`);
    }

    for (const recordId of expectedRecords) {
      const citations = decision.evidence.filter((item) => item.recordId === recordId);
      if (citations.length === 0) {
        throw new Error(`Decision ${decision.id} lacks evidence for ${recordId}`);
      }
      const record = records.get(recordId);
      if (!record) {
        throw new Error(`Decision ${decision.id} cites unknown record ${recordId}`);
      }
      for (const citation of citations) {
        assertGroundedQuote(citation, record, decision.id);
      }
    }

    if (decision.evidence.some((item) => !expectedRecords.includes(item.recordId))) {
      throw new Error(`Decision ${decision.id} evidence escapes its candidate pair`);
    }

    if (decision.verdict === 'accept') {
      if (acceptedDeclarations.has(candidate.declarationRecordId)) {
        throw new Error(`Reranker accepted more than one module for ${candidate.declarationRecordId}`);
      }
      acceptedDeclarations.add(candidate.declarationRecordId);
    }
  }

  if (seenDecisions.size !== candidates.size) {
    throw new Error('Semantic rerank result must decide every bounded candidate');
  }

  const expectedHash = sha256(stableStringify({
    graphFingerprint: value.graphFingerprint,
    candidateSetHash: value.candidateSetHash,
    generation: value.generation,
    decisions: value.decisions,
  }));
  if (value.resultHash !== expectedHash) {
    throw new Error('Semantic rerank resultHash does not match its content');
  }
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
      if (!candidate) {
        throw new Error(`Accepted decision cites unknown candidate ${decision.candidateId}`);
      }

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
      return {
        id: createRelationId(relationWithoutId),
        ...relationWithoutId,
      };
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

export function assertSemanticVerdictReason(
  verdict: 'accept' | 'reject' | 'abstain',
  reasonCode:
    | 'repository_evidence_supports_match'
    | 'wrong_target'
    | 'contradicted'
    | 'insufficient_evidence'
    | 'ambiguous'
    | 'multi_module',
  location = 'Semantic decision',
): void {
  const allowedVerdicts = new Set(['accept', 'reject', 'abstain']);
  if (!allowedVerdicts.has(verdict)) {
    throw new Error(`${location} has invalid verdict`);
  }

  const allowedReasons = new Set([
    'repository_evidence_supports_match',
    'wrong_target',
    'contradicted',
    'insufficient_evidence',
    'ambiguous',
    'multi_module',
  ]);
  if (!allowedReasons.has(reasonCode)) {
    throw new Error(`${location} has invalid reasonCode`);
  }

  if (verdict === 'accept' && reasonCode !== 'repository_evidence_supports_match') {
    throw new Error(`${location}: accept requires repository_evidence_supports_match`);
  }
  if (verdict !== 'accept' && reasonCode === 'repository_evidence_supports_match') {
    throw new Error(`${location}: non-accept cannot use repository_evidence_supports_match`);
  }
}
