import type { analyzeCommunication } from '../communication/analyzer.js';
import type { ParticipantCommunicationSynthesis } from '../communication/llm.js';
import type {
  DiagnosticReport,
  PipelineManifest,
  PipelineStageAudit,
} from '../core/types.js';
import type { linkIntentRecords } from '../graph/linker.js';
import type { summarizeGraph } from '../summary/summarizer.js';
import type {
  createCodeChangeReviewPatch,
  createCodeChangeSourcePatchSet,
  proposeCodeChangePlans,
} from '../synthesis/code-change-plan.js';
import type { AuditedTaskSynthesisResult } from '../synthesis/tasks-llm.js';
import type { CreatedTodoPatch } from '../synthesis/todo-patch.js';

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

export type IntentGraphResult = ReturnType<typeof linkIntentRecords>;
export type CommunicationAnalysisResult = ReturnType<typeof analyzeCommunication>;
export type CodeChangePlansResult = ReturnType<typeof proposeCodeChangePlans>;
export type CodeChangeReviewResult = ReturnType<typeof createCodeChangeReviewPatch>;
export type CodeChangeSourcePatchesResult = ReturnType<typeof createCodeChangeSourcePatchSet>;
export type SummaryResult = Awaited<ReturnType<typeof summarizeGraph>>;

export interface ExtractionResult {
  naturalLanguageAudit: PipelineStageAudit;
  markdownAudit: PipelineStageAudit;
  documentationAudit: PipelineStageAudit;
  communicationAudit: PipelineStageAudit;
  communicationInputPresent: boolean;
  communicationSyntheses: ParticipantCommunicationSynthesis[];
}

export interface AnalysisResult {
  generatedAt: string;
  graph: IntentGraphResult;
  diagnostics: DiagnosticReport;
  communicationAnalysis: CommunicationAnalysisResult | null;
}

export interface SynthesisResult {
  taskSynthesis: AuditedTaskSynthesisResult | null;
  todoPatch: CreatedTodoPatch | null;
  audit: PipelineStageAudit;
}

export interface PlanningResult {
  plans: CodeChangePlansResult;
  review: CodeChangeReviewResult;
  sourcePatches: CodeChangeSourcePatchesResult;
  audit: PipelineStageAudit;
}

export interface PipelineSummaryResult {
  summary: SummaryResult;
  audit: PipelineStageAudit;
}

export interface OutputPaths {
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
  summaryConclusionsPath: string;
  taskSynthesisPath: string | null;
  todoValidationPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
  codeChangePlansPath: string;
  codeChangeReviewPath: string;
  codeChangeReviewAuditPath: string;
  codeChangeSourcePatchesPath: string;
  communicationAnalysisPath: string | null;
  communicationMarkdownPath: string | null;
  eventLogPath: string;
}
