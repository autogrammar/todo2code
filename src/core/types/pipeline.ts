import type { IntentRecord, JsonValue } from './intent.js';

export interface ExtractionResult {
  records: IntentRecord[];
  warnings: string[];
}

export interface ContentCacheStats {
  hits: number;
  misses: number;
  writes: number;
  recoveries: number;
  errors: number;
  bypassed: number;
}

export interface CachedExtractionResult extends ExtractionResult {
  cache: ContentCacheStats;
}

export type LlmExtractionMode = 'deterministic' | 'prefer-llm' | 'require-llm';
export type NlExtractionMode = LlmExtractionMode;

export type PipelineStageStatus = 'succeeded' | 'partial' | 'fallback' | 'failed' | 'skipped';
export type PipelineFailureStage =
  | 'setup'
  | 'naturalLanguageExtraction'
  | 'gitExtraction'
  | 'astExtraction'
  | 'markdownExtraction'
  | 'documentationExtraction'
  | 'configurationExtraction'
  | 'runtimeExtraction'
  | 'communicationAnalysis'
  | 'linking'
  | 'diagnostics'
  | 'taskSynthesis'
  | 'todoRendering'
  | 'codeChangePlanning'
  | 'summary'
  | 'persistence';

export interface LlmResponseMetadata extends Record<string, JsonValue> {
  responseId: string | null;
  model: string | null;
  provider: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    cost: number | null;
  } | null;
}

export interface PipelineStageAudit {
  runtimeVersion: string;
  configuration: Record<string, JsonValue>;
  status: PipelineStageStatus;
  requestedMode: 'deterministic' | 'llm' | 'disabled';
  effectiveMode: 'deterministic' | 'llm' | 'none';
  degraded: boolean;
  recordCount: number;
  warningCount: number;
  model: string | null;
  durationMs: number;
  reason: { code: string; message: string } | null;
  responses: LlmResponseMetadata[];
}

export interface PipelineOptions {
  root: string;
  taskFile: string | null;
  todoFile: string | null;
  changelogFile: string | null;
  documentPatterns: string[];
  includeDocumentationLlm: boolean;
  outputDir: string;
  gitCommitCount: number;
  allowSummaryFallback: boolean;
  includeSummaryLlm?: boolean;
  nlMode?: NlExtractionMode;
  markdownMode?: LlmExtractionMode;
  communicationMode?: LlmExtractionMode;
  documentExcludes?: string[];
  taskSynthesisMode?: 'disabled' | 'prefer-llm' | 'require-llm';
  includeCommunication?: boolean;
  projectDirectory?: string;
  communicationTicket?: string | null;
  /** autonom cycle document; runtime evidence is skipped when absent. */
  cycleFile?: string | null;
}

export interface PipelineManifest {
  schemaVersion: 't2c.run/v1';
  runId: string;
  root: string;
  createdAt: string;
  graphFingerprint: string | null;
  files: Record<string, string>;
  warnings: string[];
  status: 'succeeded' | 'degraded' | 'failed';
  failure: { stage: PipelineFailureStage; code: string; message: string } | null;
  runtime: {
    name: 'todo2code';
    version: string;
  };
  configuration: {
    fingerprint: string;
    nlMode: NlExtractionMode;
    markdownMode: LlmExtractionMode;
    communicationMode: LlmExtractionMode;
    gitCommitCount: number;
    maxFileBytes: number;
    markdownConcurrency: number;
    documentConcurrency: number;
    documentChunkChars: number;
    documentMaxChunks: number;
    documentRecordsPerChunk: number;
    documentTimeoutMs: number;
    summaryLlm: boolean;
    taskSynthesisMode: 'disabled' | 'prefer-llm' | 'require-llm';
    includeCommunication: boolean;
    projectDirectory: string;
    communicationTicket: string | null;
    documentPatterns: string[];
    documentExcludes: string[];
    adapters: {
      python: { enabled: boolean; executable: string };
      go: { enabled: boolean; executable: string };
      java: { enabled: boolean; executable: string };
      rust: { enabled: boolean; executable: string };
      php: { enabled: boolean; executable: string };
      tensorflow: {
        enabled: boolean;
        modelPath: string | null;
        modulePath: string;
        labels: string[];
      };
    };
    llm: {
      configured: boolean;
      baseUrl: string;
      nlModel: string;
      markdownModel: string;
      communicationModel: string;
      documentModel: string;
      summaryModel: string;
      taskModel: string;
      timeoutMs: number;
      maxTokens: number;
      temperature: number;
      requireStructuredOutput: boolean;
      responseHealing: boolean;
    };
  };
  stages: {
    naturalLanguageExtraction: PipelineStageAudit;
    markdownExtraction: PipelineStageAudit;
    documentationExtraction: PipelineStageAudit;
    communicationAnalysis: PipelineStageAudit;
    taskSynthesis: PipelineStageAudit;
    codeChangePlanning: PipelineStageAudit;
    summary: PipelineStageAudit;
  };
  llm: {
    naturalLanguageExtraction: boolean;
    markdownExtraction: boolean;
    communicationEnrichment: boolean;
    documentationExtraction: boolean;
    taskSynthesis: boolean;
    summary: boolean;
  };
}
