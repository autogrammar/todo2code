import {
  assertSemanticVerdictReason,
  SEMANTIC_RERANK_REASONS,
  SEMANTIC_RERANK_VERDICTS,
  type SemanticRerankDecisionInput,
} from './reranker.js';

export interface SemanticRerankerResponse {
  decisions: SemanticRerankDecisionInput[];
}

const CANDIDATE_ID = /^SCAND-[a-f0-9]{20}$/;
const RECORD_ID = /^INT-[A-Z]+-[a-f0-9]{20}$/;
const DECISION_KEYS = [
  'candidateId',
  'verdict',
  'confidence',
  'reasonCode',
  'rationale',
  'citedRecordIds',
  'evidence',
] as const;
const EVIDENCE_KEYS = ['recordId', 'quote'] as const;

export const SEMANTIC_RERANK_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['decisions'],
  properties: {
    decisions: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [...DECISION_KEYS],
        properties: {
          candidateId: { type: 'string', pattern: CANDIDATE_ID.source },
          verdict: { type: 'string', enum: [...SEMANTIC_RERANK_VERDICTS] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasonCode: { type: 'string', enum: [...SEMANTIC_RERANK_REASONS] },
          rationale: { type: 'string', minLength: 1, pattern: '.*\\S.*' },
          citedRecordIds: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            uniqueItems: true,
            items: { type: 'string', pattern: RECORD_ID.source },
          },
          evidence: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [...EVIDENCE_KEYS],
              properties: {
                recordId: { type: 'string', pattern: RECORD_ID.source },
                quote: { type: 'string', minLength: 1, pattern: '.*\\S.*' },
              },
            },
          },
        },
      },
    },
  },
};

export function assertSemanticRerankerResponse(value: unknown): asserts value is SemanticRerankerResponse {
  const response = objectAt(value, 'response');
  exactKeys(response, ['decisions'], 'response');
  if (!Array.isArray(response.decisions)) fail('response.decisions', 'must be an array');
  if (response.decisions.length > 100) fail('response.decisions', 'must contain at most 100 items');
  response.decisions.forEach((item, index) => validateDecision(item, `response.decisions[${index}]`));
}

function validateDecision(value: unknown, location: string): void {
  const decision = objectAt(value, location);
  exactKeys(decision, DECISION_KEYS, location);
  stringMatching(decision.candidateId, CANDIDATE_ID, `${location}.candidateId`);
  const verdict = enumValue(decision.verdict, SEMANTIC_RERANK_VERDICTS, `${location}.verdict`);
  if (typeof decision.confidence !== 'number'
    || !Number.isFinite(decision.confidence)
    || decision.confidence < 0
    || decision.confidence > 1) {
    fail(`${location}.confidence`, 'must be a finite JSON number between 0 and 1');
  }
  const reasonCode = enumValue(decision.reasonCode, SEMANTIC_RERANK_REASONS, `${location}.reasonCode`);
  assertSemanticVerdictReason(verdict, reasonCode, location);
  nonBlank(decision.rationale, `${location}.rationale`);
  if (!Array.isArray(decision.citedRecordIds) || decision.citedRecordIds.length !== 2) {
    fail(`${location}.citedRecordIds`, 'must contain exactly two record IDs');
  }
  const cited = decision.citedRecordIds.map((item, index) =>
    stringMatching(item, RECORD_ID, `${location}.citedRecordIds[${index}]`));
  if (new Set(cited).size !== cited.length) fail(`${location}.citedRecordIds`, 'must contain unique record IDs');
  if (!Array.isArray(decision.evidence) || decision.evidence.length < 2) {
    fail(`${location}.evidence`, 'must contain at least two citations');
  }
  decision.evidence.forEach((item, index) => {
    const evidenceLocation = `${location}.evidence[${index}]`;
    const evidence = objectAt(item, evidenceLocation);
    exactKeys(evidence, EVIDENCE_KEYS, evidenceLocation);
    stringMatching(evidence.recordId, RECORD_ID, `${evidenceLocation}.recordId`);
    nonBlank(evidence.quote, `${evidenceLocation}.quote`);
  });
}

function objectAt(value: unknown, location: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(location, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  location: string,
): void {
  const actual = Object.keys(value).sort();
  const allowed = new Set(expected);
  const unknown = actual.filter((key) => !allowed.has(key));
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length) fail(location, `contains unknown properties: ${unknown.join(', ')}`);
  if (missing.length) fail(location, `is missing required properties: ${missing.join(', ')}`);
}

function stringMatching(value: unknown, pattern: RegExp, location: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    fail(location, `must match ${pattern}`);
  }
  return value;
}

function nonBlank(value: unknown, location: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(location, 'must be a non-blank string');
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  location: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(location, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function fail(location: string, detail: string): never {
  throw new Error(`${location} ${detail}`);
}
