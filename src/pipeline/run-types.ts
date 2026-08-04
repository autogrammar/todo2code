import type {
  DiagnosticReport,
  IntentRecord,
  PipelineFailureStage,
  PipelineManifest,
  PipelineStageAudit,
} from '../core/types.js';
import type { analyzeCommunication } from '../communication/analyzer.js';
import type { summarizeGraph } from '../summary/summarizer.js';
import type { collectCommunicationAnalysis, collectTaskSynthesis, createCodeChangeArtifacts } from './run-helpers.js';
import type { linkIntentRecords } from '../graph/linker.js';

export type PipelineBySource = {
  nl: IntentRecord[];
  git: IntentRecord[];
  ast: IntentRecord[];
  todo: IntentRecord[];
  changelog: IntentRecord[];
  document: IntentRecord[];
  configuration: IntentRecord[];
  runtime: IntentRecord[];
  communication: IntentRecord[];
};

export interface PipelineContext {
  root: string;
  baseOutput: string;
  runDirectory: string;
  runId: string;
  activeStage: PipelineFailureStage;
  warnings: string[];
  bySource: PipelineBySource;
  completedStages: Partial<PipelineManifest['stages']>;
}

export interface PipelineExecutionOutput {
  generatedAt: string;
  bySource: PipelineBySource;
  graph: ReturnType<typeof linkIntentRecords>;
  diagnostics: DiagnosticReport;
  communicationAnalysis: ReturnType<typeof analyzeCommunication> | null;
  communicationSyntheses: ReturnType<typeof collectCommunicationAnalysis>['syntheses'];
  naturalLanguageAudit: PipelineStageAudit;
  markdownAudit: PipelineStageAudit;
  documentationAudit: PipelineStageAudit;
  communicationAudit: PipelineStageAudit;
  taskSynthesisAudit: PipelineStageAudit;
  codeChangePlanningAudit: PipelineStageAudit;
  summary: Awaited<ReturnType<typeof summarizeGraph>>;
  summaryAudit: PipelineStageAudit;
  taskSynthesis: ReturnType<typeof collectTaskSynthesis>['result'];
  todoPatch: ReturnType<typeof collectTaskSynthesis>['patch'];
  codeChangePlans: ReturnType<typeof createCodeChangeArtifacts>['codeChangePlans'];
  codeChangeReview: ReturnType<typeof createCodeChangeArtifacts>['codeChangeReview'];
  codeChangeSourcePatches: ReturnType<typeof createCodeChangeArtifacts>['codeChangeSourcePatches'];
}

export interface PipelinePersistedPaths {
  files: Record<string, string>;
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
  summaryConclusionsPath: string;
  taskSynthesisPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
  codeChangePlansPath: string;
  codeChangeReviewPath: string;
  codeChangeReviewAuditPath: string;
  codeChangeSourcePatchesPath: string;
  communicationAnalysisPath: string | null;
}

export interface PipelineResult {
  runDirectory: string;
  manifest: PipelineManifest;
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
  summaryConclusionsPath: string;
  taskSynthesisPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
  codeChangePlansPath: string | null;
  codeChangeReviewPath: string | null;
  codeChangeReviewAuditPath: string | null;
  codeChangeSourcePatchesPath: string | null;
  communicationAnalysisPath: string | null;
}
