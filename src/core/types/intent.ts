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

export type IntentGenerationMode = 'deterministic' | 'llm';

/**
 * Runtime-owned provenance of the conversion that materialized one DSL record.
 * This is required even for deterministic records: `source` identifies the
 * evidence, while `generation` identifies the software or model that converted
 * that evidence to Intent DSL.
 */
export interface IntentGenerationMetadata extends Record<string, JsonValue> {
  generator: string;
  generatorVersion: string;
  runtimeVersion: string;
  requested: IntentGenerationMode;
  used: IntentGenerationMode;
  degraded: boolean;
  fallbackReason: string | null;
  provider: string | null;
  model: string | null;
  responseId: string | null;
}

export interface IntentRecordMetadata extends Record<string, JsonValue> {
  generation: IntentGenerationMetadata;
}

export interface IntentRecord {
  schemaVersion: 't2c.intent/v1';
  id: string;
  statement: IntentStatement;
  lifecycle: IntentLifecycle;
  source: IntentSource;
  epistemic: IntentEpistemic;
  observedAt: string | null;
  metadata: IntentRecordMetadata;
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
  | 'SOURCE_UNAVAILABLE'
  | 'PARTICIPANT_IDENTITY_UNRESOLVED'
  | 'HUMAN_COMMUNICATION_CONFLICT'
  | 'AGENT_COMMUNICATION_CONFLICT'
  | 'HUMAN_AGENT_CONFLICT'
  | 'REQUEST_WITHOUT_AGENT_RESPONSE'
  | 'AGENT_HUMAN_DECISION_CLAIM_UNCONFIRMED'
  | 'AGENT_CLAIM_WITHOUT_EVIDENCE'
  | 'AGENT_WORK_OUTSIDE_REQUEST';

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

