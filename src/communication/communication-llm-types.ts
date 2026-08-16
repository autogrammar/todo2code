import type {
  GroundedGenerationMetadata,
  IntentAction,
  IntentRecord,
  PipelineStageAudit,
} from '../core/types.js';
import type { CommunicationRole } from '../extractors/communication.js';

export interface RawCommunicationEnrichment {
  recordId: string;
  action: IntentAction;
  object: string;
  polarity: 'positive' | 'negative';
  confidence: number;
  basis: string[];
  target: { paths: string[]; symbols: string[]; versions: string[] };
  topics: string[];
}

export interface RawParticipantSynthesis {
  participantKey: string;
  summary: string;
  commitments: string[];
  risks: string[];
  recordIds: string[];
  confidence: number;
}

export interface RawCommunicationResponse {
  enrichments: RawCommunicationEnrichment[];
  participantSyntheses: RawParticipantSynthesis[];
}

export interface ParticipantCommunicationSynthesis {
  schemaVersion: 't2c.participant-synthesis/v1';
  id: string;
  participant: string;
  role: CommunicationRole;
  tickets: string[];
  summary: string;
  commitments: string[];
  risks: string[];
  recordIds: string[];
  confidence: number;
  generation: GroundedGenerationMetadata;
}

export interface AuditedCommunicationExtractionResult {
  schemaVersion: 't2c.communication-enrichment/v1';
  records: IntentRecord[];
  participants: ParticipantCommunicationSynthesis[];
  warnings: string[];
  audit: PipelineStageAudit;
}

export class CommunicationLlmRequiredError extends Error {
  constructor(message: string, readonly audit: PipelineStageAudit) {
    super(message);
    this.name = 'CommunicationLlmRequiredError';
  }
}

export interface ParticipantGroup {
  key: string;
  participant: string;
  role: CommunicationRole;
  tickets: string[];
  records: IntentRecord[];
}
