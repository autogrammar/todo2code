import type { IntentRecord } from '../../core/types.js';
import type {
  SemanticRerankDecision,
  SemanticRerankGeneration,
  SemanticRetrievalIdentity,
} from './types.js';

function requiredText(value: string, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be non-blank`);
  }
  return value.trim();
}

export function validateRetrieval(value: SemanticRetrievalIdentity): void {
  requiredText(value.provider, 'retrieval.provider');
  requiredText(value.model, 'retrieval.model');
  requiredText(value.revision, 'retrieval.revision');
  requiredText(value.metric, 'retrieval.metric');
  if (!/^[a-f0-9]{64}$/.test(value.inputHash)) {
    throw new Error('retrieval.inputHash must be SHA-256');
  }
}

export function validateGeneration(value: SemanticRerankGeneration): void {
  if (value.generator !== 't2c/cross-language-reranker' || value.generatorVersion !== '1') {
    throw new Error('Unsupported semantic reranker generator');
  }
  requiredText(value.runtimeVersion, 'generation.runtimeVersion');
  requiredText(value.provider, 'generation.provider');
  requiredText(value.requestedModel, 'generation.requestedModel');
  requiredText(value.model, 'generation.model');
  requiredText(value.modelRevision, 'generation.modelRevision');
  if (value.responseId !== null) {
    requiredText(value.responseId, 'generation.responseId');
  }
  if (!/^[a-f0-9]{64}$/.test(value.promptHash)) {
    throw new Error('generation.promptHash must be SHA-256');
  }
}

export function validateVerdictReason(decision: SemanticRerankDecision): void {
  const allowedVerdicts = new Set(['accept', 'reject', 'abstain']);
  if (!allowedVerdicts.has(decision.verdict)) {
    throw new Error(`Decision ${decision.id} has invalid verdict`);
  }

  const allowedReasons = new Set([
    'repository_evidence_supports_match',
    'wrong_target',
    'contradicted',
    'insufficient_evidence',
    'ambiguous',
    'multi_module',
  ]);
  if (!allowedReasons.has(decision.reasonCode)) {
    throw new Error(`Decision ${decision.id} has invalid reasonCode`);
  }

  if (decision.verdict === 'accept' && decision.reasonCode !== 'repository_evidence_supports_match') {
    throw new Error(`Decision ${decision.id}: accept requires repository_evidence_supports_match`);
  }
  if (decision.verdict !== 'accept' && decision.reasonCode === 'repository_evidence_supports_match') {
    throw new Error(`Decision ${decision.id}: non-accept cannot use repository_evidence_supports_match`);
  }
}

export function assertGroundedQuote(
  citation: {
    recordId: string;
    quote: string;
  },
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

export function validDate(value: string, name: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be an ISO date-time`);
  }
}

export function boundedScore(value: number): number {
  if (!Number.isFinite(value) || value < -1 || value > 1) {
    throw new Error('Semantic retrieval score must be a finite number between -1 and 1');
  }
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function roundedConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('Semantic rerank confidence must be a finite number between 0 and 1');
  }
  return Math.round(value * 1_000_000) / 1_000_000;
}

export { requiredText };
