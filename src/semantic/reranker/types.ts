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
