import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { readText, relativePosix } from '../core/io.js';
import type {
  ExtractionResult,
  LlmResponseMetadata,
  NlExtractionMode,
  PipelineStageAudit,
} from '../core/types.js';
import { classifyLlmFailure, rejectedLlmResponseMetadata } from '../llm/failure.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { assertNlExtractionOptions, extractNlIntent, type NlExtractionOptions } from './nl.js';
import {
  extractNlWithCorrection,
  markDeterministicNlRecords,
  NlAttemptError,
  nlStageAudit,
  readPrompt,
  toIntentRecord,
} from './nl-llm-helpers.js';

export interface AuditedNlExtractionResult extends ExtractionResult {
  audit: PipelineStageAudit;
}

export class NlLlmRequiredError extends Error {
  constructor(message: string, readonly audit: PipelineStageAudit) {
    super(message);
    this.name = 'NlLlmRequiredError';
  }
}

export async function extractNlIntentAudited(
  options: NlExtractionOptions,
  config: T2CConfig,
  mode: NlExtractionMode = config.nlMode,
): Promise<AuditedNlExtractionResult> {
  assertNlExtractionOptions(options);
  const startedAt = Date.now();

  if (mode === 'deterministic') {
    const result = await extractNlIntent(options, config);
    return {
      ...result,
      records: markDeterministicNlRecords(result.records, false, null),
      audit: nlStageAudit({
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
    return fallbackOrThrow(options, config, mode, startedAt, {
      code: 'LLM_NOT_CONFIGURED',
      message: 'OPENROUTER_API_KEY is not configured',
    });
  }

  try {
    const absolute = path.resolve(options.root, options.sourcePath);
    const body = options.text ?? await readText(absolute, config.maxFileBytes);
    const sourcePath = path.isAbsolute(options.sourcePath)
      ? relativePosix(options.root, absolute)
      : options.sourcePath.replace(/\\/g, '/');
    const maxLine = Math.max(1, body.split(/\r?\n/).length);
    const prompt = await readPrompt('nl-to-intent.system.md');
    const { completion, responses } = await extractNlWithCorrection(client, [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify({ sourcePath, startLine: 1, endLine: maxLine, content: body }) },
    ], config.openRouter.nlModel);
    const response = completion.value;
    const records = response.records.map((raw) => toIntentRecord(raw, sourcePath, body, maxLine, config, completion.metadata));
    const result: ExtractionResult = {
      records,
      warnings: records.length ? [] : [`No intent-like statements found in ${sourcePath}`],
    };
    return {
      ...result,
      audit: nlStageAudit({
        status: 'succeeded',
        requestedMode: 'llm',
        effectiveMode: 'llm',
        degraded: false,
        result,
        model: config.openRouter.nlModel,
        reason: null,
        durationMs: Date.now() - startedAt,
        responses,
        config,
      }),
    };
  } catch (error) {
    const failure = error instanceof NlAttemptError ? error.failure : error;
    const responses = error instanceof NlAttemptError ? error.responses : rejectedLlmResponseMetadata(error);
    return fallbackOrThrow(
      options,
      config,
      mode,
      startedAt,
      classifyLlmFailure(failure),
      responses,
    );
  }
}

async function fallbackOrThrow(
  options: NlExtractionOptions,
  config: T2CConfig,
  mode: NlExtractionMode,
  startedAt: number,
  reason: { code: string; message: string },
  responses: LlmResponseMetadata[] = [],
): Promise<AuditedNlExtractionResult> {
  const failedAudit = nlStageAudit({
    status: 'failed',
    requestedMode: 'llm',
    effectiveMode: 'none',
    degraded: true,
    result: { records: [], warnings: [] },
    model: config.openRouter.nlModel,
    reason,
    durationMs: Date.now() - startedAt,
    responses,
    config,
  });

  if (mode === 'require-llm') {
    throw new NlLlmRequiredError(`NL -> DSL requires LLM: ${reason.message}`, failedAudit);
  }

  const deterministic = await extractNlIntent(options, config);
  const warning = `NL -> DSL used deterministic fallback (${reason.code}): ${reason.message}`;
  const result = {
    records: markDeterministicNlRecords(deterministic.records, true, reason.code),
    warnings: [...deterministic.warnings, warning],
  };

  return {
    ...result,
    audit: nlStageAudit({
      status: 'fallback',
      requestedMode: 'llm',
      effectiveMode: 'deterministic',
      degraded: true,
      result,
      model: config.openRouter.nlModel,
      reason,
      durationMs: Date.now() - startedAt,
      responses,
      config,
    }),
  };
}
