import type {
  ExtractionResult,
  IntentAction,
  IntentRecord,
  LifecycleStatus,
  LlmResponseMetadata,
  Modality,
  PipelineStageAudit,
  Polarity,
} from '../core/types.js';

export interface RawDocumentRecord {
  kind: string;
  actor: string | null;
  action: IntentAction;
  subject: string | null;
  object: string;
  modality: Modality;
  polarity: Polarity;
  lifecycle: LifecycleStatus;
  confidence: number;
  basis: string[];
  target: {
    paths: string[];
    symbols: string[];
    tickets: string[];
    versions: string[];
  };
  sourceLines: { start: number; end: number };
  text: string;
}

export interface DocumentResponse {
  records: RawDocumentRecord[];
}

export interface DocumentChunk {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
}

export interface DocumentationTargetHints {
  paths: string[];
  symbols: string[];
  tickets: string[];
  versions: string[];
}

export interface DocumentationExtractionOptions {
  root: string;
  patterns: string[];
  excludes?: string[];
  targetHints?: DocumentationTargetHints;
}

export interface DocumentationExtractionResult extends ExtractionResult {
  responses: LlmResponseMetadata[];
  audit: PipelineStageAudit;
}

export interface DocumentChunkResult {
  records: IntentRecord[];
  warnings: string[];
  responses: LlmResponseMetadata[];
}
