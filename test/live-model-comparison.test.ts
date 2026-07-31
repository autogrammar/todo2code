import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import type { IntentRecord, PipelineStageAudit } from '../src/core/types.js';
import {
  buildLiveModelComparison,
  compareLiveModelOutputs,
  measureLiveModelRun,
  renderLiveModelComparison,
} from '../src/live/model-comparison.js';

function audit(overrides: Partial<PipelineStageAudit> = {}): PipelineStageAudit {
  return {
    runtimeVersion: '0.5.0',
    configuration: {},
    status: 'succeeded',
    requestedMode: 'llm',
    effectiveMode: 'llm',
    degraded: false,
    recordCount: 64,
    warningCount: 0,
    model: 'qwen/qwen3.7-plus',
    durationMs: 20_000,
    reason: null,
    // Two bounded batches, which is what the stage actually issues for 64 records.
    responses: [
      {
        responseId: 'resp-1',
        model: 'qwen/qwen3.7-plus',
        provider: 'openrouter',
        usage: { promptTokens: 4_000, completionTokens: 1_000, totalTokens: 5_000, cost: 0.02 },
      },
      {
        responseId: 'resp-2',
        model: 'qwen/qwen3.7-plus',
        provider: 'openrouter',
        usage: { promptTokens: 3_000, completionTokens: 900, totalTokens: 3_900, cost: 0.015 },
      },
    ],
    ...overrides,
  };
}

function record(options: {
  object: string;
  llmUsed: boolean;
  action?: 'add' | 'fix';
  modality?: 'required' | 'recommended';
  /** Records are paired by source location, as they are in a real run. */
  line?: number;
}): IntentRecord {
  return buildRecord({
    kind: 'declared_intent',
    action: options.action ?? 'add',
    object: options.object,
    text: `Add ${options.object}`,
    modality: options.modality ?? 'required',
    lifecycle: 'planned',
    sourceKind: 'todo',
    sourcePath: 'TODO.md',
    sourceLines: { start: options.line ?? 1, end: options.line ?? 1 },
    extractor: 'test/markdown',
    epistemicClass: 'plan',
    confidence: 1,
    basis: ['test'],
    metadata: { llmUsed: options.llmUsed },
  });
}

test('a batched run is measured per record, not per request', () => {
  const measurement = measureLiveModelRun({
    model: 'qwen/qwen3.7-plus',
    audit: audit(),
    records: Array.from({ length: 64 }, (_, index) => record({
      object: `task ${index}`,
      llmUsed: true,
      line: index + 1,
    })),
  });

  assert.equal(measurement.ok, true);
  // Cost scales with batch count, which is the number a single-call benchmark
  // cannot show and the reason this comparison exists.
  assert.equal(measurement.requests, 2);
  assert.equal(measurement.costUsd, 0.035);
  assert.equal(measurement.totalTokens, 8_900);
  assert.equal(measurement.costPerRecordUsd, 0.000547);
  assert.equal(measurement.msPerRecord, 312.5);
});

test('a model whose response the validator rejected is not counted as enriched', () => {
  const measurement = measureLiveModelRun({
    model: 'slow/model',
    audit: audit(),
    records: [
      record({ object: 'kept deterministic', llmUsed: false, line: 1 }),
      record({ object: 'enriched', llmUsed: true, line: 2 }),
    ],
  });

  // Raw record counts are unchanged when enrichment is rejected, so the count
  // that matters is how many records the stage actually owns.
  assert.equal(measurement.records, 2);
  assert.equal(measurement.enrichedRecords, 1);
});

test('a failed model is a comparison result rather than a crash', () => {
  const comparison = buildLiveModelComparison({
    runs: [
      {
        model: 'working/model',
        audit: audit(),
        records: [record({ object: 'one', llmUsed: true })],
      },
      {
        model: 'broken/model',
        audit: audit({
          status: 'failed',
          effectiveMode: 'none',
          degraded: true,
          durationMs: 0,
          responses: [],
          reason: { code: 'LLM_TIMEOUT', message: 'timed out response={"secret":true}' },
        }),
        records: [],
      },
    ],
    batchSize: 32,
    generatedAt: '2026-07-31T17:00:00.000Z',
  });
  const broken = comparison.models.find((model) => model.model === 'broken/model');

  assert.equal(broken?.ok, false);
  assert.ok(broken?.failures.some((failure) => failure.includes('LLM_TIMEOUT')));
  assert.ok(broken?.failures.every((failure) => !failure.includes('secret')));
  // A failing model must never win the recommendation.
  assert.equal(comparison.cheapest, 'working/model');
  assert.equal(comparison.fastest, 'working/model');
});

test('agreement compares only records both models enriched', () => {
  const left = [
    record({ object: 'same', llmUsed: true, line: 1 }),
    record({ object: 'different', llmUsed: true, action: 'add', line: 2 }),
    record({ object: 'left only', llmUsed: true, line: 3 }),
  ];
  const right = [
    record({ object: 'same', llmUsed: true, line: 1 }),
    // Same source line, different verdict: pairing on record IDs would drop
    // exactly this case and report perfect agreement.
    record({ object: 'different', llmUsed: true, action: 'fix', line: 2 }),
    record({ object: 'left only', llmUsed: false, line: 3 }),
  ];

  const agreement = compareLiveModelOutputs(left, right);
  assert.equal(agreement?.comparedRecords, 2);
  assert.equal(agreement?.agreeingRecords, 1);
  assert.equal(agreement?.agreementRate, 0.5);
});

test('agreement is absent rather than perfect when nothing overlaps', () => {
  const agreement = compareLiveModelOutputs(
    [record({ object: 'only left', llmUsed: true, line: 1 })],
    [record({ object: 'only right', llmUsed: true, line: 9 })],
  );

  // Reporting 100% for an empty intersection would recommend a model on no
  // evidence at all.
  assert.equal(agreement, null);

  const comparison = buildLiveModelComparison({
    runs: [
      { model: 'a/one', audit: audit(), records: [record({ object: 'left', llmUsed: true, line: 1 })] },
      { model: 'b/two', audit: audit(), records: [record({ object: 'right', llmUsed: true, line: 9 })] },
    ],
    batchSize: 32,
    generatedAt: '2026-07-31T17:00:00.000Z',
  });
  assert.equal(comparison.agreement, null);
  assert.match(renderLiveModelComparison(comparison), /agreement: not measurable/);
});

test('the rendered comparison names the cheapest and fastest passing model', () => {
  const comparison = buildLiveModelComparison({
    runs: [
      {
        model: 'pricey/slow',
        audit: audit({ durationMs: 40_000 }),
        records: [record({ object: 'one', llmUsed: true })],
      },
      {
        model: 'cheap/fast',
        audit: audit({
          durationMs: 8_000,
          responses: [{
            responseId: 'resp-1',
            model: 'cheap/fast',
            provider: 'openrouter',
            usage: { promptTokens: 4_000, completionTokens: 900, totalTokens: 4_900, cost: 0.004 },
          }],
        }),
        records: [record({ object: 'one', llmUsed: true })],
      },
    ],
    batchSize: 32,
    generatedAt: '2026-07-31T17:00:00.000Z',
  });

  assert.equal(comparison.schemaVersion, 't2c.live-model-comparison/v1');
  assert.equal(comparison.cheapest, 'cheap/fast');
  assert.equal(comparison.fastest, 'cheap/fast');
  assert.match(renderLiveModelComparison(comparison), /batch size 32/);
  assert.match(renderLiveModelComparison(comparison), /cheapest: cheap\/fast · fastest: cheap\/fast/);
});
