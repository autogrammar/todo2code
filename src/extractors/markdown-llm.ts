import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { pathExists } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type {
  ExtractionResult,
  IntentAction,
  IntentRecord,
  LlmExtractionMode,
  LlmResponseMetadata,
  PipelineStageAudit,
} from '../core/types.js';
import { classifyLlmFailure, type LlmFailureReason } from '../llm/failure.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { T2C_VERSION } from '../version.js';
import { extractMarkdownIntent, type MarkdownExtractionOptions } from './markdown.js';

interface MarkdownEnrichment {
  recordId: string;
  actor: string | null;
  action: IntentAction;
  object: string;
  polarity: 'positive' | 'negative';
  confidence: number;
  basis: string[];
  target: { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] };
  acceptanceEvidence: string[];
}

interface MarkdownResponse { enrichments: MarkdownEnrichment[] }

const MARKDOWN_ACTIONS: IntentAction[] = [
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
];
const MARKDOWN_ACTION_SET = new Set<IntentAction>(MARKDOWN_ACTIONS);

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
      audit: stageAudit('skipped', mode === 'deterministic' ? 'deterministic' : 'llm', 'none', false, deterministic, null, {
        code: 'NO_MARKDOWN_RECORDS', message: 'No TODO or CHANGELOG records were available for enrichment',
      }, Date.now() - startedAt, [], config),
    };
  }
  if (mode === 'deterministic') {
    const result = { ...deterministic, records: markDeterministic(deterministic.records, false, null) };
    return {
      ...result,
      audit: stageAudit('succeeded', 'deterministic', 'deterministic', false, result, null, null, Date.now() - startedAt, [], config),
    };
  }

  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    return fallbackOrThrow(deterministic, config, mode, startedAt, {
      code: 'LLM_NOT_CONFIGURED', message: 'OPENROUTER_API_KEY is not configured',
    });
  }

  try {
    const prompt = await readPrompt('markdown-to-intent.system.md');
    const completion = await client.chatJsonWithMetadata<MarkdownResponse>([
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify({ records: deterministic.records.map(promptRecord) }) },
    ], 't2c_markdown_intent_enrichment', responseSchema(), config.openRouter.markdownModel);
    const enrichments = validateEnrichments(completion.value.enrichments, deterministic.records);
    const result: ExtractionResult = {
      records: deterministic.records.map((record) => enrichRecord(record, enrichments.get(record.id)!, config, completion.metadata)),
      warnings: deterministic.warnings,
    };
    return {
      ...result,
      audit: stageAudit('succeeded', 'llm', 'llm', false, result, config.openRouter.markdownModel, null, Date.now() - startedAt, [completion.metadata], config),
    };
  } catch (error) {
    return fallbackOrThrow(deterministic, config, mode, startedAt, classifyLlmFailure(error));
  }
}

async function fallbackOrThrow(
  deterministic: ExtractionResult,
  config: T2CConfig,
  mode: LlmExtractionMode,
  startedAt: number,
  reason: LlmFailureReason,
): Promise<AuditedMarkdownExtractionResult> {
  const failed = stageAudit('failed', 'llm', 'none', true, { records: [], warnings: [] }, config.openRouter.markdownModel, reason, Date.now() - startedAt, [], config);
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
    audit: stageAudit('fallback', 'llm', 'deterministic', true, result, config.openRouter.markdownModel, reason, Date.now() - startedAt, [], config),
  };
}

function promptRecord(record: IntentRecord): Record<string, unknown> {
  return {
    recordId: record.id,
    sourceKind: record.source.kind,
    sourcePath: record.source.path,
    sourceLines: record.source.lines,
    text: record.statement.text,
    structural: {
      lifecycle: record.lifecycle.status,
      modality: record.statement.modality,
      subject: record.statement.subject,
      checked: record.metadata.checked ?? null,
      headingPath: record.metadata.headingPath ?? [],
      version: record.metadata.version ?? null,
      releaseDate: record.metadata.releaseDate ?? null,
      category: record.metadata.category ?? null,
    },
  };
}

function validateEnrichments(values: MarkdownEnrichment[] | undefined, records: IntentRecord[]): Map<string, MarkdownEnrichment> {
  if (!Array.isArray(values)) throw new Error('Structured response does not contain enrichments');
  const expected = new Set(records.map((record) => record.id));
  const output = new Map<string, MarkdownEnrichment>();
  for (const value of values) {
    if (!isMarkdownEnrichment(value)) throw new Error('Structured response contains an invalid enrichment');
    if (!expected.has(value.recordId)) throw new Error(`Structured response contains unknown recordId: ${value.recordId}`);
    if (output.has(value.recordId)) throw new Error(`Structured response duplicates recordId: ${value.recordId}`);
    output.set(value.recordId, value);
  }
  if (output.size !== expected.size) throw new Error(`Structured response returned ${output.size} of ${expected.size} required enrichments`);
  return output;
}

function isMarkdownEnrichment(value: unknown): value is MarkdownEnrichment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MarkdownEnrichment>;
  return typeof item.recordId === 'string'
    && (typeof item.actor === 'string' || item.actor === null)
    && typeof item.action === 'string'
    && MARKDOWN_ACTION_SET.has(item.action as IntentAction)
    && typeof item.object === 'string'
    && (item.polarity === 'positive' || item.polarity === 'negative')
    && typeof item.confidence === 'number'
    && Number.isFinite(item.confidence)
    && item.confidence >= 0
    && item.confidence <= 0.94
    && isStringArray(item.basis)
    && isTarget(item.target)
    && isStringArray(item.acceptanceEvidence);
}

function isTarget(value: unknown): value is MarkdownEnrichment['target'] {
  if (!value || typeof value !== 'object') return false;
  const target = value as Partial<MarkdownEnrichment['target']>;
  return isStringArray(target.paths)
    && isStringArray(target.symbols)
    && isStringArray(target.tickets)
    && isStringArray(target.versions);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function enrichRecord(record: IntentRecord, enrichment: MarkdownEnrichment, config: T2CConfig, response: LlmResponseMetadata): IntentRecord {
  const target = {
    paths: [...record.statement.target.paths, ...(enrichment.target?.paths ?? [])],
    symbols: [...record.statement.target.symbols, ...(enrichment.target?.symbols ?? [])],
    tickets: [...record.statement.target.tickets, ...(enrichment.target?.tickets ?? [])],
    versions: [...record.statement.target.versions, ...(enrichment.target?.versions ?? [])],
  };
  return buildRecord({
    kind: record.statement.kind,
    actor: enrichment.actor ?? record.statement.actor,
    action: enrichment.action,
    subject: record.statement.subject,
    object: enrichment.object.trim() || record.statement.object,
    target,
    modality: record.statement.modality,
    polarity: enrichment.polarity,
    text: record.statement.text,
    lifecycle: record.lifecycle.status,
    sourceKind: record.source.kind,
    sourcePath: record.source.path,
    sourceLines: record.source.lines,
    revision: record.source.revision,
    symbol: record.source.symbol,
    commitIndex: record.source.commitIndex,
    extractor: record.source.kind === 'todo' ? 't2c/markdown-todo-openrouter@1' : 't2c/markdown-changelog-openrouter@1',
    rawExcerpt: record.source.rawExcerpt,
    epistemicClass: record.epistemic.class,
    confidence: Math.min(0.94, Math.max(0.05, enrichment.confidence)),
    basis: [...record.epistemic.basis, 'openrouter_markdown_enrichment', ...enrichment.basis],
    observedAt: record.observedAt,
    metadata: {
      ...record.metadata,
      llmUsed: true,
      acceptanceEvidence: enrichment.acceptanceEvidence,
      generation: {
        requested: 'llm', used: 'llm', degraded: false, fallbackReason: null,
        runtimeVersion: T2C_VERSION, model: config.openRouter.markdownModel,
        response,
      },
    },
  });
}

function markDeterministic(records: IntentRecord[], degraded: boolean, fallbackReason: string | null): IntentRecord[] {
  return records.map((record) => ({
    ...record,
    metadata: {
      ...record.metadata,
      llmUsed: false,
      generation: {
        requested: degraded ? 'llm' : 'deterministic', used: 'deterministic', degraded, fallbackReason,
        runtimeVersion: T2C_VERSION,
      },
    },
  }));
}

function stageAudit(
  status: PipelineStageAudit['status'],
  requestedMode: PipelineStageAudit['requestedMode'],
  effectiveMode: PipelineStageAudit['effectiveMode'],
  degraded: boolean,
  result: ExtractionResult,
  model: string | null,
  reason: PipelineStageAudit['reason'],
  durationMs: number,
  responses: LlmResponseMetadata[],
  config: T2CConfig,
): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(config, model),
    status, requestedMode, effectiveMode, degraded, recordCount: result.records.length,
    warningCount: result.warnings.length, model, durationMs, reason, responses,
  };
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

function responseSchema(): Record<string, unknown> {
  return {
    type: 'object', additionalProperties: false, required: ['enrichments'], properties: {
      enrichments: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['recordId', 'actor', 'action', 'object', 'polarity', 'confidence', 'basis', 'target', 'acceptanceEvidence'],
        properties: {
          recordId: { type: 'string' }, actor: { type: ['string', 'null'] }, action: { type: 'string', enum: MARKDOWN_ACTIONS },
          object: { type: 'string' }, polarity: { type: 'string', enum: ['positive', 'negative'] },
          confidence: { type: 'number', minimum: 0, maximum: 0.94 }, basis: { type: 'array', items: { type: 'string' } },
          target: { type: 'object', additionalProperties: false, required: ['paths', 'symbols', 'tickets', 'versions'], properties: {
            paths: { type: 'array', items: { type: 'string' } }, symbols: { type: 'array', items: { type: 'string' } },
            tickets: { type: 'array', items: { type: 'string' } }, versions: { type: 'array', items: { type: 'string' } },
          } },
          acceptanceEvidence: { type: 'array', items: { type: 'string' } },
        },
      } },
    },
  };
}
