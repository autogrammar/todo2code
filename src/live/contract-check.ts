// Live provider contract audit.
//
// The scheduled check answers what stubbed tests cannot: does the configured
// model still honour the structured-output contract, within the latency and
// cost we are willing to pay? It used to exercise two stages of six, so a
// regression in documentation extraction, communication enrichment or task
// synthesis was invisible until someone ran `make demollm` by hand.
//
// The measurement is derived from the pipeline manifest rather than from
// bespoke stage calls, so the audit cannot drift from what the pipeline
// actually runs, and every number it reports is already redacted runtime
// metadata: model, provider, token counts, cost and duration.

import type { LlmResponseMetadata, PipelineManifest, PipelineStageAudit } from '../core/types.js';

/** The six semantic stages a full `require-llm` run must complete. */
export const LIVE_STAGE_NAMES = [
  'naturalLanguageExtraction',
  'markdownExtraction',
  'documentationExtraction',
  'communicationAnalysis',
  'taskSynthesis',
  'summary',
] as const;

export type LiveStageName = typeof LIVE_STAGE_NAMES[number];

export interface LiveBudget {
  /** Per-stage ceiling; one slow stage is a contract signal, not an average. */
  maxStageLatencyMs: number;
  maxTotalLatencyMs: number;
  maxCostUsd: number;
}

export interface LiveStageMeasurement {
  stage: LiveStageName;
  ok: boolean;
  /** Why the stage failed, already redacted. Empty when it passed. */
  failures: string[];
  status: string;
  effectiveMode: string;
  degraded: boolean;
  latencyMs: number;
  overLatency: boolean;
  responseCount: number;
  totalTokens: number | null;
  costUsd: number | null;
  model: string | null;
  provider: string | null;
}

export interface LiveHistoryRecord {
  generatedAt: string;
  passed: boolean;
  totalLatencyMs: number;
  totalCostUsd: number | null;
  stages: Array<{ stage: LiveStageName; ok: boolean; latencyMs: number; costUsd: number | null }>;
}

export interface LiveHistoryStageSummary {
  stage: LiveStageName;
  runs: number;
  passRate: number;
  medianLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface LiveHistorySummary {
  runs: number;
  passRate: number;
  medianTotalLatencyMs: number | null;
  medianCostUsd: number | null;
  firstRunAt: string | null;
  lastRunAt: string | null;
  byStage: LiveHistoryStageSummary[];
}

export interface LiveContractAudit {
  schemaVersion: 't2c.live-contract-check/v2';
  generatedAt: string;
  budget: LiveBudget;
  stages: LiveStageMeasurement[];
  missingStages: LiveStageName[];
  totalLatencyMs: number;
  totalCostUsd: number | null;
  overCost: boolean;
  overTotalLatency: boolean;
  passed: boolean;
  /**
   * Recorded, reported, and deliberately not part of `passed`. A single slow
   * provider day should not fail a build, but a trend nobody stores cannot be
   * read at all — which is why the previous check had thresholds and no memory.
   */
  history: LiveHistorySummary;
}

/** Keeps the stored trend bounded without losing the recent shape of it. */
export const LIVE_HISTORY_LIMIT = 50;

/** A live stage budget cannot be longer than the request it is measuring. */
export function liveRequestTimeoutMs(currentTimeoutMs: number, maxStageLatencyMs: number): number {
  return Math.max(currentTimeoutMs, maxStageLatencyMs);
}

export function measureLiveStages(manifest: PipelineManifest, budget: LiveBudget): LiveStageMeasurement[] {
  return LIVE_STAGE_NAMES
    .filter((stage) => Boolean(manifest.stages?.[stage]))
    .map((stage) => measureStage(stage, manifest.stages[stage], budget));
}

export function missingLiveStages(manifest: PipelineManifest): LiveStageName[] {
  return LIVE_STAGE_NAMES.filter((stage) => !manifest.stages?.[stage]);
}

function stageFailures(audit: PipelineStageAudit, responseCount: number): string[] {
  const failures: string[] = [];
  if (audit.status !== 'succeeded') failures.push(`status=${audit.status}`);
  // A deterministic fallback that still "succeeds" is exactly the silent
  // degradation this check exists to catch.
  if (audit.effectiveMode !== 'llm') failures.push(`effectiveMode=${audit.effectiveMode}`);
  if (audit.degraded) failures.push('degraded=true');
  if (responseCount === 0) failures.push('no LLM response metadata');
  if (audit.reason) failures.push(redactLiveMessage(`${audit.reason.code}: ${audit.reason.message}`));
  return failures;
}

function measureStage(
  stage: LiveStageName,
  audit: PipelineStageAudit,
  budget: LiveBudget,
): LiveStageMeasurement {
  const responses = audit.responses ?? [];
  const failures = stageFailures(audit, responses.length);

  const overLatency = audit.durationMs > budget.maxStageLatencyMs;
  return {
    stage,
    ok: failures.length === 0 && !overLatency,
    failures,
    status: audit.status,
    effectiveMode: audit.effectiveMode,
    degraded: audit.degraded,
    latencyMs: audit.durationMs,
    overLatency,
    responseCount: responses.length,
    totalTokens: sumUsage(responses, (usage) => usage.totalTokens),
    costUsd: sumUsage(responses, (usage) => usage.cost),
    model: responses[0]?.model ?? audit.model ?? null,
    provider: responses[0]?.provider ?? null,
  };
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

export function buildLiveAudit(options: {
  manifest: PipelineManifest;
  budget: LiveBudget;
  history: LiveHistoryRecord[];
  generatedAt: string;
}): LiveContractAudit {
  const stages = measureLiveStages(options.manifest, options.budget);
  const missingStages = missingLiveStages(options.manifest);
  const totalLatencyMs = stages.reduce((total, stage) => total + stage.latencyMs, 0);
  const costs = stages.map((stage) => stage.costUsd).filter((value): value is number => value !== null);
  const totalCostUsd = costs.length ? round(costs.reduce((total, value) => total + value, 0)) : null;
  const overCost = totalCostUsd !== null && totalCostUsd > options.budget.maxCostUsd;
  const overTotalLatency = totalLatencyMs > options.budget.maxTotalLatencyMs;

  return {
    schemaVersion: 't2c.live-contract-check/v2',
    generatedAt: options.generatedAt,
    budget: options.budget,
    stages,
    missingStages,
    totalLatencyMs,
    totalCostUsd,
    overCost,
    overTotalLatency,
    passed: missingStages.length === 0
      && stages.every((stage) => stage.ok)
      && !overCost
      && !overTotalLatency,
    history: summarizeLiveHistory(options.history),
  };
}

/** Build an audit whose trend already includes the run being persisted. */
export function buildRecordedLiveAudit(options: {
  manifest: PipelineManifest;
  budget: LiveBudget;
  history: LiveHistoryRecord[];
  generatedAt: string;
}): { audit: LiveContractAudit; history: LiveHistoryRecord[] } {
  const initial = buildLiveAudit(options);
  const history = appendLiveHistory(options.history, toLiveHistoryRecord(initial));
  return {
    audit: buildLiveAudit({ ...options, history }),
    history,
  };
}

export function toLiveHistoryRecord(audit: LiveContractAudit): LiveHistoryRecord {
  return {
    generatedAt: audit.generatedAt,
    passed: audit.passed,
    totalLatencyMs: audit.totalLatencyMs,
    totalCostUsd: audit.totalCostUsd,
    stages: audit.stages.map((stage) => ({
      stage: stage.stage,
      ok: stage.ok,
      latencyMs: stage.latencyMs,
      costUsd: stage.costUsd,
    })),
  };
}

/**
 * Appends one run, keeping the newest `limit` entries in chronological order.
 *
 * Deduplicating on `generatedAt` keeps a re-read/re-write of the same audit
 * from inflating the trend it is supposed to describe.
 */
export function appendLiveHistory(
  history: LiveHistoryRecord[],
  record: LiveHistoryRecord,
  limit = LIVE_HISTORY_LIMIT,
): LiveHistoryRecord[] {
  const kept = history.filter((item) => item.generatedAt !== record.generatedAt);
  return [...kept, record]
    .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt))
    .slice(-limit);
}

export function summarizeLiveHistory(history: LiveHistoryRecord[]): LiveHistorySummary {
  const runs = history.length;
  const byStage = LIVE_STAGE_NAMES.map((stage) => {
    const entries = history.flatMap((record) => record.stages.filter((item) => item.stage === stage));
    return {
      stage,
      runs: entries.length,
      passRate: ratio(entries.filter((entry) => entry.ok).length, entries.length),
      medianLatencyMs: median(entries.map((entry) => entry.latencyMs)),
      maxLatencyMs: entries.length ? Math.max(...entries.map((entry) => entry.latencyMs)) : null,
    };
  }).filter((summary) => summary.runs > 0);

  return {
    runs,
    passRate: ratio(history.filter((record) => record.passed).length, runs),
    medianTotalLatencyMs: median(history.map((record) => record.totalLatencyMs)),
    medianCostUsd: median(history
      .map((record) => record.totalCostUsd)
      .filter((value): value is number => value !== null)),
    firstRunAt: history[0]?.generatedAt ?? null,
    lastRunAt: history.at(-1)?.generatedAt ?? null,
    byStage,
  };
}

/**
 * Strips provider bodies, completions and credential-shaped tokens.
 *
 * A stage reason is the one field that can carry text the provider wrote, so
 * it passes through the same redaction the audit has always applied to errors.
 */
export function redactLiveMessage(message: string): string {
  return message
    .replace(/response=[\s\S]*/iu, 'response=[redacted]')
    .replace(/(OpenRouter (?:models )?(?:endpoint )?(?:returned non-JSON )?HTTP \d+:)[\s\S]*/iu, '$1 [redacted]')
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/gu, '[redacted]')
    .slice(0, 500);
}

export function renderLiveReport(audit: LiveContractAudit): string {
  const lines = audit.stages.map((stage) => {
    const status = stage.ok ? 'ok' : stage.overLatency && !stage.failures.length ? 'SLOW' : 'FAILED';
    const cost = stage.costUsd === null ? 'n/a' : `$${stage.costUsd}`;
    const detail = stage.failures.length ? ` · ${stage.failures.join('; ')}` : '';
    return `${stage.stage}: ${status} · ${stage.latencyMs} ms · ${stage.totalTokens ?? 'n/a'} tokens · ${cost}`
      + `${stage.model ? ` · ${stage.model}` : ''}${detail}`;
  });
  for (const stage of audit.missingStages) lines.push(`${stage}: MISSING from the run manifest`);

  const total = audit.totalCostUsd === null ? 'n/a' : `$${audit.totalCostUsd}`;
  lines.push(
    `live contract check: ${audit.passed ? 'PASS' : 'FAIL'} · ${audit.stages.length}/${LIVE_STAGE_NAMES.length} stages`
    + ` · ${audit.totalLatencyMs} ms · total ${total}`,
  );
  const { history } = audit;
  lines.push(history.runs
    ? `history: ${history.runs} run(s), ${(history.passRate * 100).toFixed(0)}% passed,`
      + ` median ${history.medianTotalLatencyMs ?? 'n/a'} ms,`
      + ` median cost ${history.medianCostUsd === null ? 'n/a' : `$${history.medianCostUsd}`}`
    : 'history: first recorded run');
  return lines.join('\n');
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : sorted[middle] as number;
  return round(value);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 1_000_000) / 1_000_000;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
