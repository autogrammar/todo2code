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
  models: 'mistralai/codestral-2508,google/gemini-3-flash-preview',
  outputPath: '.intent-live/model-comparison.json',
  markdownPath: '.intent-live/model-comparison.md',
  root: '.',
};

async function main() {
  const { getConfig, loadEnvFile } = await import('../dist/src/config/env.js');
  await loadEnvFile(REPO_ROOT);

  const probe = getConfig(REPO_ROOT);
  if (await maybeSkipLiveModelComparison(probe)) return;

  const { MARKDOWN_LLM_BATCH_RECORDS, extractMarkdownIntentAudited } = await import(
    '../dist/src/extractors/markdown-llm.js'
  );
  const { buildLiveModelComparison, renderLiveModelComparison } = await import(
    '../dist/src/live/model-comparison.js'
  );
  const { liveRequestTimeoutMs } = await import('../dist/src/live/contract-check.js');

  const timeoutMs = resolveLiveModelComparisonTimeout();
  const models = resolveLiveModelList();
  const root = resolveLiveModelRoot();
  const runs = await compareModels({
    models,
    root,
    timeoutMs,
    getConfig,
    extractMarkdownIntentAudited,
    liveRequestTimeoutMs,
  });

  const comparison = buildLiveModelComparison({
    runs,
    batchSize: MARKDOWN_LLM_BATCH_RECORDS,
    generatedAt: new Date().toISOString(),
  });
  const rendered = renderLiveModelComparison(comparison);
  const { jsonTarget, markdownTarget } = resolveLiveModelOutputPaths();

  await writeLiveModelComparisonArtifacts({
    comparison,
    rendered,
    jsonTarget,
    markdownTarget,
  });
  process.stdout.write(`${rendered}\n`);

  if (comparison.models.every((model) => !model.ok)) process.exitCode = 1;
}

function isLiveModelComparisonRequired() {
  return process.env.T2C_REQUIRE_LIVE_CHECK === '1';
}

async function maybeSkipLiveModelComparison(probe) {
  if (probe.openRouter.apiKey) return false;
  if (isLiveModelComparisonRequired()) {
    throw new Error('OPENROUTER_API_KEY is not configured and T2C_REQUIRE_LIVE_CHECK=1');
  }
  process.stdout.write('live model comparison: SKIPPED (OPENROUTER_API_KEY not configured)\n');
  return true;
}

function resolveLiveModelComparisonTimeout() {
  const raw = process.env.T2C_LIVE_COMPARE_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') return 300_000;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`T2C_LIVE_COMPARE_TIMEOUT_MS must be a non-negative number, received "${raw}"`);
  }
  return value;
}

function resolveLiveModelList() {
  const models = (process.env.T2C_LIVE_COMPARE_MODELS ?? DEFAULTS.models)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (models.length < 2) {
    throw new Error('T2C_LIVE_COMPARE_MODELS needs at least two comma-separated models');
  }
  return models;
}

function resolveLiveModelRoot() {
  return path.resolve(REPO_ROOT, process.env.T2C_LIVE_COMPARE_ROOT ?? DEFAULTS.root);
}

function resolveLiveModelOutputPaths() {
  return {
    jsonTarget: path.resolve(REPO_ROOT, process.env.T2C_LIVE_COMPARE_PATH ?? DEFAULTS.outputPath),
    markdownTarget: path.resolve(REPO_ROOT, process.env.T2C_LIVE_COMPARE_MD_PATH ?? DEFAULTS.markdownPath),
  };
}

async function compareModels({
  models,
  root,
  timeoutMs,
  getConfig,
  extractMarkdownIntentAudited,
  liveRequestTimeoutMs,
}) {
  const runs = [];
  for (const model of models) {
    runs.push(await runModelMarkdownComparison({
      model,
      root,
      timeoutMs,
      getConfig,
      extractMarkdownIntentAudited,
      liveRequestTimeoutMs,
    }));
  }
  return runs;
}

async function writeLiveModelComparisonArtifacts({
  comparison,
  rendered,
  jsonTarget,
  markdownTarget,
}) {
  await writeFile(jsonTarget, `${JSON.stringify(comparison, null, 2)}\n`);
  await writeFile(markdownTarget, `${rendered}\n`);
}

async function runModelMarkdownComparison({
  model,
  root,
  timeoutMs,
  getConfig,
  extractMarkdownIntentAudited,
  liveRequestTimeoutMs,
}) {
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
    return { model, audit: failedAudit(model, result.error), records: [] };
  }
  return { model, audit: result.audit, records: result.records };
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
