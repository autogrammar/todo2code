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

