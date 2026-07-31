#!/usr/bin/env node
// Opt-in live comparison of models for the batched TODO/CHANGELOG stage.
//
// The stage enriches in bounded 32-record batches, so its cost and latency
// scale with batch count, not with a single request. A one-call benchmark
// cannot answer which model this stage should use, yet a slower or pricier
// default decides it for every run.
//
// Offline CI never runs this. Without `OPENROUTER_API_KEY` it reports skipped
// and exits 0; `T2C_REQUIRE_LIVE_CHECK=1` turns a missing key into a failure.
// The artifact holds redacted runtime metadata only — model, provider, token
// counts, cost and duration. Prompts and completions never reach it.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  models: 'qwen/qwen3.7-plus,google/gemini-3.6-flash',
  outputPath: '.intent-live/model-comparison.json',
  markdownPath: '.intent-live/model-comparison.md',
  root: '.',
};

async function main() {
  const { getConfig, loadEnvFile } = await import('../dist/src/config/env.js');
  await loadEnvFile(REPO_ROOT);

  const probe = getConfig(REPO_ROOT);
  if (!probe.openRouter.apiKey) {
    if (process.env.T2C_REQUIRE_LIVE_CHECK === '1') {
      throw new Error('OPENROUTER_API_KEY is not configured and T2C_REQUIRE_LIVE_CHECK=1');
    }
    process.stdout.write('live model comparison: SKIPPED (OPENROUTER_API_KEY not configured)\n');
    return;
  }

  const { MARKDOWN_LLM_BATCH_RECORDS, extractMarkdownIntentAudited } = await import(
    '../dist/src/extractors/markdown-llm.js'
  );
  const { buildLiveModelComparison, renderLiveModelComparison } = await import(
    '../dist/src/live/model-comparison.js'
  );
  const { liveRequestTimeoutMs } = await import('../dist/src/live/contract-check.js');

  // The comparison enriches a repository's whole TODO/CHANGELOG, which is
  // several bounded batches. A request timeout below that budget measures the
  // clock rather than the model — the first live run timed out at 120 s on a
  // model that had not failed.
  const timeoutMs = Number(process.env.T2C_LIVE_COMPARE_TIMEOUT_MS ?? 300_000);

  const models = (process.env.T2C_LIVE_COMPARE_MODELS ?? DEFAULTS.models)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (models.length < 2) throw new Error('T2C_LIVE_COMPARE_MODELS needs at least two comma-separated models');

  const root = path.resolve(REPO_ROOT, process.env.T2C_LIVE_COMPARE_ROOT ?? DEFAULTS.root);
  const runs = [];
  for (const model of models) {
    // A fresh config per model: the stage reads its model from configuration,
    // and sharing one object would leak the previous model's audit fingerprint.
    const config = getConfig(root);
    config.root = root;
    config.openRouter.markdownModel = model;
    config.openRouter.timeoutMs = liveRequestTimeoutMs(config.openRouter.timeoutMs, timeoutMs);
    process.stdout.write(`running ${model}…\n`);
    const result = await extractMarkdownIntentAudited(
      { root, todoPath: 'TODO.md', changelogPath: 'CHANGELOG.md' },
      config,
      'require-llm',
    ).catch((error) => ({ error }));

    if (result.error) {
      // A model that cannot honour the contract is a comparison result, not a
      // crash: record it and keep measuring the others.
      runs.push({ model, audit: failedAudit(model, result.error), records: [] });
      continue;
    }
    runs.push({ model, audit: result.audit, records: result.records });
  }

  const comparison = buildLiveModelComparison({
    runs,
    batchSize: MARKDOWN_LLM_BATCH_RECORDS,
    generatedAt: new Date().toISOString(),
  });
  const rendered = renderLiveModelComparison(comparison);

  const jsonTarget = path.resolve(REPO_ROOT, process.env.T2C_LIVE_COMPARE_PATH ?? DEFAULTS.outputPath);
  const markdownTarget = path.resolve(REPO_ROOT, process.env.T2C_LIVE_COMPARE_MD_PATH ?? DEFAULTS.markdownPath);
  await writeFile(jsonTarget, `${JSON.stringify(comparison, null, 2)}\n`);
  await writeFile(markdownTarget, `${rendered}\n`);
  process.stdout.write(`${rendered}\n`);

  if (comparison.models.every((model) => !model.ok)) process.exitCode = 1;
}

function failedAudit(model, error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    runtimeVersion: 'unknown',
    configuration: {},
    status: 'failed',
    requestedMode: 'llm',
    effectiveMode: 'none',
    degraded: true,
    recordCount: 0,
    warningCount: 0,
    model,
    durationMs: 0,
    reason: { code: 'LIVE_COMPARISON_FAILED', message },
    responses: [],
  };
}

async function writeFile(target, contents) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents, 'utf8');
  process.stdout.write(`artifact: ${path.relative(REPO_ROOT, target)}\n`);
}

await main();
