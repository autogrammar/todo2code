import { createRelationId, graphFingerprint, sha256, stableStringify } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import type { IntentGraph, IntentRecord, IntentRelation } from '../core/types.js';
import { T2C_VERSION } from '../version.js';

export type SemanticRerankVerdict = 'accept' | 'reject' | 'abstain';
export type SemanticRerankReason =
  | 'repository_evidence_supports_match'
  | 'wrong_target'
  | 'contradicted'
  | 'insufficient_evidence'
  | 'ambiguous'
  | 'multi_module';

export const SEMANTIC_RERANK_VERDICTS = ['accept', 'reject', 'abstain'] as const;
export const SEMANTIC_RERANK_REASONS = [
  'repository_evidence_supports_match',
  'wrong_target',
  'contradicted',
  'insufficient_evidence',
  'ambiguous',
  'multi_module',
] as const;

export interface SemanticRetrievalIdentity {
  provider: string;
  model: string;
  revision: string;
  metric: string;
  inputHash: string;
}

export interface SemanticCandidate {
  id: string;
  declarationRecordId: string;
  moduleRecordId: string;
  score: number;
  rank: number;
}

export interface SemanticCandidateSet {
  schemaVersion: 't2c.semantic-candidate-set/v1';
  generatedAt: string;
  graphFingerprint: string;
  maxCandidatesPerDeclaration: number;
  retrieval: SemanticRetrievalIdentity;
  candidates: SemanticCandidate[];
  candidateSetHash: string;
}

export interface SemanticCandidateInput {
  declarationRecordId: string;
  moduleRecordId: string;
  score: number;
}

export interface SemanticRetrievalInput {
  provider: string;
  model: string;
  revision: string;
  metric: string;
}

export interface SemanticEvidenceCitation {
  recordId: string;
  quote: string;
}

export interface SemanticRerankDecisionInput {
  candidateId: string;
  verdict: SemanticRerankVerdict;
  confidence: number;
  reasonCode: SemanticRerankReason;
  rationale: string;
  citedRecordIds: string[];
  evidence: SemanticEvidenceCitation[];
}

export interface SemanticRerankDecision extends SemanticRerankDecisionInput {
  id: string;
}

export interface SemanticRerankGeneration {
  generator: 't2c/cross-language-reranker';
  generatorVersion: '1';
  runtimeVersion: string;
  provider: string;
  requestedModel: string;
  model: string;
  modelRevision: string;
  responseId: string | null;
  promptHash: string;
}

export interface SemanticRerankResult {
  schemaVersion: 't2c.semantic-rerank/v1';
  generatedAt: string;
  graphFingerprint: string;
  candidateSetHash: string;
  generation: SemanticRerankGeneration;
  decisions: SemanticRerankDecision[];
  resultHash: string;
}

export interface SemanticRerankGenerationInput {
  provider: string;
  requestedModel?: string;
  model: string;
  modelRevision: string;
  responseId?: string | null;
}

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
  if (!Number.isInteger(value.maxCandidatesPerDeclaration)
    || value.maxCandidatesPerDeclaration < 1
    || value.maxCandidatesPerDeclaration > 10) {
    throw new Error('candidateSet.maxCandidatesPerDeclaration must be an integer between 1 and 10');
  }
  validateRetrieval(value.retrieval);
  const records = new Map(graph.records.map((record) => [record.id, record]));
  const seenIds = new Set<string>();
  const seenPairs = new Set<string>();
  const byDeclaration = new Map<string, SemanticCandidate[]>();
  for (const candidate of value.candidates) {
    if (!/^SCAND-[a-f0-9]{20}$/.test(candidate.id)) throw new Error(`Invalid semantic candidate ID: ${candidate.id}`);
    if (seenIds.has(candidate.id)) throw new Error(`Duplicate semantic candidate ID: ${candidate.id}`);
    seenIds.add(candidate.id);
    const declaration = records.get(candidate.declarationRecordId);
    const module = records.get(candidate.moduleRecordId);
    if (!declaration || !module) throw new Error(`Semantic candidate ${candidate.id} cites an unknown record`);
    if (declaration.statement.kind === 'module_fact') {
      throw new Error(`Semantic candidate ${candidate.id} declarationRecordId points to a module`);
    }
    if (module.statement.kind !== 'module_fact' || module.source.kind !== 'ast') {
      throw new Error(`Semantic candidate ${candidate.id} moduleRecordId must point to an AST module_fact`);
    }
    const pair = `${candidate.declarationRecordId}|${candidate.moduleRecordId}`;
    if (seenPairs.has(pair)) throw new Error(`Duplicate semantic candidate pair: ${pair}`);
    seenPairs.add(pair);
    boundedScore(candidate.score);
    if (!Number.isInteger(candidate.rank) || candidate.rank < 1 || candidate.rank > value.maxCandidatesPerDeclaration) {
      throw new Error(`Semantic candidate ${candidate.id} has an invalid rank`);
    }
    const values = byDeclaration.get(candidate.declarationRecordId);
    if (values) values.push(candidate);
    else byDeclaration.set(candidate.declarationRecordId, [candidate]);
  }
  for (const [declarationRecordId, candidates] of byDeclaration) {
    if (candidates.length > value.maxCandidatesPerDeclaration) {
      throw new Error(`Declaration ${declarationRecordId} exceeds the bounded candidate limit`);
    }
    const ranked = [...candidates].sort((left, right) => left.rank - right.rank);
    ranked.forEach((candidate, index) => {
      if (candidate.rank !== index + 1) throw new Error(`Declaration ${declarationRecordId} has non-contiguous ranks`);
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
  if (value.candidateSetHash !== expectedHash) throw new Error('Semantic candidateSetHash does not match its content');
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
    } satisfies SemanticRerankDecision;
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
    if (!/^SDEC-[a-f0-9]{20}$/.test(decision.id)) throw new Error(`Invalid semantic decision ID: ${decision.id}`);
    if (seenDecisions.has(decision.candidateId)) throw new Error(`Duplicate decision for candidate ${decision.candidateId}`);
    seenDecisions.add(decision.candidateId);
    const candidate = candidates.get(decision.candidateId);
    if (!candidate) throw new Error(`Semantic decision cites unknown candidate ${decision.candidateId}`);
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
      if (citations.length === 0) throw new Error(`Decision ${decision.id} lacks evidence for ${recordId}`);
      const record = records.get(recordId);
      if (!record) throw new Error(`Decision ${decision.id} cites unknown record ${recordId}`);
      for (const citation of citations) assertGroundedQuote(citation, record, decision.id);
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
  if (value.resultHash !== expectedHash) throw new Error('Semantic rerank resultHash does not match its content');
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

function validateRetrieval(value: SemanticRetrievalIdentity): void {
  requiredText(value.provider, 'retrieval.provider');
  requiredText(value.model, 'retrieval.model');
  requiredText(value.revision, 'retrieval.revision');
  requiredText(value.metric, 'retrieval.metric');
  if (!/^[a-f0-9]{64}$/.test(value.inputHash)) throw new Error('retrieval.inputHash must be SHA-256');
}

function validateGeneration(value: SemanticRerankGeneration): void {
  if (value.generator !== 't2c/cross-language-reranker' || value.generatorVersion !== '1') {
    throw new Error('Unsupported semantic reranker generator');
  }
  requiredText(value.runtimeVersion, 'generation.runtimeVersion');
  requiredText(value.provider, 'generation.provider');
  requiredText(value.requestedModel, 'generation.requestedModel');
  requiredText(value.model, 'generation.model');
  requiredText(value.modelRevision, 'generation.modelRevision');
  if (value.responseId !== null) requiredText(value.responseId, 'generation.responseId');
  if (!/^[a-f0-9]{64}$/.test(value.promptHash)) throw new Error('generation.promptHash must be SHA-256');
}

function validateVerdictReason(decision: SemanticRerankDecision): void {
  assertSemanticVerdictReason(
    decision.verdict,
    decision.reasonCode,
    `Decision ${decision.id}`,
  );
}

export function assertSemanticVerdictReason(
  verdict: SemanticRerankVerdict,
  reasonCode: SemanticRerankReason,
  location = 'Semantic decision',
): void {
  const allowed = new Set<SemanticRerankVerdict>(SEMANTIC_RERANK_VERDICTS);
  if (!allowed.has(verdict)) throw new Error(`${location} has invalid verdict`);
  const reasons = new Set<SemanticRerankReason>(SEMANTIC_RERANK_REASONS);
  if (!reasons.has(reasonCode)) throw new Error(`${location} has invalid reasonCode`);
  if (verdict === 'accept' && reasonCode !== 'repository_evidence_supports_match') {
    throw new Error(`${location}: accept requires repository_evidence_supports_match`);
  }
  if (verdict !== 'accept' && reasonCode === 'repository_evidence_supports_match') {
    throw new Error(`${location}: non-accept cannot use repository_evidence_supports_match`);
  }
}

function assertGroundedQuote(
  citation: SemanticEvidenceCitation,
  record: IntentRecord,
  decisionId: string,
): void {
  const quote = requiredText(citation.quote, `Decision ${decisionId} evidence.quote`);
  const evidence = [
    record.statement.text,
    record.statement.object,
    ...record.statement.target.paths,
    ...record.statement.target.symbols,
    ...(Array.isArray(record.metadata.capabilities)
      ? record.metadata.capabilities.filter((item): item is string => typeof item === 'string')
      : []),
  ].join('\n').toLowerCase();
  if (!evidence.includes(quote.toLowerCase())) {
    throw new Error(`Decision ${decisionId} quote is not grounded in record ${record.id}`);
  }
}

function boundedScore(value: number): number {
  if (!Number.isFinite(value) || value < -1 || value > 1) {
    throw new Error('Semantic retrieval score must be a finite number between -1 and 1');
  }
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundedConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('Semantic rerank confidence must be a finite number between 0 and 1');
  }
  return Math.round(value * 1_000_000) / 1_000_000;
}

function requiredText(value: string, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be non-blank`);
  return value.trim();
}

function validDate(value: string, name: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO date-time`);
}

function comparePair(
  left: Pick<SemanticCandidateInput, 'declarationRecordId' | 'moduleRecordId'>,
  right: Pick<SemanticCandidateInput, 'declarationRecordId' | 'moduleRecordId'>,
): number {
  return left.declarationRecordId.localeCompare(right.declarationRecordId)
    || left.moduleRecordId.localeCompare(right.moduleRecordId);
}
