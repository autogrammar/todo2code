import path from 'node:path';

import { createCodeChangeReviewPatch, createCodeChangeSourcePatchSet, createRepositoryPathProbe, proposeCodeChangePlans } from '../synthesis/code-change-plan.js';
import { extractCommunicationIntentAudited, type ParticipantCommunicationSynthesis } from '../communication/llm.js';
import { type AuditedTaskSynthesisResult, synthesizeTodoProposals } from '../synthesis/tasks-llm.js';
import { createTodoPatch, type CreatedTodoPatch } from '../synthesis/todo-patch.js';
import { createIntentId } from '../core/id.js';
import type { Diagnostic, DiagnosticReport, IntentRecord, PipelineOptions, PipelineStageAudit } from '../core/types.js';
import { readText } from '../core/io.js';
import { T2C_VERSION } from '../version.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import type { T2CConfig } from '../config/env.js';
import type { PipelineFailureStage } from '../core/types.js';

type PipelineContext = {
  root: string;
  warnings: string[];
  bySource: Record<string, IntentRecord[]>;
  activeStage: PipelineFailureStage;
};

function skippedAudit(requestedMode: PipelineStageAudit['requestedMode'], message: string): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: {},
    status: 'skipped',
    requestedMode,
    effectiveMode: 'none',
    degraded: false,
    recordCount: 0,
    warningCount: 0,
    model: null,
    durationMs: 0,
    reason: { code: 'STAGE_SKIPPED', message },
    responses: [],
  };
}

export async function collectCommunicationAnalysis(
  context: PipelineContext,
  options: Pick<PipelineOptions, 'includeCommunication' | 'projectDirectory' | 'communicationTicket' | 'communicationMode'>,
  config: T2CConfig,
): Promise<{
  audit: PipelineStageAudit;
  syntheses: ParticipantCommunicationSynthesis[];
  missingDirectory: boolean;
}> {
  const { root, warnings, bySource } = context;
  const includeCommunication = options.includeCommunication !== false;
  const communicationStartedAt = Date.now();
  let communicationAudit: PipelineStageAudit = skippedAudit('disabled', 'Communication analysis was disabled');
  let missingDirectory = false;
  let communicationSyntheses: ParticipantCommunicationSynthesis[] = [];

  if (!includeCommunication) {
    return { audit: communicationAudit, syntheses: communicationSyntheses, missingDirectory: true };
  }

  context.activeStage = 'communicationAnalysis';
  const communication = await extractCommunicationIntentAudited({
    root,
    projectDir: options.projectDirectory ?? 'project',
    ticket: options.communicationTicket ?? null,
  }, config, options.communicationMode ?? config.communicationMode);
  const foundMissingDirectory = communication.records.length === 0
    && communication.warnings.length === 1
    && !!communication.warnings[0]?.startsWith('Communication directory not found:');
  if (!foundMissingDirectory) warnings.push(...communication.warnings);
  bySource.communication = communication.records;
  communicationSyntheses = communication.participants;
  missingDirectory = foundMissingDirectory;
  if (!foundMissingDirectory) {
    communicationAudit = {
      ...communication.audit,
      durationMs: Date.now() - communicationStartedAt,
      effectiveMode: communication.audit.effectiveMode,
    };
  } else {
    communicationAudit = skippedAudit('deterministic', communication.warnings[0] ?? 'Communication directory not found');
  }

  return {
    audit: communicationAudit,
    syntheses: communicationSyntheses,
    missingDirectory,
  };
}

export async function collectTaskSynthesis(
  context: PipelineContext,
  options: Pick<PipelineOptions, 'taskSynthesisMode' | 'todoFile'>,
  config: T2CConfig,
  root: string,
  graph: Parameters<typeof synthesizeTodoProposals>[0],
  diagnostics: DiagnosticReport,
): Promise<{ result: AuditedTaskSynthesisResult | null; patch: CreatedTodoPatch | null; audit: PipelineStageAudit }> {
  const { warnings } = context;
  const taskSynthesisMode = options.taskSynthesisMode ?? 'disabled';
  let taskSynthesis: AuditedTaskSynthesisResult | null = null;
  let todoPatch: CreatedTodoPatch | null = null;
  let taskSynthesisAudit = skippedAudit('disabled', 'Task synthesis was disabled');

  if (taskSynthesisMode === 'disabled') {
    return { result: taskSynthesis, patch: todoPatch, audit: taskSynthesisAudit };
  }

  context.activeStage = 'taskSynthesis';
  taskSynthesis = await synthesizeTodoProposals(graph, diagnostics, config, taskSynthesisMode);
  warnings.push(...taskSynthesis.warnings);
  taskSynthesisAudit = taskSynthesis.audit;

  if (!options.todoFile) throw new Error('Task synthesis rendering requires a TODO source file');
  context.activeStage = 'todoRendering';
  const todoContent = await readText(path.resolve(root, options.todoFile), config.maxFileBytes);
  todoPatch = createTodoPatch({
    todoPath: path.relative(root, path.resolve(root, options.todoFile)).replace(/\\/g, '/'),
    todoContent,
    graph,
    diagnostics,
    conclusions: taskSynthesis.conclusions,
    proposals: taskSynthesis.proposals,
    validation: taskSynthesis.validation,
    synthesisAudit: taskSynthesis.audit,
  });
  return { result: taskSynthesis, patch: todoPatch, audit: taskSynthesisAudit };
}

export function createCodeChangeArtifacts(
  graph: Parameters<typeof proposeCodeChangePlans>[0]['graph'],
  diagnostics: DiagnosticReport,
  generatedAt: string,
  root: string,
  taskSynthesis: AuditedTaskSynthesisResult | null,
  config: T2CConfig,
) {
  const codeChangePlans = proposeCodeChangePlans({
    graph,
    diagnostics,
    ...(taskSynthesis
      ? { conclusions: taskSynthesis.conclusions, proposals: taskSynthesis.proposals }
      : {}),
    generatedAt,
    pathExists: createRepositoryPathProbe(root),
  });
  const codeChangeReview = createCodeChangeReviewPatch({
    plans: codeChangePlans.plans,
    graphFingerprint: graph.fingerprint,
    createdAt: generatedAt,
  });
  const codeChangeSourcePatches = createCodeChangeSourcePatchSet({
    plans: codeChangePlans.plans,
    graphFingerprint: graph.fingerprint,
    generatedAt,
  });
  const codeChangePlanningAudit: PipelineStageAudit = {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(config, null),
    status: 'succeeded',
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    recordCount: codeChangePlans.plans.length,
    warningCount: 0,
    model: null,
    durationMs: 0,
    reason: null,
    responses: [],
  };
  return {
    codeChangePlans,
    codeChangeReview,
    codeChangeSourcePatches,
    codeChangePlanningAudit,
  };
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
