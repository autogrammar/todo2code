#!/usr/bin/env node
// Opt-in live OpenRouter contract check.
//
// Offline CI must never depend on provider uptime, so this is a separate,
// scheduled job. Without `OPENROUTER_API_KEY` it reports "skipped" and exits 0;
// set `T2C_REQUIRE_LIVE_CHECK=1` to turn a missing key into a failure.
//
// It runs the full `require-llm` pipeline over `examples/` and measures the
// manifest it produces. Driving the six stages through the pipeline rather than
// through bespoke calls is deliberate: the check cannot then drift from what
// the pipeline actually does, which is how it came to cover two stages of six.
//
// The written audit and history are derived from the runtime's own redacted
// metadata — model, provider, token counts, cost and duration. Prompts,
// completions and credentials never reach them.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  maxStageLatencyMs: 300_000,
  maxTotalLatencyMs: 900_000,
  maxCostUsd: 0.5,
  outputPath: '.intent-live/contract-check.json',
  historyPath: '.intent-live/contract-check-history.json',
  runOutput: '.intent-live-run',
};

function resolveEnvNumber(raw, name, fallback) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number, received "${raw}"`);
  }
  return value;
}

async function main() {
  const { getConfig, loadEnvFile } = await import('../dist/src/config/env.js');
  await loadEnvFile(REPO_ROOT);
  const config = getConfig(REPO_ROOT);

  if (await maybeSkipLiveContractCheck(config)) return;

  const {
    buildRecordedLiveAudit,
    liveRequestTimeoutMs,
    renderLiveReport,
  } = await import('../dist/src/live/contract-check.js');

  const budget = resolveLiveBudget();

  const manifest = await runLivePipeline(budget, liveRequestTimeoutMs);
  const history = await readHistory();
  const recorded = buildRecordedLiveAudit({
    manifest,
    budget,
    history,
    generatedAt: new Date().toISOString(),
  });
  const { audit } = recorded;

  const { auditFile, historyFile } = liveContractArtifactPaths();
  await writeLiveContractArtifacts({
    audit,
    history: recorded.history,
    auditFile,
    historyFile,
  });
  process.stdout.write(`${renderLiveReport(audit)}\n`);
  process.stdout.write(`audit: ${path.relative(REPO_ROOT, auditFile)}\n`);
  process.stdout.write(`history: ${path.relative(REPO_ROOT, historyFile)}\n`);

  if (!audit.passed) process.exitCode = 1;
}

function isLiveCheckRequired() {
  return process.env.T2C_REQUIRE_LIVE_CHECK === '1';
}

async function maybeSkipLiveContractCheck(config) {
  if (config.openRouter.apiKey) return false;
  if (isLiveCheckRequired()) {
    throw new Error('OPENROUTER_API_KEY is not configured and T2C_REQUIRE_LIVE_CHECK=1');
  }
  process.stdout.write('live contract check: SKIPPED (OPENROUTER_API_KEY not configured)\n');
  return true;
}

function resolveLiveBudget() {
  return {
    maxStageLatencyMs: resolveEnvNumber(
      process.env.T2C_LIVE_MAX_STAGE_LATENCY_MS ?? process.env.T2C_LIVE_MAX_LATENCY_MS,
      'T2C_LIVE_MAX_STAGE_LATENCY_MS',
      DEFAULTS.maxStageLatencyMs,
    ),
    maxTotalLatencyMs: resolveEnvNumber(
      process.env.T2C_LIVE_MAX_TOTAL_LATENCY_MS,
      'T2C_LIVE_MAX_TOTAL_LATENCY_MS',
      DEFAULTS.maxTotalLatencyMs,
    ),
    maxCostUsd: resolveEnvNumber(process.env.T2C_LIVE_MAX_COST_USD, 'T2C_LIVE_MAX_COST_USD', DEFAULTS.maxCostUsd),
  };
}

/**
 * Runs all six semantic stages with no deterministic fallback available.
 *
 * `require-llm` throws once a stage cannot honour the contract, but it persists
 * the failed run's manifest first. That manifest is the finding, so it is read
 * back and measured: a named stage with its reason beats an opaque exception.
*/
async function runLivePipeline(budget, liveRequestTimeoutMs) {
  const { runPipeline } = await import('../dist/src/pipeline/run.js');
  const { getConfig } = await import('../dist/src/config/env.js');
  const root = path.join(REPO_ROOT, 'examples');
  const outputDir = resolveLiveRunOutput();
  const config = prepareLiveRunConfig({
    root,
    budget,
    liveRequestTimeoutMs,
    getConfig,
  });
  const { deadline, deadlineTimer } = createLiveDeadlineTimer(budget.maxTotalLatencyMs);
  config.openRouter.signal = deadline.signal;
  const startedAt = Date.now();

  try {
    return await runLivePipelineOnce(runPipeline, root, outputDir, config);
  } catch (error) {
    const failed = await readFailedLiveManifest(runLiveOutputRoot(root, outputDir), startedAt);
    if (!failed) throw error;
    return failed;
  } finally {
    clearTimeout(deadlineTimer);
  }
}

function runLiveOutputRoot(root, outputDir) {
  return path.join(root, outputDir);
}

async function readFailedLiveManifest(runsRoot, startedAt) {
  return readLatestRunManifest(runsRoot, startedAt);
}

function resolveLiveRunOutput() {
  return process.env.T2C_LIVE_RUN_OUTPUT ?? DEFAULTS.runOutput;
}

function liveContractArtifactPaths() {
  return {
    auditFile: auditPath(),
    historyFile: historyPath(),
  };
}

async function writeLiveContractArtifacts({
  audit,
  history,
  auditFile,
  historyFile,
}) {
  await writeJson(auditFile, audit);
  await writeJson(historyFile, history);
}

function prepareLiveRunConfig({ root, budget, liveRequestTimeoutMs, getConfig }) {
  const config = getConfig(root);
  config.root = root;
  // The previous defaults allowed 300 s per stage but killed each provider
  // request after 120 s, so the advertised stage budget could never be used.
  applyLiveBudgetTimeouts(config, budget, liveRequestTimeoutMs);
  return config;
}

function createLiveDeadlineTimer(maxTotalLatencyMs) {
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), maxTotalLatencyMs);
  return { deadline, deadlineTimer };
}

function applyLiveBudgetTimeouts(config, budget, liveRequestTimeoutMs) {
  config.openRouter.timeoutMs = liveRequestTimeoutMs(
    config.openRouter.timeoutMs,
    budget.maxStageLatencyMs,
  );
  config.documentTimeoutMs = liveRequestTimeoutMs(
    config.documentTimeoutMs,
    budget.maxStageLatencyMs,
  );
}

async function runLivePipelineOnce(runPipeline, root, outputDir, config) {
  const result = await runPipeline(
    {
      root,
      ...makeLivePipelineOptions(outputDir),
    },
    config,
  );

  return result.manifest;
}

function makeLivePipelineOptions(outputDir) {
  return {
    taskFile: 'task.md',
    todoFile: 'TODO.md',
    changelogFile: 'CHANGELOG.md',
    documentPatterns: ['docs/**/*.md'],
    includeDocumentationLlm: true,
    includeSummaryLlm: true,
    includeCommunication: true,
    nlMode: 'require-llm',
    markdownMode: 'require-llm',
    communicationMode: 'require-llm',
    taskSynthesisMode: 'require-llm',
    allowSummaryFallback: false,
    gitCommitCount: 20,
    outputDir,
  };
}

/** Newest run manifest under an output directory, or null when there is none. */
async function readLatestRunManifest(outputRoot, notBeforeMs = 0) {
  const runsRoot = path.join(outputRoot, 'runs');
  let entries;
  try {
    entries = (await fs.readdir(runsRoot)).sort();
  } catch {
    return null;
  }
  for (const entry of [...entries].reverse()) {
    try {
      const manifestPath = path.join(runsRoot, entry, 'manifest.json');
      const stat = await fs.stat(manifestPath);
      if (stat.mtimeMs < notBeforeMs) continue;
      return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch {
      continue;
    }
  }
  return null;
}

function auditPath() {
  return path.resolve(REPO_ROOT, process.env.T2C_LIVE_AUDIT_PATH ?? DEFAULTS.outputPath);
}

function historyPath() {
  return path.resolve(REPO_ROOT, process.env.T2C_LIVE_HISTORY_PATH ?? DEFAULTS.historyPath);
}

/** A missing or unreadable history starts empty; the trend is not the gate. */
async function readHistory() {
  try {
    const parsed = JSON.parse(await fs.readFile(historyPath(), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJson(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

await main();
