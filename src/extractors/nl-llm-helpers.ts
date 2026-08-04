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
  LlmResponseMetadata,
  Modality,
  PipelineStageAudit,
  LifecycleStatus,
} from '../core/types.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient, type OpenRouterResult } from '../llm/openrouter.js';
import { StructuredResponseError, structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';
import { T2C_VERSION } from '../version.js';

export interface RawNlRecord {
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

export interface NlResponse { records: RawNlRecord[] }

export class NlAttemptError extends Error {
  constructor(readonly failure: unknown, readonly responses: LlmResponseMetadata[]) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'NlAttemptError';
  }
}

export async function extractNlWithCorrection(
  client: OpenRouterClient,
  baseMessages: Array<{ role: 'system' | 'user'; content: string }>,
  model: string,
): Promise<{ completion: OpenRouterResult<NlResponse>; responses: LlmResponseMetadata[] }> {
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
            + `The exact required JSON Schema is: ${JSON.stringify(NL_RESPONSE_CONTRACT.jsonSchema)}`,
        }] : []),
      ], 't2c_natural_language_intent', NL_RESPONSE_CONTRACT, model);
      responses.push(completion.metadata);
      return { completion, responses };
    } catch (error) {
      if (error instanceof StructuredResponseError) {
        if (error.responseMetadata) responses.push(error.responseMetadata);
        if (attempt === 0) {
          correction = error.message;
          continue;
        }
      }
      throw new NlAttemptError(error, [...responses]);
    }
  }
  throw new NlAttemptError(new Error('NL correction retry budget exhausted'), responses);
}

export function markDeterministicNlRecords(records: IntentRecord[], degraded: boolean, fallbackReason: string | null): IntentRecord[] {
  return records.map((record) => withRecordGeneration(record, {
    requested: degraded ? 'llm' : 'deterministic', used: 'deterministic', degraded, fallbackReason,
  }));
}

export function toIntentRecord(raw: RawNlRecord, sourcePath: string, body: string, maxLine: number, config: T2CConfig, response: LlmResponseMetadata): IntentRecord {
  const lines = body.split(/\r?\n/);
  const { start, end, excerpt } = sourceExcerpt(raw, lines, maxLine);
  const action = resolveAction(raw.action);
  const normalizedText = nonEmptyText(raw.text);
  const { object, missingFields } = resolveObject(raw, action, normalizedText);
  const statementText = normalizedText ?? object;
  return buildRecord({
    kind: raw.kind || 'declared_intent',
    actor: raw.actor ?? null,
    action,
    subject: raw.subject ?? null,
    object,
    target: raw.target,
    modality: allowedModality(raw.modality) ? raw.modality : 'unknown',
    polarity: raw.polarity === 'negative' ? 'negative' : 'positive',
    text: statementText,
    lifecycle: 'proposed',
    sourceKind: 'nl',
    sourcePath,
    sourceLines: { start, end },
    extractor: 't2c/nl-openrouter@1',
    rawExcerpt: excerpt || statementText,
    epistemicClass: 'llm_inference',
    confidence: Math.min(0.9, Math.max(0.05, Number(raw.confidence) || 0.5)),
    basis: [...new Set(['openrouter_structured_extraction', ...(raw.basis ?? [])])],
    generation: {
      requested: 'llm', used: 'llm', provider: response.provider ?? 'openrouter',
      model: response.model ?? config.openRouter.nlModel, responseId: response.responseId,
    },
    metadata: {
      missingFields,
      llmUsed: true,
      response,
    },
  });
}

export function nlStageAudit(input: {
  status: PipelineStageAudit['status'];
  requestedMode: PipelineStageAudit['requestedMode'];
  effectiveMode: PipelineStageAudit['effectiveMode'];
  degraded: boolean;
  result: ExtractionResult;
  model: string | null;
  reason: PipelineStageAudit['reason'];
  durationMs: number;
  responses: LlmResponseMetadata[];
  config: T2CConfig;
}): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(input.config, input.model),
    status: input.status,
    requestedMode: input.requestedMode,
    effectiveMode: input.effectiveMode,
    degraded: input.degraded,
    recordCount: input.result.records.length,
    warningCount: input.result.warnings.length,
    model: input.model,
    durationMs: input.durationMs,
    reason: input.reason,
    responses: input.responses,
  };
}

export async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

function sourceExcerpt(
  raw: RawNlRecord,
  lines: string[],
  maxLine: number,
): { start: number; end: number; excerpt: string } {
  const start = clampLine(raw.sourceLines?.start ?? 1, 1, maxLine);
  const end = clampLine(raw.sourceLines?.end ?? start, start, maxLine);
  return { start, end, excerpt: lines.slice(start - 1, end).join('\n').slice(0, 2000) };
}

function resolveAction(rawAction: string): IntentAction {
  return allowedAction(rawAction) ? rawAction : 'unknown';
}

/**
 * `statement.object` is free text, but neighbouring fields (`action`, `modality`,
 * `lifecycle`) are enums that include the literal `unknown`. Models copy that
 * token into the free-text slot, and the runtime used to accept it as content.
 *
 * That is worse than an empty field: `object` seeds the linker's keyword bucket,
 * so every record carrying the placeholder would collide with every other one.
 * A placeholder is therefore treated as an absent value — the statement falls
 * back to its own text, and the gap is recorded in `missingFields` so the
 * diagnostics can see it.
 */
const OBJECT_PLACEHOLDERS = new Set(['unknown', 'unspecified', 'none', 'null', 'n/a', 'na', '-', 'brak', 'nieznany', 'nieokreślony']);

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isPlaceholder(value: unknown): boolean {
  const text = nonEmptyText(value);
  return text === null || OBJECT_PLACEHOLDERS.has(text.toLowerCase());
}

function resolveObject(
  raw: RawNlRecord,
  action: IntentAction,
  normalizedText: string | null,
): { object: string; missingFields: string[] } {
  const missingFields: string[] = [];
  if (action === 'unknown') missingFields.push('action');
  if (normalizedText === null) {
    missingFields.push('text');
  }

  if (!isPlaceholder(raw.object)) return { object: nonEmptyText(raw.object) as string, missingFields };

  missingFields.push('object');
  const fallback = normalizedText;
  if (fallback === null) {
    return { object: 'unspecified', missingFields };
  }
  return { object: isPlaceholder(fallback) ? 'unspecified' : (fallback as string), missingFields };
}

function clampLine(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function allowedAction(value: string): value is IntentAction {
  return NL_ACTIONS.includes(value);
}

function allowedModality(value: string): value is Modality {
  return NL_MODALITIES.includes(value);
}

const NL_ACTIONS = [
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
] as const;
const NL_MODALITIES = ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'] as const;
const NL_LIFECYCLES = [
  'proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown',
] as const;

const nlStrings = () => s.array(s.string());
const NL_RECORD_CONTRACT = s.object({
  kind: s.string(),
  actor: s.nullableString(),
  action: s.enum(NL_ACTIONS),
  subject: s.nullableString(),
  object: s.string({
    minLength: 1,
    description: 'Concrete thing the statement is about, in the source language. Free text: never the literal word "unknown" — quote the subject matter instead.',
  }),
  modality: s.enum(NL_MODALITIES),
  polarity: s.enum(['positive', 'negative']),
  lifecycle: s.enum(NL_LIFECYCLES),
  confidence: s.number({ minimum: 0, maximum: 0.9 }),
  basis: nlStrings(),
  target: s.object({ paths: nlStrings(), symbols: nlStrings(), tickets: nlStrings(), versions: nlStrings() }),
  sourceLines: s.object({ start: s.integer({ minimum: 1 }), end: s.integer({ minimum: 1 }) }),
  text: s.string(),
}) satisfies StructuredSchema<RawNlRecord>;

const NL_RESPONSE_CONTRACT = s.object({ records: s.array(NL_RECORD_CONTRACT) }) satisfies StructuredSchema<NlResponse>;
