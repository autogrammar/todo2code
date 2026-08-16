import type { IntentAction } from '../core/types.js';
import { structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';
import type {
  RawCommunicationEnrichment,
  RawCommunicationResponse,
  RawParticipantSynthesis,
} from './communication-llm-types.js';

const ACTIONS = [
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
] as const satisfies readonly IntentAction[];

const communicationStrings = () => s.array(s.string());

const COMMUNICATION_ENRICHMENT_CONTRACT = s.object({
  recordId: s.string(),
  action: s.enum(ACTIONS),
  object: s.string(),
  polarity: s.enum(['positive', 'negative']),
  confidence: s.number({ minimum: 0, maximum: 0.85 }),
  basis: communicationStrings(),
  target: s.object({ paths: communicationStrings(), symbols: communicationStrings(), versions: communicationStrings() }),
  topics: communicationStrings(),
}) satisfies StructuredSchema<RawCommunicationEnrichment>;

const PARTICIPANT_SYNTHESIS_CONTRACT = s.object({
  participantKey: s.string(),
  summary: s.string({ minLength: 1, pattern: '.*\\S.*' }),
  commitments: communicationStrings(),
  risks: communicationStrings(),
  recordIds: communicationStrings(),
  confidence: s.number({ minimum: 0, maximum: 0.85 }),
}) satisfies StructuredSchema<RawParticipantSynthesis>;

export const COMMUNICATION_RESPONSE_CONTRACT = s.object({
  enrichments: s.array(COMMUNICATION_ENRICHMENT_CONTRACT),
  participantSyntheses: s.array(PARTICIPANT_SYNTHESIS_CONTRACT),
}) satisfies StructuredSchema<RawCommunicationResponse>;
