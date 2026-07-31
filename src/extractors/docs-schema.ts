import { structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';
import type { DocumentResponse, RawDocumentRecord } from './docs-types.js';

const ACTIONS = [
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
] as const;
const MODALITIES = ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'] as const;
const LIFECYCLES = [
  'proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown',
] as const;
const strings = () => s.array(s.string(), { uniqueItems: true });
const target = () => s.object({ paths: strings(), symbols: strings(), tickets: strings(), versions: strings() });

const documentRecord = s.object({
  kind: s.string({ minLength: 1 }),
  actor: s.nullableString(),
  action: s.enum(ACTIONS),
  subject: s.nullableString(),
  object: s.string({ minLength: 1 }),
  modality: s.enum(MODALITIES),
  polarity: s.enum(['positive', 'negative']),
  lifecycle: s.enum(LIFECYCLES),
  confidence: s.number({ minimum: 0, maximum: 0.85 }),
  basis: strings(),
  target: target(),
  sourceLines: s.object({ start: s.integer({ minimum: 1 }), end: s.integer({ minimum: 1 }) }),
  text: s.string(),
}) satisfies StructuredSchema<RawDocumentRecord>;

export function documentResponseContract(maxRecords: number): StructuredSchema<DocumentResponse> {
  return s.object({
    records: s.array(documentRecord, {
      maxItems: maxRecords,
      description: 'Document-derived statements validated before conversion to t2c.intent/v1.',
    }),
  });
}

/** @deprecated Prefer `documentResponseContract(maxRecords).jsonSchema`. */
export function documentResponseSchema(maxRecords: number): Record<string, unknown> {
  return documentResponseContract(maxRecords).jsonSchema;
}
