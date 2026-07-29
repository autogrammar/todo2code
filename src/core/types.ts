export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SourceKind =
  | 'nl'
  | 'git'
  | 'ast'
  | 'todo'
  | 'changelog'
  | 'document'
  | 'agent_log'
  | 'test'
  | 'system';

export type EpistemicClass =
  | 'declaration'
  | 'plan'
  | 'claim'
  | 'fact'
  | 'inference'
  | 'llm_inference';

export type LifecycleStatus =
  | 'proposed'
  | 'planned'
  | 'in_progress'
  | 'implemented'
  | 'verified'
  | 'released'
  | 'completed'
  | 'blocked'
  | 'unknown';

export type IntentAction =
  | 'add'
  | 'fix'
  | 'remove'
  | 'refactor'
  | 'test'
  | 'document'
  | 'configure'
  | 'analyze'
  | 'validate'
  | 'call'
  | 'depend_on'
  | 'declare'
  | 'release'
  | 'change'
  | 'preserve'
  | 'block'
  | 'approve'
  | 'unknown';

export type Modality = 'required' | 'recommended' | 'optional' | 'observed' | 'claimed' | 'unknown';
export type Polarity = 'positive' | 'negative';

export interface SourceLineRange {
  start: number;
  end: number;
}

export interface IntentTarget {
  paths: string[];
  symbols: string[];
  tickets: string[];
  versions: string[];
}

export interface IntentStatement {
  kind: string;
  actor: string | null;
  action: IntentAction;
  subject: string | null;
  object: string;
  target: IntentTarget;
  modality: Modality;
  polarity: Polarity;
  text: string;
}

export interface IntentSource {
  kind: SourceKind;
  path: string | null;
  lines: SourceLineRange | null;
  revision: string | null;
  symbol: string | null;
  commitIndex: number | null;
  extractor: string;
  contentHash: string;
  rawExcerpt: string | null;
}

export interface IntentEpistemic {
  class: EpistemicClass;
  confidence: number;
  basis: string[];
}

export interface IntentLifecycle {
  status: LifecycleStatus;
}

export interface IntentRecord {
  schemaVersion: 't2c.intent/v1';
  id: string;
  statement: IntentStatement;
  lifecycle: IntentLifecycle;
  source: IntentSource;
  epistemic: IntentEpistemic;
  observedAt: string | null;
  metadata: Record<string, JsonValue>;
}

export type RelationType =
  | 'declares'
  | 'plans'
  | 'implements'
  | 'modifies'
  | 'tests'
  | 'documents'
  | 'releases'
  | 'depends_on'
  | 'blocks'
  | 'supersedes'
  | 'contradicts'
  | 'duplicates'
  | 'evidenced_by'
  | 'claimed_by'
  | 'same_as'
  | 'related_to';

export interface IntentRelation {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  confidence: number;
  basis: string[];
}

export interface IntentGraph {
  schemaVersion: 't2c.graph/v1';
  generatedAt: string;
  fingerprint: string;
  records: IntentRecord[];
  relations: IntentRelation[];
  stats: {
    bySource: Record<string, number>;
    byAction: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export interface IntentRecordChange {
  identity: string;
  before: IntentRecord;
  after: IntentRecord;
  changedFields: string[];
}

export interface IntentGraphDiff {
  schemaVersion: 't2c.diff/v1';
  generatedAt: string;
  fingerprint: string;
  beforeFingerprint: string;
  afterFingerprint: string;
  records: {
    added: IntentRecord[];
    removed: IntentRecord[];
    changed: IntentRecordChange[];
    unchanged: number;
  };
  relations: {
    added: IntentRelation[];
    removed: IntentRelation[];
    unchanged: number;
  };
  summary: {
    recordsAdded: number;
    recordsRemoved: number;
    recordsChanged: number;
    recordsUnchanged: number;
    relationsAdded: number;
    relationsRemoved: number;
    relationsUnchanged: number;
  };
}

export type DiagnosticCode =
  | 'ALIGNED'
  | 'PLANNED_NOT_IMPLEMENTED'
  | 'IMPLEMENTED_NOT_PLANNED'
  | 'IMPLEMENTED_NOT_DOCUMENTED'
  | 'CHANGELOG_WITHOUT_IMPLEMENTATION'
  | 'CONFLICTING_INTENT'
  | 'AMBIGUOUS_REQUIREMENT'
  | 'UNLINKED_RECORD'
  | 'LOW_CONFIDENCE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'LLM_NOT_CONFIGURED'
  | 'SOURCE_UNAVAILABLE';

export type DiagnosticSeverity = 'info' | 'warning' | 'review_required' | 'blocking';

export interface Diagnostic {
  id: string;
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
  recordIds: string[];
  suggestedAction: string;
}

export interface DiagnosticReport {
  schemaVersion: 't2c.diagnostics/v1';
  generatedAt: string;
  graphFingerprint: string;
  diagnostics: Diagnostic[];
  counts: Record<DiagnosticSeverity, number>;
}

export type ConclusionKind = 'finding' | 'risk' | 'decision' | 'recommendation';
export type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface GroundedGenerationMetadata {
  runtimeVersion: string;
  generatedAt: string;
  requestedMode: 'deterministic' | 'prefer-llm' | 'require-llm';
  effectiveMode: 'deterministic' | 'llm';
  degraded: boolean;
  model: string | null;
  provider: string | null;
  responseId: string | null;
  configurationFingerprint: string;
  reason: string | null;
}

export interface Conclusion {
  schemaVersion: 't2c.conclusion/v1';
  id: string;
  kind: ConclusionKind;
  title: string;
  detail: string;
  severity: DiagnosticSeverity;
  diagnosticIds: string[];
  recordIds: string[];
  confidence: number;
  generation: GroundedGenerationMetadata;
}

export interface TodoProposal {
  schemaVersion: 't2c.todo-proposal/v1';
  id: string;
  title: string;
  description: string;
  priority: TodoPriority;
  status: 'proposed';
  target: IntentTarget;
  acceptanceCriteria: string[];
  dependencies: string[];
  conclusionIds: string[];
  diagnosticIds: string[];
  recordIds: string[];
  confidence: number;
  generation: GroundedGenerationMetadata;
}

export interface ExtractionResult {
  records: IntentRecord[];
  warnings: string[];
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
  | 'linking'
  | 'diagnostics'
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
  documentExcludes?: string[];
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
    gitCommitCount: number;
    maxFileBytes: number;
    documentConcurrency: number;
    documentChunkChars: number;
    documentMaxChunks: number;
    documentRecordsPerChunk: number;
    documentTimeoutMs: number;
    summaryLlm: boolean;
    documentPatterns: string[];
    documentExcludes: string[];
    adapters: {
      python: { enabled: boolean; executable: string };
      go: { enabled: boolean; executable: string };
      java: { enabled: boolean; executable: string };
      rust: { enabled: boolean; executable: string };
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
      documentModel: string;
      summaryModel: string;
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
    summary: PipelineStageAudit;
  };
  llm: {
    naturalLanguageExtraction: boolean;
    markdownExtraction: boolean;
    documentationExtraction: boolean;
    summary: boolean;
  };
}
