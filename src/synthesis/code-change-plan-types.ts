import type {
  CodeChangeAcceptance,
  CodeChangeCloseResult,
  CodeChangePlan,
  CodeChangeReviewPatch,
  CodeChangeSourceApplyReceipt,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchApproval,
  CodeChangeSourcePatchSet,
  Conclusion,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  TodoProposal,
} from '../core/types.js';

export { isUsefulCodeChangePath } from './code-change-path.js';

export interface ProposeCodeChangePlansOptions {
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
  conclusions?: Conclusion[];
  proposals?: TodoProposal[];
  generatedAt?: string;
  /** Limit how many plans are materialised from open diagnostics. Default 50. */
  maxPlans?: number;
  /**
   * Repository probe used to tell `create` from `modify`. Injected rather than
   * read here so plan synthesis stays pure and deterministic; when omitted the
   * plan cannot know and keeps the conservative `modify`.
   * See {@link createRepositoryPathProbe}.
   */
  pathExists?: (relativePath: string) => boolean;
}

export interface ProposeCodeChangePlansResult {
  schemaVersion: 't2c.code-change-plan-set/v1';
  plans: CodeChangePlan[];
  generatedAt: string;
  graphFingerprint: string;
  sourceDiagnosticCount: number;
  generation: GroundedGenerationMetadata;
}

export interface EvaluateCodeChangeAcceptanceOptions {
  plan: CodeChangePlan;
  /** Graph and diagnostics that the plan was grounded on. */
  before: { graph: IntentGraph; diagnostics: DiagnosticReport };
  /** Graph after an attempted implementation (re-extracted and re-linked). */
  afterGraph: IntentGraph;
  /** Optional precomputed after diagnostics; derived when omitted. */
  afterDiagnostics?: DiagnosticReport;
  evaluatedAt?: string;
}

export interface CloseCodeChangesOptions {
  plans: CodeChangePlan[];
  before: { graph: IntentGraph; diagnostics: DiagnosticReport };
  afterGraph: IntentGraph;
  afterDiagnostics?: DiagnosticReport;
  evaluatedAt?: string;
}

export interface CreateCodeChangeReviewOptions {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  createdAt?: string;
}

export interface CreatedCodeChangeReview {
  markdown: string;
  artifact: CodeChangeReviewPatch;
}

export interface CreateCodeChangeSourcePatchOptions {
  plan: CodeChangePlan;
  /** Optional per-path unified diffs keyed by relative repository path. */
  unifiedDiffs?: Record<string, string>;
  createdAt?: string;
}

export interface ApplyCodeChangeSourcePatchOptions {
  root: string;
  patch: CodeChangeSourcePatch;
  approval: CodeChangeSourcePatchApproval;
  receiptPath: string;
  now?: Date;
}

export interface ApplyCodeChangeSourcePatchResult {
  applied: boolean;
  idempotent: boolean;
  receipt: CodeChangeSourceApplyReceipt;
}
