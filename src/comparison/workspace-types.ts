import type { DiagnosticReport } from '../core/types.js';
import type { diffIntentGraphs } from '../graph/diff.js';
import type { LlmExtractionMode } from '../core/types.js';

export interface WorkspaceComparisonDeadlineLoad {
  inputBytes: number;
  llmWorkUnits: number;
}

export interface WorkspaceComparisonDeadlineDecision extends WorkspaceComparisonDeadlineLoad {
  baseDeadlineMs: number;
  pressure: number;
  multiplier: number;
  effectiveDeadlineMs: number;
  capped: boolean;
}

export interface WorkspaceComparisonOptions {
  root: string;
  baseRef?: string;
  taskFile?: string | null;
  todoFile?: string | null;
  changelogFile?: string | null;
  documentPatterns?: string[];
  documentExcludes?: string[];
  includeDocumentationLlm?: boolean;
  markdownMode?: LlmExtractionMode;
  communicationMode?: LlmExtractionMode;
  outputDir?: string;
  gitCommitCount?: number;
}

export interface CoverageSnapshot {
  topics: number;
  aligned: number;
  gaps: number;
  alignmentRate: number;
  declaredRecords: number;
  observedRecords: number;
  declaredTopics: number;
  observedTopics: number;
  implementationAlignedTopics: number;
  implementationCoverage: number;
  plannedCodeCoverage: number;
  documentedCodeCoverage: number;
  /** False when neither side ran documentation extraction; see `IntentRealityView`. */
  documentationMeasured: boolean;
  byStatus: Record<string, number>;
  diagnostics: DiagnosticReport['counts'];
}

export interface WorkspaceComparison {
  schemaVersion: 't2c.workspace-comparison/v1';
  generatedAt: string;
  base: { ref: string; commit: string; graphFingerprint: string; coverage: CoverageSnapshot };
  workspace: {
    headCommit: string;
    dirty: boolean;
    changedFiles: string[];
    ahead: number;
    behind: number;
    graphFingerprint: string;
    coverage: CoverageSnapshot;
  };
  trend: {
    direction: 'improved' | 'regressed' | 'mixed' | 'unchanged';
    alignmentRateDelta: number;
    implementationCoverageDelta: number;
    plannedCodeCoverageDelta: number;
    documentedCodeCoverageDelta: number;
    alignedDelta: number;
    gapsDelta: number;
    diagnosticsDelta: DiagnosticReport['counts'];
  };
  diff: ReturnType<typeof diffIntentGraphs>;
  artifacts: Record<string, string>;
}
