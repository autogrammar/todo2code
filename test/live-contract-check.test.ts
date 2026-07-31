import assert from 'node:assert/strict';
import test from 'node:test';
import type { PipelineManifest, PipelineStageAudit } from '../src/core/types.js';
import {
  LIVE_STAGE_NAMES,
  appendLiveHistory,
  buildLiveAudit,
  redactLiveMessage,
  renderLiveReport,
  summarizeLiveHistory,
  toLiveHistoryRecord,
  type LiveBudget,
  type LiveHistoryRecord,
} from '../src/live/contract-check.js';

const BUDGET: LiveBudget = { maxStageLatencyMs: 60_000, maxTotalLatencyMs: 300_000, maxCostUsd: 0.5 };

function stage(overrides: Partial<PipelineStageAudit> = {}): PipelineStageAudit {
  return {
    runtimeVersion: '0.5.0',
    configuration: {},
    status: 'succeeded',
    requestedMode: 'llm',
    effectiveMode: 'llm',
    degraded: false,
    recordCount: 3,
    warningCount: 0,
    model: 'qwen/qwen3.7-plus',
    durationMs: 4_000,
    reason: null,
    responses: [{
      responseId: 'resp-1',
      model: 'qwen/qwen3.7-plus',
      provider: 'openrouter',
      usage: { promptTokens: 900, completionTokens: 120, totalTokens: 1_020, cost: 0.002 },
    }],
    ...overrides,
  };
}

function manifest(stages: Partial<Record<string, PipelineStageAudit>> = {}): PipelineManifest {
  const all = Object.fromEntries(LIVE_STAGE_NAMES.map((name) => [name, stage()]));
  return {
    stages: { ...all, codeChangePlanning: stage(), ...stages },
  } as unknown as PipelineManifest;
}

test('a full six-stage live run passes and reports every stage', () => {
  const audit = buildLiveAudit({
    manifest: manifest(),
    budget: BUDGET,
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });

  assert.equal(audit.schemaVersion, 't2c.live-contract-check/v2');
  assert.equal(audit.stages.length, 6);
  assert.deepEqual(audit.missingStages, []);
  assert.equal(audit.totalLatencyMs, 24_000);
  assert.equal(audit.totalCostUsd, 0.012);
  assert.equal(audit.passed, true);
  // The previous check covered two stages of six, so a documentation or task
  // synthesis regression could not fail it.
  assert.match(renderLiveReport(audit), /6\/6 stages/);
  assert.match(renderLiveReport(audit), /documentationExtraction: ok/);
});

test('a stage that silently fell back to deterministic fails the check', () => {
  const audit = buildLiveAudit({
    manifest: manifest({ taskSynthesis: stage({ effectiveMode: 'deterministic', responses: [] }) }),
    budget: BUDGET,
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });
  const taskSynthesis = audit.stages.find((item) => item.stage === 'taskSynthesis');

  assert.equal(audit.passed, false);
  assert.deepEqual(taskSynthesis?.failures, ['effectiveMode=deterministic', 'no LLM response metadata']);
});

test('a missing stage cannot pass as covered', () => {
  const incomplete = manifest();
  delete (incomplete.stages as Record<string, unknown>).communicationAnalysis;
  const audit = buildLiveAudit({
    manifest: incomplete,
    budget: BUDGET,
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });

  assert.deepEqual(audit.missingStages, ['communicationAnalysis']);
  assert.equal(audit.passed, false);
  assert.match(renderLiveReport(audit), /communicationAnalysis: MISSING/);
});

test('per-stage and total budgets are enforced separately', () => {
  const slowStage = buildLiveAudit({
    manifest: manifest({ summary: stage({ durationMs: 90_000 }) }),
    budget: BUDGET,
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });
  assert.equal(slowStage.passed, false);
  assert.equal(slowStage.overTotalLatency, false);
  assert.equal(slowStage.stages.find((item) => item.stage === 'summary')?.overLatency, true);

  // Six stages inside their own ceiling can still exceed a run budget.
  const slowRun = buildLiveAudit({
    manifest: manifest(),
    budget: { ...BUDGET, maxTotalLatencyMs: 10_000 },
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });
  assert.equal(slowRun.overTotalLatency, true);
  assert.equal(slowRun.passed, false);
  assert.ok(slowRun.stages.every((item) => !item.overLatency));

  const expensive = buildLiveAudit({
    manifest: manifest(),
    budget: { ...BUDGET, maxCostUsd: 0.001 },
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });
  assert.equal(expensive.overCost, true);
  assert.equal(expensive.passed, false);
});

test('a stage reason is recorded with provider text redacted', () => {
  const audit = buildLiveAudit({
    manifest: manifest({
      summary: stage({
        status: 'failed',
        reason: {
          code: 'LLM_RESPONSE_INVALID',
          message: 'model rejected the schema response={"choices":[{"text":"secret"}]}',
        },
      }),
    }),
    budget: BUDGET,
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });
  const summary = audit.stages.find((item) => item.stage === 'summary');

  assert.equal(audit.passed, false);
  assert.ok(summary?.failures.some((failure) => failure.includes('LLM_RESPONSE_INVALID')));
  assert.ok(summary?.failures.every((failure) => !failure.includes('secret')));
  assert.equal(redactLiveMessage('key sk-or-v1-abc123 leaked'), 'key [redacted] leaked');
});

test('history records the trend without gating on it', () => {
  const older: LiveHistoryRecord[] = [
    {
      generatedAt: '2026-07-24T04:17:00.000Z',
      passed: false,
      totalLatencyMs: 40_000,
      totalCostUsd: 0.02,
      stages: [{ stage: 'summary', ok: false, latencyMs: 30_000, costUsd: 0.01 }],
    },
    {
      generatedAt: '2026-07-17T04:17:00.000Z',
      passed: true,
      totalLatencyMs: 20_000,
      totalCostUsd: 0.01,
      stages: [{ stage: 'summary', ok: true, latencyMs: 10_000, costUsd: 0.005 }],
    },
  ];
  const audit = buildLiveAudit({
    manifest: manifest(),
    budget: BUDGET,
    history: older,
    generatedAt: '2026-07-31T08:00:00.000Z',
  });

  // A slow provider day must not fail a build, but an unrecorded trend cannot
  // be read at all — which is what "thresholds without memory" produced before.
  assert.equal(audit.passed, true);
  assert.equal(audit.history.runs, 2);
  assert.equal(audit.history.passRate, 0.5);
  assert.equal(audit.history.medianTotalLatencyMs, 30_000);
  assert.equal(audit.history.byStage.find((item) => item.stage === 'summary')?.maxLatencyMs, 30_000);
  assert.match(renderLiveReport(audit), /history: 2 run\(s\), 50% passed/);
});

test('history stays chronological, bounded and free of duplicate runs', () => {
  const record = (generatedAt: string): LiveHistoryRecord => ({
    generatedAt,
    passed: true,
    totalLatencyMs: 1_000,
    totalCostUsd: 0.001,
    stages: [{ stage: 'summary', ok: true, latencyMs: 1_000, costUsd: 0.001 }],
  });
  const seeded = [record('2026-07-10T00:00:00.000Z'), record('2026-07-03T00:00:00.000Z')];

  const appended = appendLiveHistory(seeded, record('2026-07-17T00:00:00.000Z'), 3);
  assert.deepEqual(appended.map((item) => item.generatedAt), [
    '2026-07-03T00:00:00.000Z',
    '2026-07-10T00:00:00.000Z',
    '2026-07-17T00:00:00.000Z',
  ]);

  const bounded = appendLiveHistory(appended, record('2026-07-24T00:00:00.000Z'), 3);
  assert.equal(bounded.length, 3);
  assert.equal(bounded[0]?.generatedAt, '2026-07-10T00:00:00.000Z');

  // Re-writing the same audit must not inflate the trend it describes.
  const rewritten = appendLiveHistory(bounded, record('2026-07-24T00:00:00.000Z'), 3);
  assert.equal(rewritten.length, 3);
  assert.equal(summarizeLiveHistory(rewritten).runs, 3);
});

test('an audit converts to exactly the redacted fields history keeps', () => {
  const audit = buildLiveAudit({
    manifest: manifest(),
    budget: BUDGET,
    history: [],
    generatedAt: '2026-07-31T08:00:00.000Z',
  });
  const record = toLiveHistoryRecord(audit);

  assert.deepEqual(Object.keys(record).sort(), ['generatedAt', 'passed', 'stages', 'totalCostUsd', 'totalLatencyMs']);
  assert.deepEqual(Object.keys(record.stages[0] ?? {}).sort(), ['costUsd', 'latencyMs', 'ok', 'stage']);
  assert.equal(record.stages.length, 6);
});

test('an empty history summarizes without pretending to have measured anything', () => {
  const summary = summarizeLiveHistory([]);

  assert.equal(summary.runs, 0);
  assert.equal(summary.medianTotalLatencyMs, null);
  assert.equal(summary.medianCostUsd, null);
  assert.deepEqual(summary.byStage, []);
  assert.equal(summary.firstRunAt, null);
});
