import path from 'node:path';

import { DocumentationLlmRequiredError, MarkdownLlmRequiredError } from '../extractors/docs-llm.js';
import { NlLlmRequiredError } from '../extractors/nl-llm.js';
import { CommunicationLlmRequiredError } from '../communication/llm.js';
import { TaskSynthesisRequiredError } from '../synthesis/tasks-llm.js';
import { T2C_VERSION } from '../version.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { writeJson } from '../core/io.js';
import type { PipelineManifest, PipelineFailureStage, PipelineOptions, PipelineStageAudit } from '../core/types.js';
import type { T2CConfig } from '../config/env.js';
import type { PipelineContext } from './run-types.js';
import { manifestConfiguration } from './run-persistence.js';

type PipelineManifestStage = keyof PipelineManifest['stages'];

const abortStageLabels: Record<PipelineManifestStage, string> = {
  naturalLanguageExtraction: 'natural-language extraction',
  markdownExtraction: 'Markdown extraction',
  documentationExtraction: 'documentation extraction',
  communicationAnalysis: 'communication analysis',
  taskSynthesis: 'task synthesis',
  codeChangePlanning: 'code-change planning',
  summary: 'summary generation',
};

function isLlMFailureStage(stage: PipelineManifestStage): boolean {
  return stage === 'summary' || stage === 'taskSynthesis';
}

function failureModelForStage(config: T2CConfig, stage: PipelineManifestStage): string | null {
  if (stage === 'summary') return config.openRouter.summaryModel;
  if (stage === 'taskSynthesis') return config.openRouter.taskModel;
  return null;
}

export async function persistFailedRun(
  context: PipelineContext,
  error: unknown,
  options: PipelineOptions,
  config: T2CConfig,
): Promise<void> {
  await persistFailedRunState(
    context.runId,
    context.root,
    context.runDirectory,
    options,
    config,
    error,
    context.activeStage,
    context.completedStages,
  );
}

export function persistFailedRunState(
  runId: string,
  root: string,
  runDirectory: string,
  options: PipelineOptions,
  config: T2CConfig,
  error: unknown,
  failedStage: PipelineFailureStage,
  completedStages: Partial<PipelineManifest['stages']>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const knownAudit = error instanceof NlLlmRequiredError
    || error instanceof MarkdownLlmRequiredError
    || error instanceof DocumentationLlmRequiredError
    || error instanceof CommunicationLlmRequiredError
    || error instanceof TaskSynthesisRequiredError
    ? error.audit
    : null;
  const stageFailureCode = failureCode(failedStage);
  const manifestFailureReason = knownAudit?.reason ?? { code: stageFailureCode, message };
  const failureStatus = failureAuditForStage.bind(null, message, knownAudit, stageFailureCode, config);
  const stageValue = makeStageValue.bind(null, failureStatus, completedStages, failedStage);
  const stages: PipelineManifest['stages'] = {
    naturalLanguageExtraction: stageValue('naturalLanguageExtraction'),
    markdownExtraction: stageValue('markdownExtraction'),
    documentationExtraction: stageValue('documentationExtraction'),
    communicationAnalysis: stageValue('communicationAnalysis'),
    taskSynthesis: stageValue('taskSynthesis'),
    codeChangePlanning: stageValue('codeChangePlanning'),
    summary: stageValue('summary'),
  };
  const reason = manifestFailureReason;
  const manifest: PipelineManifest = {
    schemaVersion: 't2c.run/v1',
    runId,
    root,
    createdAt: new Date().toISOString(),
    graphFingerprint: null,
    files: {},
    warnings: [message],
    status: 'failed',
    failure: { stage: failedStage, code: reason.code, message: reason.message },
    runtime: { name: 'todo2code', version: T2C_VERSION },
    configuration: manifestConfiguration(options, config),
    stages,
    llm: {
      naturalLanguageExtraction: stages.naturalLanguageExtraction.effectiveMode === 'llm',
      markdownExtraction: stages.markdownExtraction.effectiveMode === 'llm',
      communicationEnrichment: stages.communicationAnalysis.effectiveMode === 'llm',
      documentationExtraction: false,
      taskSynthesis: false,
      summary: false,
    },
  };
  return writeJson(path.join(runDirectory, 'manifest.json'), manifest);
}

function failureCode(stage: PipelineFailureStage): string {
  return `PIPELINE_${stage.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_FAILED`;
}

function failureAuditForStage(
  message: string,
  knownAudit: PipelineStageAudit | null,
  stageFailureCode: string,
  config: T2CConfig,
  stage: PipelineManifestStage,
  failedStage: PipelineFailureStage,
): PipelineStageAudit {
  if (knownAudit && stage === failedStage) return knownAudit;
  return {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(config, isLlMFailureStage(stage) ? failureModelForStage(config, stage) : null),
    status: 'failed',
    requestedMode: isLlMFailureStage(stage) ? 'llm' : 'disabled',
    effectiveMode: 'none',
    degraded: true,
    recordCount: 0,
    warningCount: 1,
    model: failureModelForStage(config, stage),
    durationMs: 0,
    reason: { code: stageFailureCode, message },
    responses: [],
  };
}

function makeStageValue(
  failureStatus: (
    stage: PipelineManifestStage,
    failedStage: PipelineFailureStage,
  ) => PipelineStageAudit,
  completedStages: Partial<PipelineManifest['stages']>,
  failedStage: PipelineFailureStage,
  stage: PipelineManifestStage,
): PipelineStageAudit {
  if (completedStages[stage]) return completedStages[stage]!;
  if (stage === failedStage) return failureStatus(stage, failedStage);
  return {
    ...skippedAudit('disabled', `Pipeline aborted before ${abortStageLabels[stage]}`),
    reason: { code: 'PIPELINE_ABORTED', message: `Pipeline aborted before ${abortStageLabels[stage]}` },
  };
}

export function skippedAudit(requestedMode: PipelineStageAudit['requestedMode'], message: string): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: {},
    status: 'skipped', requestedMode, effectiveMode: 'none', degraded: false,
    recordCount: 0, warningCount: 0, model: null, durationMs: 0,
    reason: { code: 'STAGE_SKIPPED', message },
    responses: [],
  };
}
