import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { pathExists, readText, relativePosix } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type {
  ExtractionResult,
  IntentAction,
  IntentRecord,
  LifecycleStatus,
  Modality,
  NlExtractionMode,
  PipelineStageAudit,
} from '../core/types.js';
import { OpenRouterModelError, OpenRouterClient } from '../llm/openrouter.js';
import { T2C_VERSION } from '../version.js';
import { extractNlIntent, type NlExtractionOptions } from './nl.js';

interface RawNlRecord {
  kind: string;
  actor: string | null;
  action: IntentAction;
  subject: string | null;
  object: string;
  modality: Modality;
  polarity: 'positive' | 'negative';
  lifecycle: LifecycleStatus;
  confidence: number;
  basis: string[];
  target: { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] };
  sourceLines: { start: number; end: number };
  text: string;
}

interface NlResponse { records: RawNlRecord[] }

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
  const startedAt = Date.now();
  if (mode === 'deterministic') {
    const result = await extractNlIntent(options, config);
    return {
      ...result,
      records: markDeterministic(result.records, false, null),
      audit: audit('succeeded', 'deterministic', 'deterministic', false, result, null, null, Date.now() - startedAt),
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
    const response = await client.chatJson<NlResponse>([
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify({ sourcePath, startLine: 1, endLine: maxLine, content: body }) },
    ], 't2c_natural_language_intent', nlResponseSchema(), config.openRouter.nlModel);
    const records = (response.records ?? []).map((raw) => toIntentRecord(raw, sourcePath, body, maxLine, config));
    const result: ExtractionResult = {
      records,
      warnings: records.length ? [] : [`No intent-like statements found in ${sourcePath}`],
    };
    return {
      ...result,
      audit: audit('succeeded', 'llm', 'llm', false, result, config.openRouter.nlModel, null, Date.now() - startedAt),
    };
  } catch (error) {
    return fallbackOrThrow(options, config, mode, startedAt, classifyLlmFailure(error));
  }
}

async function fallbackOrThrow(
  options: NlExtractionOptions,
  config: T2CConfig,
  mode: NlExtractionMode,
  startedAt: number,
  reason: { code: string; message: string },
): Promise<AuditedNlExtractionResult> {
  const failedAudit = audit('failed', 'llm', 'none', true, { records: [], warnings: [] }, config.openRouter.nlModel, reason, Date.now() - startedAt);
  if (mode === 'require-llm') throw new NlLlmRequiredError(`NL -> DSL requires LLM: ${reason.message}`, failedAudit);

  const deterministic = await extractNlIntent(options, config);
  const warning = `NL -> DSL used deterministic fallback (${reason.code}): ${reason.message}`;
  const result = { records: markDeterministic(deterministic.records, true, reason.code), warnings: [...deterministic.warnings, warning] };
  return {
    ...result,
    audit: audit('fallback', 'llm', 'deterministic', true, result, config.openRouter.nlModel, reason, Date.now() - startedAt),
  };
}

function markDeterministic(records: IntentRecord[], degraded: boolean, fallbackReason: string | null): IntentRecord[] {
  return records.map((record) => ({
    ...record,
    metadata: {
      ...record.metadata,
      generation: {
        requested: degraded ? 'llm' : 'deterministic',
        used: 'deterministic',
        degraded,
        fallbackReason,
        runtimeVersion: T2C_VERSION,
      },
    },
  }));
}

function toIntentRecord(raw: RawNlRecord, sourcePath: string, body: string, maxLine: number, config: T2CConfig): IntentRecord {
  const start = clampLine(raw.sourceLines?.start ?? 1, 1, maxLine);
  const end = clampLine(raw.sourceLines?.end ?? start, start, maxLine);
  const lines = body.split(/\r?\n/);
  const excerpt = lines.slice(start - 1, end).join('\n').slice(0, 2000);
  return buildRecord({
    kind: raw.kind || 'declared_intent',
    actor: raw.actor ?? null,
    action: allowedAction(raw.action) ? raw.action : 'unknown',
    subject: raw.subject ?? null,
    object: raw.object || raw.text || 'unspecified',
    target: raw.target,
    modality: allowedModality(raw.modality) ? raw.modality : 'unknown',
    polarity: raw.polarity === 'negative' ? 'negative' : 'positive',
    text: raw.text || raw.object,
    lifecycle: 'proposed',
    sourceKind: 'nl',
    sourcePath,
    sourceLines: { start, end },
    extractor: 't2c/nl-openrouter@1',
    rawExcerpt: excerpt || raw.text || raw.object,
    epistemicClass: 'llm_inference',
    confidence: Math.min(0.9, Math.max(0.05, Number(raw.confidence) || 0.5)),
    basis: [...new Set(['openrouter_structured_extraction', ...(raw.basis ?? [])])],
    metadata: {
      llmUsed: true,
      generation: {
        requested: 'llm',
        used: 'llm',
        degraded: false,
        fallbackReason: null,
        runtimeVersion: T2C_VERSION,
        model: config.openRouter.nlModel,
      },
    },
  });
}

function audit(
  status: PipelineStageAudit['status'],
  requestedMode: PipelineStageAudit['requestedMode'],
  effectiveMode: PipelineStageAudit['effectiveMode'],
  degraded: boolean,
  result: ExtractionResult,
  model: string | null,
  reason: PipelineStageAudit['reason'],
  durationMs: number,
): PipelineStageAudit {
  return { status, requestedMode, effectiveMode, degraded, recordCount: result.records.length, warningCount: result.warnings.length, model, durationMs, reason };
}

function classifyLlmFailure(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof OpenRouterModelError) return { code: 'LLM_INVALID_MODEL', message };
  if (/timed out|timeout/i.test(message)) return { code: 'LLM_TIMEOUT', message };
  if (/HTTP 429/i.test(message)) return { code: 'LLM_RATE_LIMITED', message };
  if (/JSON|response does not contain|structured/i.test(message)) return { code: 'LLM_RESPONSE_INVALID', message };
  return { code: 'LLM_UNAVAILABLE', message };
}

function clampLine(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function allowedAction(value: string): value is IntentAction {
  return ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate', 'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown'].includes(value);
}

function allowedModality(value: string): value is Modality {
  return ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'].includes(value);
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

function nlResponseSchema(): Record<string, unknown> {
  return {
    type: 'object', additionalProperties: false, required: ['records'], properties: {
      records: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['kind', 'actor', 'action', 'subject', 'object', 'modality', 'polarity', 'lifecycle', 'confidence', 'basis', 'target', 'sourceLines', 'text'],
        properties: {
          kind: { type: 'string' }, actor: { type: ['string', 'null'] }, subject: { type: ['string', 'null'] },
          action: { type: 'string', enum: ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate', 'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown'] },
          object: { type: 'string' }, modality: { type: 'string', enum: ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'] },
          polarity: { type: 'string', enum: ['positive', 'negative'] },
          lifecycle: { type: 'string', enum: ['proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown'] },
          confidence: { type: 'number', minimum: 0, maximum: 0.9 }, basis: { type: 'array', items: { type: 'string' } },
          target: { type: 'object', additionalProperties: false, required: ['paths', 'symbols', 'tickets', 'versions'], properties: {
            paths: { type: 'array', items: { type: 'string' } }, symbols: { type: 'array', items: { type: 'string' } },
            tickets: { type: 'array', items: { type: 'string' } }, versions: { type: 'array', items: { type: 'string' } },
          } },
          sourceLines: { type: 'object', additionalProperties: false, required: ['start', 'end'], properties: {
            start: { type: 'integer', minimum: 1 }, end: { type: 'integer', minimum: 1 },
          } },
          text: { type: 'string' },
        },
      } },
    },
  };
}
