import { structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';
import {
  SEMANTIC_RERANK_REASONS,
  SEMANTIC_RERANK_VERDICTS,
  type SemanticRerankDecisionInput,
} from './reranker-types.js';
import { assertSemanticVerdictReason } from './reranker-validate.js';

export interface SemanticRerankerResponse {
  decisions: SemanticRerankDecisionInput[];
}

const CANDIDATE_ID = '^SCAND-[a-f0-9]{20}$';
const RECORD_ID = '^INT-[A-Z]+-[a-f0-9]{20}$';
const RERANK_DECISION_CONTRACT = s.object({
  candidateId: s.string({ pattern: CANDIDATE_ID }),
  verdict: s.enum(SEMANTIC_RERANK_VERDICTS),
  confidence: s.number({ minimum: 0, maximum: 1 }),
  reasonCode: s.enum(SEMANTIC_RERANK_REASONS),
  rationale: s.string({ minLength: 1, pattern: '.*\\S.*' }),
  citedRecordIds: s.array(s.string({ pattern: RECORD_ID }), { minItems: 2, maxItems: 2, uniqueItems: true }),
  evidence: s.array(s.object({
    recordId: s.string({ pattern: RECORD_ID }),
    quote: s.string({ minLength: 1, pattern: '.*\\S.*' }),
  }), { minItems: 2 }),
}) satisfies StructuredSchema<SemanticRerankDecisionInput>;

export const SEMANTIC_RERANK_RESPONSE_CONTRACT = s.object({
  decisions: s.array(RERANK_DECISION_CONTRACT, { maxItems: 100 }),
}) satisfies StructuredSchema<SemanticRerankerResponse>;

export const SEMANTIC_RERANK_RESPONSE_SCHEMA = SEMANTIC_RERANK_RESPONSE_CONTRACT.jsonSchema;

export function assertSemanticRerankerResponse(value: unknown): asserts value is SemanticRerankerResponse {
  const response = SEMANTIC_RERANK_RESPONSE_CONTRACT.parse(value);
  response.decisions.forEach((decision, index) => {
    // This relationship is semantic, not structural JSON Schema: accepting a
    // candidate with a rejection reason would remain invalid even though both
    // individual enum values are well formed.
    assertSemanticVerdictReason(decision.verdict, decision.reasonCode, `response.decisions[${index}]`);
  });
}
