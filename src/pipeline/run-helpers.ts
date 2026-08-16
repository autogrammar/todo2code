import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { hasOpenRouter } from '../config/env.js';
import { CommunicationLlmRequiredError } from '../communication/llm.js';
import { createIntentId, sha256, stableStringify } from '../core/id.js';
import { writeJson } from '../core/io.js';
import type {
  Diagnostic,
  DiagnosticReport,
  IntentRecord,
  PipelineFailureStage,
  PipelineManifest,
  PipelineOptions,
  PipelineStageAudit,
} from '../core/types.js';
import { DocumentationLlmRequiredError } from '../extractors/docs-llm.js';
import { MarkdownLlmRequiredError } from '../extractors/markdown-llm.js';
import { NlLlmRequiredError } from '../extractors/nl-llm.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { TaskSynthesisRequiredError } from '../synthesis/tasks-llm.js';
import { T2C_VERSION } from '../version.js';
import { persistPipelineEventLog } from './event-log-persistence.js';

export function manifestConfiguration(options: PipelineOptions, config: T2CConfig): PipelineManifest['configuration'] {
  const configuration = {
    nlMode: options.nlMode ?? config.nlMode,
    markdownMode: options.markdownMode ?? config.markdownMode,
    communicationMode: options.communicationMode ?? config.communicationMode,
    gitCommitCount: options.gitCommitCount,
    maxFileBytes: config.maxFileBytes,
    markdownConcurrency: config.markdownConcurrency,
    documentConcurrency: config.documentConcurrency,
    documentChunkChars: config.documentChunkChars,
    documentMaxChunks: config.documentMaxChunks,
    documentRecordsPerChunk: config.documentRecordsPerChunk,
    documentTimeoutMs: config.documentTimeoutMs,
    summaryLlm: options.includeSummaryLlm !== false,
    taskSynthesisMode: options.taskSynthesisMode ?? 'disabled',
    includeCommunication: options.includeCommunication !== false,
    projectDirectory: options.projectDirectory ?? 'project',
    communicationTicket: options.communicationTicket ?? null,
    documentPatterns: [...options.documentPatterns],
    documentExcludes: [...(options.documentExcludes ?? config.documentExcludes)],
    adapters: {
      python: { enabled: config.enablePythonAst, executable: config.pythonExecutable },
      go: { enabled: config.enableGoAst, executable: config.goExecutable },
      java: { enabled: config.enableJavaAst, executable: config.javaExecutable },
      rust: { enabled: config.enableRustAst, executable: config.cargoExecutable },
      php: { enabled: config.enablePhpAst, executable: config.phpExecutable },
      tensorflow: {
        enabled: config.enableTensorFlow,
        modelPath: config.tensorflowModelPath,
        modulePath: config.tensorflowModulePath,
        labels: [...config.tensorflowLabels],
      },
    },
    llm: {
      configured: hasOpenRouter(config),
      baseUrl: config.openRouter.baseUrl,
      nlModel: config.openRouter.nlModel,
      markdownModel: config.openRouter.markdownModel,
      communicationModel: config.openRouter.communicationModel,
      documentModel: config.openRouter.documentModel,
      summaryModel: config.openRouter.summaryModel,
      taskModel: config.openRouter.taskModel,
      timeoutMs: config.openRouter.timeoutMs,
      maxTokens: config.openRouter.maxTokens,
      temperature: config.openRouter.temperature,
      requireStructuredOutput: config.openRouter.requireStructuredOutput,
      responseHealing: config.openRouter.responseHealing,
    },
  };
  return { fingerprint: sha256(stableStringify(configuration)), ...configuration };
}

export function collectTargetHints(records: IntentRecord[]): { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] } {
  const values = <K extends keyof IntentRecord['statement']['target']>(key: K): string[] => [
    ...new Set(records.flatMap((record) => record.statement.target[key])),
  ].slice(0, 200);
  return {
    paths: values('paths'),
    symbols: values('symbols'),
    tickets: values('tickets'),
    versions: values('versions'),
  };
}

export async function persistFailedRun(
  runId: string,
  root: string,
  runDirectory: string,
  options: PipelineOptions,
  config: T2CConfig,
  error: unknown,
  failedStage: PipelineFailureStage,
  completedStages: Partial<PipelineManifest['stages']>,
): Promise<void> {
  const aborted = (stage: string): PipelineStageAudit => ({
    ...skippedAudit('disabled', `Pipeline aborted before ${stage}`),
    reason: { code: 'PIPELINE_ABORTED', message: `Pipeline aborted before ${stage}` },
  });
  const message = error instanceof Error ? error.message : String(error);
  const knownAudit = error instanceof NlLlmRequiredError
    || error instanceof MarkdownLlmRequiredError
    || error instanceof DocumentationLlmRequiredError
    || error instanceof CommunicationLlmRequiredError
    || error instanceof TaskSynthesisRequiredError
    ? error.audit
    : null;
  const failedAudit = (stage: keyof PipelineManifest['stages']): PipelineStageAudit => {
    if (knownAudit && stage === failedStage) return knownAudit;
    return {
      runtimeVersion: T2C_VERSION,
      configuration: openRouterAuditConfiguration(
        config,
        stage === 'summary' ? config.openRouter.summaryModel : stage === 'taskSynthesis' ? config.openRouter.taskModel : null,
      ),
      status: 'failed', requestedMode: stage === 'summary' || stage === 'taskSynthesis' ? 'llm' : 'disabled', effectiveMode: 'none', degraded: true,
      recordCount: 0, warningCount: 1,
      model: stage === 'summary' ? config.openRouter.summaryModel : stage === 'taskSynthesis' ? config.openRouter.taskModel : null,
      durationMs: 0,
      reason: { code: failureCode(failedStage), message },
      responses: [],
    };
  };
  const stageValue = (stage: keyof PipelineManifest['stages'], label: string): PipelineStageAudit => {
    if (completedStages[stage]) return completedStages[stage];
    if (stage === failedStage) return failedAudit(stage);
    return aborted(label);
  };
  const stages: PipelineManifest['stages'] = {
    naturalLanguageExtraction: stageValue('naturalLanguageExtraction', 'natural-language extraction'),
    markdownExtraction: stageValue('markdownExtraction', 'Markdown extraction'),
    documentationExtraction: stageValue('documentationExtraction', 'documentation extraction'),
    communicationAnalysis: stageValue('communicationAnalysis', 'communication analysis'),
    taskSynthesis: stageValue('taskSynthesis', 'task synthesis'),
    codeChangePlanning: stageValue('codeChangePlanning', 'code-change planning'),
    summary: stageValue('summary', 'summary generation'),
  };
  const reason = knownAudit?.reason ?? { code: failureCode(failedStage), message };
  const manifest: PipelineManifest = {
    schemaVersion: 't2c.run/v1',
    runId,
    root,
    createdAt: new Date().toISOString(),
    graphFingerprint: null,
    files: {
      eventLog: path.relative(root, path.join(runDirectory, 'logs.dsl.txt')).replace(/\\/g, '/'),
    },
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
  await writeJson(path.join(runDirectory, 'manifest.json'), manifest);
  await persistPipelineEventLog({ root, runDirectory, manifest, replaceUnfinished: true });
}

export function failureCode(stage: PipelineFailureStage): string {
  return `PIPELINE_${stage.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_FAILED`;
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

export function appendLlmNotConfigured(report: DiagnosticReport): void {
  const diagnostic: Diagnostic = {
    id: createIntentId({ code: 'LLM_NOT_CONFIGURED', graph: report.graphFingerprint }, 'DIAG'),
    code: 'LLM_NOT_CONFIGURED',
    severity: 'warning',
    title: 'OpenRouter nie jest skonfigurowany',
    detail: 'Etap dokumentacja -> Intent DSL został pominięty, ponieważ brakuje OPENROUTER_API_KEY.',
    recordIds: [],
    suggestedAction: 'Ustawić OPENROUTER_API_KEY w .env i ponownie uruchomić pipeline.',
  };
  report.diagnostics.unshift(diagnostic);
  report.counts.warning += 1;
}
