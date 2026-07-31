import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { pathExists } from '../core/io.js';
import { buildRecord, withRecordGeneration } from '../core/record.js';
import type {
  ExtractionResult,
  IntentAction,
  IntentRecord,
  LlmExtractionMode,
  LlmResponseMetadata,
  PipelineStageAudit,
} from '../core/types.js';
import { classifyLlmFailure, rejectedLlmResponseMetadata, type LlmFailureReason } from '../llm/failure.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { StructuredResponseError, structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';
import { T2C_VERSION } from '../version.js';
import { mapConcurrent } from './docs-chunks.js';
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

const MARKDOWN_ACTIONS = [
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
] as const satisfies readonly IntentAction[];
/** Keeps one provider request bounded even for repository-sized backlogs. */
export const MARKDOWN_LLM_BATCH_RECORDS = 32;

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

  const responses: LlmResponseMetadata[] = [];
  try {
    const prompt = await readPrompt('markdown-to-intent.system.md');
    const enrichments = new Map<string, MarkdownEnrichment>();
    const responseByRecord = new Map<string, LlmResponseMetadata>();
    const batches: IntentRecord[][] = [];
    for (let offset = 0; offset < deterministic.records.length; offset += MARKDOWN_LLM_BATCH_RECORDS) {
      batches.push(deterministic.records.slice(offset, offset + MARKDOWN_LLM_BATCH_RECORDS));
    }
    const outcomes = await mapConcurrent(batches, config.markdownConcurrency, async (batch) => {
      try {
        const corrected = await enrichBatchCovering(client, prompt, config.openRouter.markdownModel, batch);
        return { ok: true as const, batch, corrected };
      } catch (error) {
        return {
          ok: false as const,
          failure: error instanceof MarkdownAttemptError ? error.failure : error,
          responses: error instanceof MarkdownAttemptError
            ? error.responses
            : rejectedLlmResponseMetadata(error),
        };
      }
    });
    responses.push(...outcomes.flatMap((outcome) => (
      outcome.ok ? outcome.corrected.responses : outcome.responses
    )));
    const failed = outcomes.find((outcome) => !outcome.ok);
    if (failed && !failed.ok) throw new MarkdownAttemptError(failed.failure, []);
    for (const outcome of outcomes) {
      if (!outcome.ok) continue;
      const { batch, corrected } = outcome;
      for (const record of batch) {
        enrichments.set(record.id, corrected.enrichments.get(record.id)!);
        responseByRecord.set(record.id, corrected.metadataByRecord.get(record.id)!);
      }
    }
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
      audit: stageAudit('succeeded', 'llm', 'llm', false, result, config.openRouter.markdownModel, null, Date.now() - startedAt, responses, config),
    };
  } catch (error) {
    const failure = error instanceof MarkdownAttemptError ? error.failure : error;
    const failedResponses = error instanceof MarkdownAttemptError
      ? [...responses, ...error.responses]
      : [...responses, ...rejectedLlmResponseMetadata(error)];
    return fallbackOrThrow(
      deterministic, config, mode, startedAt, classifyLlmFailure(failure), failedResponses,
    );
  }
}

class MarkdownAttemptError extends Error {
  constructor(readonly failure: unknown, readonly responses: LlmResponseMetadata[]) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'MarkdownAttemptError';
  }
}

/**
 * Enriches every record of a batch, splitting the batch when a model truncates.
 *
 * Truncation is length-driven, so re-asking the same 32 records the same way
 * reproduces it; halving the uncovered remainder is what actually converges.
 * Splitting also keeps `require-llm` honest: partial coverage would otherwise
 * be a silent per-record deterministic fallback inside a run that promised
 * none. A single record the model still will not enrich is a real failure.
 */
async function enrichBatchCovering(
  client: OpenRouterClient,
  prompt: string,
  model: string,
  batch: IntentRecord[],
): Promise<CoveredBatch> {
  const attempt = await enrichMarkdownBatchWithCorrection(client, [
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify({ records: batch.map(promptRecord) }) },
  ], markdownResponseContract(batch.length), model, batch);
  // Provenance is per record, not per batch: a record answered by the split
  // retry must carry that response's ID, or the audit would credit it to a
  // response that never mentioned it.
  const metadataByRecord = new Map<string, LlmResponseMetadata>(
    [...attempt.enrichments.keys()].map((recordId) => [recordId, attempt.metadata]),
  );

  const uncovered = batch.filter((record) => !attempt.enrichments.has(record.id));
  if (uncovered.length === 0) {
    return { enrichments: attempt.enrichments, metadataByRecord, responses: attempt.responses };
  }
  if (batch.length === 1) {
    throw new MarkdownAttemptError(
      new Error(`Structured response omitted the only requested record: ${batch[0]?.id}`),
      attempt.responses,
    );
  }

  const half = Math.ceil(uncovered.length / 2);
  const halves = [uncovered.slice(0, half), uncovered.slice(half)].filter((part) => part.length > 0);
  const parts: CoveredBatch[] = [];
  for (const part of halves) parts.push(await enrichBatchCovering(client, prompt, model, part));

  return {
    enrichments: new Map([
      ...attempt.enrichments,
      ...parts.flatMap((part) => [...part.enrichments]),
    ]),
    metadataByRecord: new Map([
      ...metadataByRecord,
      ...parts.flatMap((part) => [...part.metadataByRecord]),
    ]),
    responses: [...attempt.responses, ...parts.flatMap((part) => part.responses)],
  };
}

interface CoveredBatch {
  enrichments: Map<string, MarkdownEnrichment>;
  metadataByRecord: Map<string, LlmResponseMetadata>;
  responses: LlmResponseMetadata[];
}

async function enrichMarkdownBatchWithCorrection(
  client: OpenRouterClient,
  baseMessages: Array<{ role: 'system' | 'user'; content: string }>,
  contract: StructuredSchema<MarkdownResponse>,
  model: string,
  batch: IntentRecord[],
): Promise<{
  enrichments: Map<string, MarkdownEnrichment>;
  metadata: LlmResponseMetadata;
  responses: LlmResponseMetadata[];
}> {
  const responses: LlmResponseMetadata[] = [];
  let correction: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await client.chatStructuredWithMetadata([
        ...baseMessages,
        ...(correction ? [{
          role: 'user' as const,
          content: `The previous response was rejected: ${correction}\n`
            + 'Correct exactly that violation and re-emit the full object. Do not add, rename, or omit properties.\n'
            + `The exact required JSON Schema is: ${JSON.stringify(contract.jsonSchema)}`,
        }] : []),
      ], 't2c_markdown_intent_enrichment', contract, model);
      responses.push(completion.metadata);
      try {
        return {
          enrichments: validateEnrichments(completion.value.enrichments, batch),
          metadata: completion.metadata,
          responses,
        };
      } catch (error) {
        if (attempt === 0) {
          correction = error instanceof Error ? error.message : String(error);
          continue;
        }
        throw new MarkdownAttemptError(error, [...responses]);
      }
    } catch (error) {
      if (error instanceof MarkdownAttemptError) throw error;
      if (error instanceof StructuredResponseError) {
        if (error.responseMetadata) responses.push(error.responseMetadata);
        if (attempt === 0) {
          correction = error.message;
          continue;
        }
      }
      throw new MarkdownAttemptError(error, [...responses]);
    }
  }
  throw new MarkdownAttemptError(new Error('Markdown correction retry budget exhausted'), responses);
}

async function fallbackOrThrow(
  deterministic: ExtractionResult,
  config: T2CConfig,
  mode: LlmExtractionMode,
  startedAt: number,
  reason: LlmFailureReason,
  responses: LlmResponseMetadata[] = [],
): Promise<AuditedMarkdownExtractionResult> {
  const failed = stageAudit('failed', 'llm', 'none', true, { records: [], warnings: [] }, config.openRouter.markdownModel, reason, Date.now() - startedAt, responses, config);
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
    audit: stageAudit('fallback', 'llm', 'deterministic', true, result, config.openRouter.markdownModel, reason, Date.now() - startedAt, responses, config),
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
    if (!expected.has(value.recordId)) throw new Error(`Structured response contains unknown recordId: ${value.recordId}`);
    if (output.has(value.recordId)) throw new Error(`Structured response duplicates recordId: ${value.recordId}`);
    output.set(value.recordId, value);
  }
  // Partial coverage is not a violation here; the caller re-asks for exactly
  // the records the model left out.
  return output;
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
    generation: {
      requested: 'llm', used: 'llm', provider: response.provider ?? 'openrouter',
      model: response.model ?? config.openRouter.markdownModel, responseId: response.responseId,
    },
    metadata: {
      ...record.metadata,
      llmUsed: true,
      acceptanceEvidence: enrichment.acceptanceEvidence,
      response,
    },
  });
}

function markDeterministic(records: IntentRecord[], degraded: boolean, fallbackReason: string | null): IntentRecord[] {
  return records.map((record) => {
    const marked = withRecordGeneration(record, {
      requested: degraded ? 'llm' : 'deterministic', used: 'deterministic', degraded, fallbackReason,
    });
    return { ...marked, metadata: { ...marked.metadata, llmUsed: false } };
  });
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

function markdownResponseContract(batchSize: number): StructuredSchema<MarkdownResponse> {
  const strings = () => s.array(s.string());
  const enrichment = s.object({
    recordId: s.string(),
    actor: s.nullableString(),
    action: s.enum(MARKDOWN_ACTIONS),
    object: s.string(),
    polarity: s.enum(['positive', 'negative']),
    confidence: s.number({ minimum: 0, maximum: 0.94 }),
    basis: strings(),
    target: s.object({ paths: strings(), symbols: strings(), tickets: strings(), versions: strings() }),
    acceptanceEvidence: strings(),
  }) satisfies StructuredSchema<MarkdownEnrichment>;
  // The floor used to equal the batch size, which made an incomplete response
  // unreadable: a model that emitted 27 of 32 enrichments failed schema
  // validation, and every enrichment it did produce was discarded with it.
  // Measured live, both `qwen/qwen3.7-plus` and `google/gemini-3.6-flash`
  // truncate long batches this way. Each enrichment names its `recordId`, so a
  // short response is attributable; coverage is enforced by splitting the
  // uncovered records into a smaller batch instead of by the schema.
  return s.object({ enrichments: s.array(enrichment, { minItems: 1, maxItems: batchSize }) });
}
