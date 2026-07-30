#!/usr/bin/env node
// Opt-in live OpenRouter contract check.
//
// Offline CI must never depend on provider uptime, so this is a separate,
// scheduled job. Without `OPENROUTER_API_KEY` it reports "skipped" and exits 0;
// set `T2C_REQUIRE_LIVE_CHECK=1` to turn a missing key into a failure.
//
// It answers one question the stubbed contract tests cannot: does the
// configured model still honour the structured-output contract, within the
// latency and cost budget we are willing to pay?
//
// The written audit is derived from the runtime's own redacted metadata —
// model, provider, token counts, cost and latency. Prompts, completions and
// credentials never reach it.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  maxLatencyMs: 120_000,
  maxCostUsd: 0.5,
  outputPath: '.intent-live/contract-check.json',
};

function envNumber(raw, name, fallback) {
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

  if (!config.openRouter.apiKey) {
    if (process.env.T2C_REQUIRE_LIVE_CHECK === '1') {
      throw new Error('OPENROUTER_API_KEY is not configured and T2C_REQUIRE_LIVE_CHECK=1');
    }
    process.stdout.write('live contract check: SKIPPED (OPENROUTER_API_KEY not configured)\n');
    return;
  }

  const budget = {
    maxLatencyMs: envNumber(process.env.T2C_LIVE_MAX_LATENCY_MS, 'T2C_LIVE_MAX_LATENCY_MS', DEFAULTS.maxLatencyMs),
    maxCostUsd: envNumber(process.env.T2C_LIVE_MAX_COST_USD, 'T2C_LIVE_MAX_COST_USD', DEFAULTS.maxCostUsd),
  };

  const stages = await runStages(config);
  const audit = buildAudit(stages, budget);
  await writeAudit(audit);
  report(audit);

  if (!audit.passed) process.exitCode = 1;
}

/**
 * Exercises the two critical provider-facing contracts: NL -> Intent DSL and
 * graph/diagnostics -> grounded conclusions. Both run in `require-llm` so a
 * silent deterministic fallback cannot mask a broken contract.
 */
async function runStages(config) {
  const { extractNlIntentAudited } = await import('../dist/src/extractors/nl-llm.js');
  const { summarizeGraph } = await import('../dist/src/summary/summarizer.js');
  const { readJson } = await import('../dist/src/core/io.js');

  const runDirectory = await latestDemoRun();
  const graph = await readJson(path.join(runDirectory, 'intent.graph.json'));
  const diagnostics = await readJson(path.join(runDirectory, 'diagnostics.json'));

  const nl = await timeStage('extract_nl', () => extractNlIntentAudited(
    {
      root: REPO_ROOT,
      sourcePath: 'TASK.md',
      text: 'Walidacja kontraktu musi odrzucać niekompletną odpowiedź modelu przed wyliczeniem ID.',
    },
    config,
    'require-llm',
  ));
  const summary = await timeStage('summarize', () => summarizeGraph(graph, diagnostics, config, { mode: 'require-llm' }));
  return [nl, summary];
}

/** Newest `examples/.intent-demo` run, so the check uses a real graph. */
async function latestDemoRun() {
  const runsRoot = path.join(REPO_ROOT, 'examples/.intent-demo/runs');
  let entries;
  try {
    entries = (await fs.readdir(runsRoot)).sort();
  } catch {
    throw new Error(`No demo runs found under ${runsRoot}; run "npm run demo" first`);
  }
  const latest = entries.at(-1);
  if (!latest) throw new Error(`No demo runs found under ${runsRoot}; run "npm run demo" first`);
  return path.join(runsRoot, latest);
}

async function timeStage(name, run) {
  const startedAt = Date.now();
  try {
    const result = await run();
    // NL extraction reports provider metadata through its audit; the
    // summarizer returns it directly.
    const responses = result.responses ?? result.audit?.responses ?? [];
    return { name, ok: true, latencyMs: Date.now() - startedAt, responses, error: null };
  } catch (error) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - startedAt,
      responses: [],
      error: redactedError(error),
    };
  }
}

/** Removes provider bodies, model completions and credential-shaped tokens. */
function redactedError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/response=[\s\S]*/iu, 'response=[redacted]')
    .replace(/(OpenRouter (?:models )?(?:endpoint )?(?:returned non-JSON )?HTTP \d+:)[\s\S]*/iu, '$1 [redacted]')
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/gu, '[redacted]')
    .slice(0, 500);
}

function buildAudit(stages, budget) {
  const measured = stages.map((stage) => {
    const usage = stage.responses.map((response) => response.usage).filter(Boolean);
    const cost = sum(usage.map((item) => item.cost));
    const totalTokens = sum(usage.map((item) => item.totalTokens));
    const overLatency = stage.latencyMs > budget.maxLatencyMs;
    return {
      stage: stage.name,
      ok: stage.ok,
      latencyMs: stage.latencyMs,
      overLatency,
      totalTokens,
      costUsd: cost,
      model: stage.responses[0]?.model ?? null,
      provider: stage.responses[0]?.provider ?? null,
      error: stage.error,
    };
  });

  const totalCostUsd = sum(measured.map((item) => item.costUsd));
  const overCost = totalCostUsd !== null && totalCostUsd > budget.maxCostUsd;
  const failures = measured.filter((item) => !item.ok || item.overLatency);

  return {
    schemaVersion: 't2c.live-contract-check/v1',
    generatedAt: new Date().toISOString(),
    budget,
    stages: measured,
    totalCostUsd,
    overCost,
    passed: failures.length === 0 && !overCost,
  };
}

/** Sums values, returning null when the provider reported none of them. */
function sum(values) {
  const numbers = values.filter((value) => typeof value === 'number');
  return numbers.length ? Number(numbers.reduce((total, value) => total + value, 0).toFixed(6)) : null;
}

async function writeAudit(audit) {
  const target = path.resolve(REPO_ROOT, process.env.T2C_LIVE_AUDIT_PATH ?? DEFAULTS.outputPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  process.stdout.write(`audit: ${path.relative(REPO_ROOT, target)}\n`);
}

function report(audit) {
  for (const stage of audit.stages) {
    const status = stage.ok ? (stage.overLatency ? 'SLOW' : 'ok') : 'FAILED';
    const cost = stage.costUsd === null ? 'n/a' : `$${stage.costUsd}`;
    process.stdout.write(
      `${stage.stage}: ${status} · ${stage.latencyMs} ms · ${stage.totalTokens ?? 'n/a'} tokens · ${cost}`
      + `${stage.model ? ` · ${stage.model}` : ''}${stage.error ? ` · ${stage.error}` : ''}\n`,
    );
  }
  const total = audit.totalCostUsd === null ? 'n/a' : `$${audit.totalCostUsd}`;
  process.stdout.write(`live contract check: ${audit.passed ? 'PASS' : 'FAIL'} · total ${total}\n`);
}

await main();
