import path from 'node:path';
import { writeJson } from '../core/io.js';
import type { T2CConfig } from '../config/env.js';
import type { PipelineOptions } from '../core/types.js';
import { type PipelineResult } from './run-types.js';
import {
  makePipelineManifest,
  persistPipelineArtifacts,
} from './run-persistence.js';
import { persistFailedRun } from './run-failed.js';
import { executePipeline, initializePipelineContext } from './run-execution.js';

export type {
  PipelineBySource,
  PipelineContext,
  PipelineExecutionOutput,
  PipelinePersistedPaths,
  PipelineResult,
} from './run-types.js';

export async function runPipeline(options: PipelineOptions, config: T2CConfig): Promise<PipelineResult> {
  const context = await initializePipelineContext(options);
  try {
    const execution = await executePipeline(context, options, config);
    context.activeStage = 'persistence';
    const persisted = await persistPipelineArtifacts(context, execution);
    const stageAudits = {
      naturalLanguageExtraction: execution.naturalLanguageAudit,
      markdownExtraction: execution.markdownAudit,
      documentationExtraction: execution.documentationAudit,
      communicationAnalysis: execution.communicationAudit,
      taskSynthesis: execution.taskSynthesisAudit,
      codeChangePlanning: execution.codeChangePlanningAudit,
      summary: execution.summaryAudit,
    };
    const manifest = makePipelineManifest(context, options, config, execution, persisted.files, stageAudits);
    const manifestPath = path.join(context.runDirectory, 'manifest.json');
    await writeJson(manifestPath, manifest);
    await writeJson(path.join(context.baseOutput, 'latest.json'), {
      runId: context.runId,
      runDirectory: path.relative(context.root, context.runDirectory).replace(/\\/g, '/'),
      graphFingerprint: execution.graph.fingerprint,
      summary: persisted.files.summary,
      summaryConclusions: persisted.files.summaryConclusions,
    });
    return {
      runDirectory: context.runDirectory,
      manifest,
      graphPath: persisted.graphPath,
      diagnosticsPath: persisted.diagnosticsPath,
      summaryPath: persisted.summaryPath,
      summaryConclusionsPath: persisted.summaryConclusionsPath,
      taskSynthesisPath: persisted.taskSynthesisPath,
      todoPatchPath: persisted.todoPatchPath,
      todoPatchAuditPath: persisted.todoPatchAuditPath,
      codeChangePlansPath: persisted.codeChangePlansPath,
      codeChangeReviewPath: persisted.codeChangeReviewPath,
      codeChangeReviewAuditPath: persisted.codeChangeReviewAuditPath,
      codeChangeSourcePatchesPath: persisted.codeChangeSourcePatchesPath,
      communicationAnalysisPath: persisted.communicationAnalysisPath,
    };
  } catch (error) {
    await persistFailedRun(context, error, options, config);
    throw error;
  }
}
