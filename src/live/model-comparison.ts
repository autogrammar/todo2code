// Live model comparison for the batched TODO/CHANGELOG enrichment stage.
//
// The stage splits work into bounded 32-record batches, so its cost and latency
// scale with batch count rather than with one request. That makes "which model
// should this stage use?" a question no single-call benchmark answers, and it
// is the question a slower default silently decides for every run.
//
// The comparison is opt-in and never part of offline CI: it exists to inform a
// configuration choice, not to gate a build on provider uptime. Everything it
// reports comes from the runtime's own redacted metadata.

import type { IntentRecord, LlmResponseMetadata, PipelineStageAudit } from '../core/types.js';
import { redactLiveMessage } from './contract-check.js';

export interface LiveModelRun {
  model: string;
  audit: PipelineStageAudit;
  records: IntentRecord[];
}

export interface LiveModelMeasurement {
  model: string;
  ok: boolean;
  failures: string[];
  latencyMs: number;
  /** Requests the stage actually issued; one per bounded batch, plus retries. */
  requests: number;
  records: number;
  enrichedRecords: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  costPerRecordUsd: number | null;
  msPerRecord: number | null;
  provider: string | null;
}

export interface LiveModelAgreement {
  /** Records both models enriched, so their fields are comparable at all. */
  comparedRecords: number;
  /** Of those, how many carry the same action, modality, polarity and lifecycle. */
  agreeingRecords: number;
  agreementRate: number;
}

export interface LiveModelComparison {
  schemaVersion: 't2c.live-model-comparison/v1';
  generatedAt: string;
  stage: 'markdownExtraction';
  batchSize: number;
  models: LiveModelMeasurement[];
  agreement: LiveModelAgreement | null;
  /** Cheapest and fastest passing model, or null when fewer than one passed. */
  cheapest: string | null;
  fastest: string | null;
}

export function measureLiveModelRun(run: LiveModelRun): LiveModelMeasurement {
  const responses = run.audit.responses ?? [];
  const failures: string[] = [];
  if (run.audit.status !== 'succeeded') failures.push(`status=${run.audit.status}`);
  if (run.audit.effectiveMode !== 'llm') failures.push(`effectiveMode=${run.audit.effectiveMode}`);
  if (run.audit.degraded) failures.push('degraded=true');
  if (responses.length === 0) failures.push('no LLM response metadata');
  if (run.audit.reason) failures.push(redactLiveMessage(`${run.audit.reason.code}: ${run.audit.reason.message}`));

  const records = run.records.length;
  const enrichedRecords = run.records.filter(isLlmEnriched).length;
  const costUsd = sumUsage(responses, (usage) => usage.cost);
  return {
    model: run.model,
    ok: failures.length === 0,
    failures,
    latencyMs: run.audit.durationMs,
    requests: responses.length,
    records,
    enrichedRecords,
    promptTokens: sumUsage(responses, (usage) => usage.promptTokens),
    completionTokens: sumUsage(responses, (usage) => usage.completionTokens),
    totalTokens: sumUsage(responses, (usage) => usage.totalTokens),
    costUsd,
    costPerRecordUsd: costUsd === null || records === 0 ? null : round(costUsd / records),
    msPerRecord: records === 0 ? null : round(run.audit.durationMs / records),
    provider: responses[0]?.provider ?? null,
  };
}

/**
 * A record counts as enriched when the LLM stage owns its generation.
 *
 * Comparing raw record counts would hide the failure that matters: a model can
 * return a well-formed response the validator rejects, leaving the
 * deterministic record in place and the count unchanged.
 */
function isLlmEnriched(record: IntentRecord): boolean {
  return record.metadata?.llmUsed === true;
}

/**
 * The deterministic input a record came from.
 *
 * Record IDs are content-derived, so pairing on them would only ever match
 * records the two models decided identically — the disagreements, which are
 * the entire point of the measurement, would silently drop out and leave an
 * agreement rate of 100%. The source location survives enrichment unchanged.
 */
function sourceKey(record: IntentRecord): string {
  const lines = record.source.lines;
  return `${record.source.kind}:${record.source.path}#${lines ? `${lines.start}-${lines.end}` : 'none'}`;
}

/**
 * How often two models decide the same thing about the same record.
 *
 * Cost and latency alone would recommend whichever model answers fastest,
 * including one that answers differently. This does not say which is right —
 * gold does that — but a low rate means the two are not interchangeable and
 * the cheaper number is not a saving.
 */
export function compareLiveModelOutputs(
  left: IntentRecord[],
  right: IntentRecord[],
): LiveModelAgreement | null {
  const rightBySource = new Map(right.filter(isLlmEnriched).map((record) => [sourceKey(record), record]));
  const pairs = left
    .filter(isLlmEnriched)
    .map((record) => [record, rightBySource.get(sourceKey(record))] as const)
    .filter((pair): pair is readonly [IntentRecord, IntentRecord] => Boolean(pair[1]));
  if (!pairs.length) return null;

  const agreeing = pairs.filter(([leftRecord, rightRecord]) => (
    leftRecord.statement.action === rightRecord.statement.action
    && leftRecord.statement.modality === rightRecord.statement.modality
    && leftRecord.statement.polarity === rightRecord.statement.polarity
    && leftRecord.lifecycle.status === rightRecord.lifecycle.status
  )).length;

  return {
    comparedRecords: pairs.length,
    agreeingRecords: agreeing,
    agreementRate: round(agreeing / pairs.length),
  };
}

export function buildLiveModelComparison(options: {
  runs: LiveModelRun[];
  batchSize: number;
  generatedAt: string;
}): LiveModelComparison {
  const models = options.runs.map(measureLiveModelRun);
  const passing = models.filter((model) => model.ok);
  const [first, second] = options.runs;

  return {
    schemaVersion: 't2c.live-model-comparison/v1',
    generatedAt: options.generatedAt,
    stage: 'markdownExtraction',
    batchSize: options.batchSize,
    models,
    agreement: first && second ? compareLiveModelOutputs(first.records, second.records) : null,
    cheapest: pick(passing, (model) => model.costUsd),
    fastest: pick(passing, (model) => model.latencyMs),
  };
}

/** Lowest measured value among passing models; null when nothing is measurable. */
function pick(models: LiveModelMeasurement[], select: (model: LiveModelMeasurement) => number | null): string | null {
  const measured = models.filter((model) => select(model) !== null);
  if (!measured.length) return null;
  return measured.reduce((best, model) => (
    (select(model) as number) < (select(best) as number) ? model : best
  )).model;
}

export function renderLiveModelComparison(comparison: LiveModelComparison): string {
  const lines = [
    `stage: ${comparison.stage} · batch size ${comparison.batchSize}`,
    '',
    '| Model | Result | Requests | Records | Enriched | Latency | ms/record | Tokens | Cost | $/record |',
    '|---|---|--:|--:|--:|--:|--:|--:|--:|--:|',
  ];
  for (const model of comparison.models) {
    lines.push([
      `| \`${model.model}\``,
      model.ok ? 'PASS' : `FAIL: ${model.failures.join('; ')}`,
      String(model.requests),
      String(model.records),
      String(model.enrichedRecords),
      `${model.latencyMs} ms`,
      model.msPerRecord === null ? 'n/a' : `${model.msPerRecord} ms`,
      model.totalTokens === null ? 'n/a' : String(model.totalTokens),
      model.costUsd === null ? 'n/a' : `$${model.costUsd}`,
      model.costPerRecordUsd === null ? 'n/a' : `$${model.costPerRecordUsd} |`,
    ].join(' | '));
  }
  lines.push('');
  lines.push(comparison.agreement
    ? `agreement: ${comparison.agreement.agreeingRecords}/${comparison.agreement.comparedRecords}`
      + ` records (${(comparison.agreement.agreementRate * 100).toFixed(1)}%) on action, modality, polarity and lifecycle`
    : 'agreement: not measurable — fewer than two models enriched the same records');
  lines.push(`cheapest: ${comparison.cheapest ?? 'n/a'} · fastest: ${comparison.fastest ?? 'n/a'}`);
  return lines.join('\n');
}

function sumUsage(
  responses: LlmResponseMetadata[],
  select: (usage: NonNullable<LlmResponseMetadata['usage']>) => number | null | undefined,
): number | null {
  const values = responses
    .map((response) => (response.usage ? select(response.usage) : null))
    .filter((value): value is number => typeof value === 'number');
  return values.length ? round(values.reduce((total, value) => total + value, 0)) : null;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
