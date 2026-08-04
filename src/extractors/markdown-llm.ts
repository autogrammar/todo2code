import type { T2CConfig } from '../config/env.js';
import { extractMarkdownIntent, type MarkdownExtractionOptions } from './markdown.js';
import type {
  ExtractionResult,
  LlmExtractionMode,
  LlmResponseMetadata,
  PipelineStageAudit,
} from '../core/types.js';
import { classifyLlmFailure, rejectedLlmResponseMetadata, type LlmFailureReason } from '../llm/failure.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import {
  enrichMarkdownRecords,
  enrichRecord,
  markDeterministic,
  MarkdownAttemptError,
  readPrompt,
  stageAudit,
} from './markdown-llm-helpers.js';

export { MARKDOWN_LLM_BATCH_RECORDS } from './markdown-llm-helpers.js';

export interface AuditedMarkdownExtractionResult extends ExtractionResult {
  audit: PipelineStageAudit;
}

export class MarkdownLlmRequiredError extends Error {
  constructor(message: string, readonly audit: PipelineStageAudit) {
    super(message);
    this.name = 'MarkdownLlmRequiredError';
  }
}

export async function extractMarkdownIntentAudited(
  options: MarkdownExtractionOptions,
  config: T2CConfig,
  mode: LlmExtractionMode = config.markdownMode,
): Promise<AuditedMarkdownExtractionResult> {
  const startedAt = Date.now();
  const deterministic = await extractMarkdownIntent(options, config);
  if (deterministic.records.length === 0) {
    return {
      ...deterministic,
      audit: stageAudit({
        status: 'skipped',
        requestedMode: mode === 'deterministic' ? 'deterministic' : 'llm',
        effectiveMode: 'none',
        degraded: false,
        result: deterministic,
        model: null,
        reason: { code: 'NO_MARKDOWN_RECORDS', message: 'No TODO or CHANGELOG records were available for enrichment' },
        durationMs: Date.now() - startedAt,
        responses: [],
        config,
      }),
    };
  }

  if (mode === 'deterministic') {
    const result = { ...deterministic, records: markDeterministic(deterministic.records, false, null) };
    return {
      ...result,
      audit: stageAudit({
        status: 'succeeded',
        requestedMode: 'deterministic',
        effectiveMode: 'deterministic',
        degraded: false,
        result,
        model: null,
        reason: null,
        durationMs: Date.now() - startedAt,
        responses: [],
        config,
      }),
    };
  }

  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    return fallbackOrThrow(deterministic, config, mode, startedAt, {
      code: 'LLM_NOT_CONFIGURED',
      message: 'OPENROUTER_API_KEY is not configured',
    });
  }

  try {
    const prompt = await readPrompt('markdown-to-intent.system.md');
    const { enrichments, responseByRecord, responses } = await enrichMarkdownRecords(
      client,
      prompt,
      config.openRouter.markdownModel,
      deterministic.records,
      config.markdownConcurrency,
    );
    const result: ExtractionResult = {
      records: deterministic.records.map((record) => enrichRecord(
        record,
        enrichments.get(record.id)!,
        config,
        responseByRecord.get(record.id)!,
      )),
      warnings: deterministic.warnings,
    };
    return {
      ...result,
      audit: stageAudit({
        status: 'succeeded',
        requestedMode: 'llm',
        effectiveMode: 'llm',
        degraded: false,
        result,
        model: config.openRouter.markdownModel,
        reason: null,
        durationMs: Date.now() - startedAt,
        responses,
        config,
      }),
    };
  } catch (error) {
    const failure = error instanceof MarkdownAttemptError ? error.failure : error;
    const failedResponses = error instanceof MarkdownAttemptError
      ? error.responses
      : rejectedLlmResponseMetadata(error);
    return fallbackOrThrow(
      deterministic,
      config,
      mode,
      startedAt,
      classifyLlmFailure(failure),
      failedResponses,
    );
  }
}

async function fallbackOrThrow(
  deterministic: ExtractionResult,
  config: T2CConfig,
  mode: LlmExtractionMode,
  startedAt: number,
  reason: LlmFailureReason,
  responses: LlmResponseMetadata[] = [],
): Promise<AuditedMarkdownExtractionResult> {
  const failed = stageAudit({
    status: 'failed',
    requestedMode: 'llm',
    effectiveMode: 'none',
    degraded: true,
    result: { records: [], warnings: [] },
    model: config.openRouter.markdownModel,
    reason,
    durationMs: Date.now() - startedAt,
    responses,
    config,
  });
  if (mode === 'require-llm') {
    throw new MarkdownLlmRequiredError(`TODO/CHANGELOG -> DSL requires LLM: ${reason.message}`, failed);
  }
  const warning = `TODO/CHANGELOG -> DSL used deterministic fallback (${reason.code}): ${reason.message}`;
  const result: ExtractionResult = {
    records: markDeterministic(deterministic.records, true, reason.code),
    warnings: [...deterministic.warnings, warning],
  };
  return {
    ...result,
    audit: stageAudit({
      status: 'fallback',
      requestedMode: 'llm',
      effectiveMode: 'deterministic',
      degraded: true,
      result,
      model: config.openRouter.markdownModel,
      reason,
      durationMs: Date.now() - startedAt,
      responses,
      config,
    }),
  };
}
