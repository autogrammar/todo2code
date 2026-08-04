import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathExists } from '../core/io.js';
import { assertConclusions } from '../core/schema.js';
import type {
  Conclusion,
  DiagnosticReport,
  IntentGraph,
  LlmResponseMetadata,
  PipelineStageAudit,
  TodoProposal,
} from '../core/types.js';
import type { T2CConfig } from '../config/env.js';
import { classifyLlmFailure, type LlmFailureReason } from '../llm/failure.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { StructuredResponseError } from '../llm/structured-schema.js';
import { T2C_VERSION } from '../version.js';
import { TASK_SYNTHESIS_RESPONSE_CONTRACT } from './task-synthesis-contract.js';
import { materializeTaskSynthesisResponse } from './task-synthesis-materialize.js';
import { compactSynthesisPayload } from './task-synthesis-payload.js';
import { taskSynthesisGenerationMetadata } from './task-synthesis-metadata.js';
import {
  validateAndClassifyTodoProposals,
  type TodoProposalValidationResult,
} from './validation.js';

export type TaskSynthesisMode = 'prefer-llm' | 'require-llm';

export interface RawDiagnosticAction {
  diagnosticId: string;
  recordIds: string[];
  suggestedAction: string;
}

export interface AuditedTaskSynthesisResult {
  schemaVersion: 't2c.task-synthesis/v1';
  conclusions: Conclusion[];
  proposals: TodoProposal[];
  validation: TodoProposalValidationResult;
  rawDiagnosticActions: RawDiagnosticAction[];
  warnings: string[];
  audit: PipelineStageAudit;
}

export class TaskSynthesisRequiredError extends Error {
  constructor(message: string, readonly audit: PipelineStageAudit) {
    super(message);
    this.name = 'TaskSynthesisRequiredError';
  }
}

class TaskSynthesisAttemptError extends Error {
  constructor(readonly failure: unknown, readonly responses: LlmResponseMetadata[]) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'TaskSynthesisAttemptError';
  }
}

export async function synthesizeTodoProposals(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  config: T2CConfig,
  mode: TaskSynthesisMode = 'require-llm',
): Promise<AuditedTaskSynthesisResult> {
  const startedAt = Date.now();
  // An empty conclusion collection is still enough to validate that both
  // inputs form one coherent evidence context before any provider call.
  assertConclusions([], { graph, diagnostics });
  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    return fallbackOrThrow(graph, diagnostics, config, mode, startedAt, {
      code: 'LLM_NOT_CONFIGURED',
      message: 'OPENROUTER_API_KEY is not configured',
    });
  }

  try {
    const prompt = await readPrompt('tasks-from-dsl.system.md');
    const payload = JSON.stringify(compactSynthesisPayload(graph, diagnostics));
    const { output, responses } = await synthesizeWithCorrection(
      client, config, mode, prompt, payload, graph, diagnostics,
    );
    return {
      schemaVersion: 't2c.task-synthesis/v1',
      ...output,
      validation: validateAndClassifyTodoProposals(output.proposals, { graph, diagnostics, conclusions: output.conclusions }),
      rawDiagnosticActions: [],
      warnings: [],
      audit: synthesisAudit(
        'succeeded', 'llm', false, output.conclusions.length + output.proposals.length,
        0, null, Date.now() - startedAt, responses, config,
      ),
    };
  } catch (error) {
    const failure = error instanceof TaskSynthesisAttemptError ? error.failure : error;
    const responses = error instanceof TaskSynthesisAttemptError ? error.responses : [];
    return fallbackOrThrow(
      graph, diagnostics, config, mode, startedAt, classifyLlmFailure(failure), responses,
    );
  }
}

/**
 * Calls the model, and on a grounding rejection gives it exactly one corrective
 * attempt with the specific error quoted back.
 *
 * Measured on `make demollm`: the model fabricates a well-formed but non-existent
 * record ID often enough that only 1 of 6 runs completed. The runtime is right to
 * reject those — an invented citation is precisely what this contract exists to
 * stop — but failing the whole pipeline on the first miss throws away four
 * already-successful LLM stages. One bounded retry does not weaken grounding:
 * the same validation still runs, and a second fabrication still fails the run.
 */
async function synthesizeWithCorrection(
  client: OpenRouterClient,
  config: T2CConfig,
  mode: TaskSynthesisMode,
  systemPrompt: string,
  payload: string,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
): Promise<{
  output: { conclusions: Conclusion[]; proposals: TodoProposal[] };
  responses: LlmResponseMetadata[];
}> {
  const responses: LlmResponseMetadata[] = [];
  let correction: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: payload },
      ...(correction
        ? [{
            role: 'user' as const,
            content: `The previous response was rejected: ${correction}\n`
              + 'Correct exactly that violation and re-emit the full object. Keep every response-local key non-blank and unique.'
              + ' Every diagnosticIds entry must appear verbatim in the input; recordIds must belong to those diagnostics.',
          }]
        : []),
    ];
    let completion;
    try {
      completion = await client.chatStructuredWithMetadata(
        messages, 't2c_grounded_task_synthesis', TASK_SYNTHESIS_RESPONSE_CONTRACT, config.openRouter.taskModel,
      );
    } catch (error) {
      if (error instanceof StructuredResponseError) {
        if (error.responseMetadata) responses.push(error.responseMetadata);
        if (attempt === 0) {
          correction = error.message;
          continue;
        }
      }
      throw new TaskSynthesisAttemptError(error, [...responses]);
    }
    responses.push(completion.metadata);
    try {
      const generation = taskSynthesisGenerationMetadata(config, mode, completion.metadata);
      return { output: materializeTaskSynthesisResponse(completion.value, graph, diagnostics, generation), responses };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const wrapped = message.startsWith('Invalid structured task synthesis response:')
        ? message
        : `Invalid structured task synthesis response: ${message}`;
      if (attempt === 1) throw new TaskSynthesisAttemptError(new Error(wrapped), [...responses]);
      correction = message;
    }
  }

  throw new Error('Invalid structured task synthesis response: retry budget exhausted');
}

async function fallbackOrThrow(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  config: T2CConfig,
  mode: TaskSynthesisMode,
  startedAt: number,
  reason: LlmFailureReason,
  responses: LlmResponseMetadata[] = [],
): Promise<AuditedTaskSynthesisResult> {
  const failedAudit = synthesisAudit(
    'failed', 'none', true, 0, 0, reason, Date.now() - startedAt, responses, config,
  );
  if (mode === 'require-llm') {
    throw new TaskSynthesisRequiredError(`Graph + diagnostics -> tasks requires LLM: ${reason.message}`, failedAudit);
  }
  const rawDiagnosticActions = diagnostics.diagnostics
    .filter((diagnostic) => diagnostic.code !== 'ALIGNED')
    .map((diagnostic) => ({
      diagnosticId: diagnostic.id,
      recordIds: [...diagnostic.recordIds],
      suggestedAction: diagnostic.suggestedAction,
    }));
  const warning = `Semantic task synthesis unavailable (${reason.code}); returned raw diagnostic actions only: ${reason.message}`;
  return {
    schemaVersion: 't2c.task-synthesis/v1',
    conclusions: [],
    proposals: [],
    validation: { orderedProposalIds: [], newProposalIds: [], duplicateProposalIds: [], duplicates: [] },
    rawDiagnosticActions,
    warnings: [warning],
    audit: synthesisAudit(
      'fallback', 'deterministic', true, 0, 1, reason, Date.now() - startedAt, responses, config,
    ),
  };
}

function synthesisAudit(
  status: PipelineStageAudit['status'],
  effectiveMode: PipelineStageAudit['effectiveMode'],
  degraded: boolean,
  recordCount: number,
  warningCount: number,
  reason: PipelineStageAudit['reason'],
  durationMs: number,
  responses: LlmResponseMetadata[],
  config: T2CConfig,
): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(config, config.openRouter.taskModel),
    status,
    requestedMode: 'llm',
    effectiveMode,
    degraded,
    recordCount,
    warningCount,
    model: config.openRouter.taskModel,
    durationMs,
    reason,
    responses,
  };
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}
