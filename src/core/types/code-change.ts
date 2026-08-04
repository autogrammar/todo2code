import type { IntentTarget } from './intent.js';
import type { ConclusionKind, DiagnosticSeverity, TodoPriority } from './diagnostics.js';
import type { PipelineStageAudit } from './pipeline.js';

export interface GroundedGenerationMetadata {
  generator: string;
  generatorVersion: string;
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

/**
 * Grounded proposal to change source files so that a plan/diagnostic can be
 * closed by later re-analysis. Status is always `proposed`: the runtime never
 * applies a code change and never marks work DONE from this contract alone.
 */
export type CodeChangeFileAction = 'create' | 'modify' | 'delete';

export interface CodeChangeFile {
  path: string;
  action: CodeChangeFileAction;
  symbols: string[];
  rationale: string;
}

export type CodeChangeRiskLevel = 'low' | 'medium' | 'high';

export interface CodeChangeRisk {
  level: CodeChangeRiskLevel;
  reasons: string[];
}

export interface CodeChangePlan {
  schemaVersion: 't2c.code-change-plan/v1';
  id: string;
  planHash: string;
  status: 'proposed';
  createdAt: string;
  title: string;
  description: string;
  priority: TodoPriority;
  target: IntentTarget;
  acceptanceCriteria: string[];
  changes: CodeChangeFile[];
  risk: CodeChangeRisk;
  rollback: string;
  evidence: {
    graphFingerprint: string;
    recordIds: string[];
    diagnosticIds: string[];
    conclusionIds: string[];
    proposalIds: string[];
  };
  confidence: number;
  generation: GroundedGenerationMetadata;
}

/**
 * Result of re-diagnosing a graph after an attempted implementation.
 * Acceptance requires every cited diagnostic to clear and no new blocking
 * diagnostics to appear. Remaining non-targeted warnings do not fail the gate.
 */
export interface CodeChangeAcceptance {
  schemaVersion: 't2c.code-change-acceptance/v1';
  planId: string;
  planHash: string;
  beforeGraphFingerprint: string;
  afterGraphFingerprint: string;
  beforeDiagnosticIds: string[];
  afterDiagnosticIds: string[];
  clearedDiagnosticIds: string[];
  remainingDiagnosticIds: string[];
  newBlockingDiagnosticIds: string[];
  accepted: boolean;
  reasons: string[];
  evaluatedAt: string;
  generation: GroundedGenerationMetadata;
}

/** Aggregate, non-authoritative result for closing one or more code-change plans. */
export interface CodeChangeCloseResult {
  schemaVersion: 't2c.code-change-close-result/v1';
  evaluatedAt: string;
  graphFingerprintBefore: string;
  graphFingerprintAfter: string;
  planCount: number;
  acceptedCount: number;
  rejectedCount: number;
  allAccepted: boolean;
  acceptances: CodeChangeAcceptance[];
  generation: GroundedGenerationMetadata;
}

/**
 * Reviewable, non-executable projection of code-change plans.
 * Carries a content hash of the Markdown so reviewers can detect tampering.
 * The runtime never applies this artifact to source files.
 */
export interface CodeChangeReviewPatch {
  schemaVersion: 't2c.code-change-review/v1';
  createdAt: string;
  graphFingerprint: string;
  planIds: string[];
  planHashes: string[];
  renderedPatchHash: string;
  generation: GroundedGenerationMetadata;
}

/**
 * Structured source-edit proposal bound to one code-change plan.
 * Instructions (and optional unified diffs) may only name paths declared by the
 * plan. Application requires an explicit approval hash and never runs by default.
 */
export interface CodeChangeSourceEdit {
  path: string;
  action: CodeChangeFileAction;
  symbols: string[];
  instruction: string;
  /**
   * Optional unified diff body for the single file. Null for instruction-only
   * deterministic proposals. When set, the runtime checks path headers and
   * rejects parent traversal / absolute host paths. Apply requires a non-null
   * diff for every edit.
   */
  unifiedDiff: string | null;
}

export interface CodeChangeSourcePatch {
  schemaVersion: 't2c.code-change-source-patch/v1';
  id: string;
  patchHash: string;
  status: 'proposed';
  createdAt: string;
  planId: string;
  planHash: string;
  graphFingerprint: string;
  diagnosticIds: string[];
  recordIds: string[];
  edits: CodeChangeSourceEdit[];
  acceptanceCriteria: string[];
  generation: GroundedGenerationMetadata;
}

export interface CodeChangeSourcePatchSet {
  schemaVersion: 't2c.code-change-source-patch-set/v1';
  generatedAt: string;
  graphFingerprint: string;
  patches: CodeChangeSourcePatch[];
  generation: GroundedGenerationMetadata;
}

export interface CodeChangeSourcePatchApproval {
  actor: string;
  patchHash: string;
}

export interface CodeChangeSourceApplyReceipt {
  schemaVersion: 't2c.code-change-source-apply-receipt/v1';
  patchId: string;
  patchHash: string;
  planId: string;
  approvedBy: string;
  approvedAt: string;
  appliedAt: string;
  appliedPaths: string[];
  fileHashesAfter: Record<string, string>;
  generation: GroundedGenerationMetadata;
}

export interface TodoPatchDuplicateClassification {
  proposalId: string;
  existingRecordIds: string[];
  basis: string[];
}

export interface TodoPatchArtifact {
  schemaVersion: 't2c.todo-patch/v1';
  createdAt: string;
  sourceTodo: {
    path: string;
    contentHash: string;
  };
  graphFingerprint: string;
