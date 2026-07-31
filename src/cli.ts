#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { configForDisplay, getConfig, hasOpenRouter, loadEnvFile } from './config/env.js';
import { compareWorkspaceIntent } from './comparison/workspace.js';
import { analyzeCommunication, renderCommunicationMarkdown } from './communication/analyzer.js';
import { extractCommunicationIntentAudited } from './communication/llm.js';
import { pathExists, readJson, readJsonl, readText, writeJson, writeJsonl, writeText } from './core/io.js';
import type { DiagnosticReport, IntentGraph, LlmExtractionMode, NlExtractionMode, PipelineOptions } from './core/types.js';
import { collectGitDiff } from './diff/git.js';
import { buildRealityView, renderRealityMarkdown, renderRealitySvg } from './diff/reality.js';
import {
  diffText,
  renderTextDiffHtml,
  renderTextDiffSvg,
  renderUnifiedDiff,
  type FileDiff,
} from './diff/text.js';
import { extractAstIntent } from './extractors/ast.js';
import { extractConfigurationIntent } from './extractors/configuration.js';
import { extractDocumentationIntent } from './extractors/docs-llm.js';
import { extractGitIntent } from './extractors/git.js';
import { extractMarkdownIntentAudited } from './extractors/markdown-llm.js';
import { extractNlIntentAudited } from './extractors/nl-llm.js';
import { diagnoseGraph } from './graph/diagnostics.js';
import { diffIntentGraphs, renderGraphDiffSvg } from './graph/diff.js';
import { linkIntentRecords } from './graph/linker.js';
import { startA2aServer } from './interfaces/a2a.js';
import { startMcpServer } from './interfaces/mcp.js';
import { runPipeline } from './pipeline/run.js';
import { executeAction } from './services/actions.js';
import { summarizeGraph } from './summary/summarizer.js';
import { watchRepository, type WatchEvent } from './watch/watcher.js';
import { T2C_VERSION } from './version.js';

const execFileAsync = promisify(execFile);

// Unix consumers commonly close a pipe early (for example `t2c help | head`).
// Treat EPIPE as a successful short read instead of printing an unhandled stack.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

interface ParsedArgs {
  positionals: string[];
  options: Map<string, string | boolean>;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  await loadEnvFile();
  if (argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    return;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    process.stdout.write(`todo2code ${T2C_VERSION}\n`);
    return;
  }
  const parsed = parseArgs(argv);
  const command = parsed.positionals.shift() ?? 'help';
  const config = getConfig();

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (command === 'version' || command === '--version' || command === '-v') {
    process.stdout.write(`todo2code ${T2C_VERSION}\n`);
    return;
  }
  if (command === 'init') {
    await initProject(path.resolve(parsed.positionals[0] ?? '.'));
    return;
  }
  if (command === 'doctor') {
    await doctor(config);
    return;
  }
  if (command === 'mcp') {
    await startMcpServer(config);
    return;
  }
  if (command === 'a2a') {
    await startA2aServer(config);
    return;
  }
  if (command === 'extract') {
    await handleExtract(parsed, config);
    return;
  }
  if (command === 'communication') {
    await handleCommunication(parsed, config);
    return;
  }
  if (command === 'link') {
    const files = parsed.positionals;
    if (!files.length) throw new Error('Usage: t2c link <file.intent.jsonl>... [--out graph.json]');
    const records = (await Promise.all(files.map((file) => readJsonl(path.resolve(file))))).flat();
    const graph = linkIntentRecords(records);
    await emitJson(graph, optionString(parsed, 'out'));
    return;
  }
  if (command === 'diagnose') {
    const graphFile = parsed.positionals[0];
    if (!graphFile) throw new Error('Usage: t2c diagnose <intent.graph.json> [--out diagnostics.json]');
    const graph = await readJson<IntentGraph>(path.resolve(graphFile));
    await emitJson(diagnoseGraph(graph), optionString(parsed, 'out'));
    return;
  }
  if (command === 'diff') {
    await handleDiff(parsed, config);
    return;
  }
  if (command === 'reality') {
    await handleReality(parsed, config);
    return;
  }
  if (command === 'summarize') {
    const graphFile = parsed.positionals[0];
    if (!graphFile) throw new Error('Usage: t2c summarize <intent.graph.json> [--diagnostics diagnostics.json] [--mode deterministic|prefer-llm|require-llm] [--out summary.md]');
    const graph = await readJson<IntentGraph>(path.resolve(graphFile));
    const diagnosticsPath = optionString(parsed, 'diagnostics');
    const diagnostics = diagnosticsPath
      ? await readJson<DiagnosticReport>(path.resolve(diagnosticsPath))
      : diagnoseGraph(graph);
    const result = await summarizeGraph(graph, diagnostics, config, {
      mode: optionSummaryMode(parsed),
    });
    for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`);
    const out = optionString(parsed, 'out');
    if (out) await writeText(path.resolve(out), result.markdown);
    else process.stdout.write(result.markdown);
    return;
  }
  if (command === 'propose-todo') {
    const graphPath = parsed.positionals[0];
    const diagnosticsPath = optionString(parsed, 'diagnostics');
    const output = optionString(parsed, 'out');
    if (!graphPath || !diagnosticsPath || !output) {
      throw new Error('Usage: t2c propose-todo <graph.json> --diagnostics diagnostics.json --mode prefer-llm|require-llm --out synthesis.json');
    }
    const result = await executeAction('propose_todo', {
      root: optionString(parsed, 'root') ?? config.root,
      graphPath,
      diagnosticsPath,
      mode: optionTaskMode(parsed),
      output,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'render-todo') {
    const synthesisPath = parsed.positionals[0];
    const graphPath = optionString(parsed, 'graph');
    const diagnosticsPath = optionString(parsed, 'diagnostics');
    const patch = optionString(parsed, 'patch');
    const audit = optionString(parsed, 'audit');
    if (!synthesisPath || !graphPath || !diagnosticsPath || !patch || !audit) {
      throw new Error('Usage: t2c render-todo <synthesis.json> --graph graph.json --diagnostics diagnostics.json --todo TODO.md --patch TODO.patch --audit TODO.patch.json');
    }
    const result = await executeAction('render_todo', {
      root: optionString(parsed, 'root') ?? config.root,
      synthesisPath,
      graphPath,
      diagnosticsPath,
      todo: optionString(parsed, 'todo') ?? 'TODO.md',
      patch,
      audit,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'apply-todo') {
    const patch = optionString(parsed, 'patch');
    const audit = optionString(parsed, 'audit');
    const receipt = optionString(parsed, 'receipt');
    const actor = optionString(parsed, 'actor');
    const approvalHash = optionString(parsed, 'approval-hash');
    if (!patch || !audit || !receipt || !actor || !approvalHash) {
      throw new Error('Usage: t2c apply-todo --todo TODO.md --patch TODO.patch --audit TODO.patch.json --receipt receipt.json --actor <identity> --approval-hash <sha256>');
    }
    const result = await executeAction('apply_todo', {
      root: optionString(parsed, 'root') ?? config.root,
      todo: optionString(parsed, 'todo') ?? 'TODO.md',
      patch,
      audit,
      receipt,
      actor,
      approvalHash,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'propose-code-change') {
    const graphPath = parsed.positionals[0];
    const diagnosticsPath = optionString(parsed, 'diagnostics');
    const output = optionString(parsed, 'out');
    if (!graphPath || !diagnosticsPath || !output) {
      throw new Error('Usage: t2c propose-code-change <graph.json> --diagnostics diagnostics.json [--proposals proposals.json] --out plans.json');
    }
    const result = await executeAction('propose_code_change', {
      root: optionString(parsed, 'root') ?? config.root,
      graphPath,
      diagnosticsPath,
      conclusionsPath: optionString(parsed, 'conclusions'),
      proposalsPath: optionString(parsed, 'proposals'),
      maxPlans: optionString(parsed, 'max-plans'),
      output,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'render-code-change') {
    const plansPath = parsed.positionals[0];
    const patch = optionString(parsed, 'patch') ?? 'CODE_CHANGE.review.md';
    const audit = optionString(parsed, 'audit') ?? 'CODE_CHANGE.review.json';
    if (!plansPath) {
      throw new Error('Usage: t2c render-code-change <plans.json> [--patch CODE_CHANGE.review.md] [--audit CODE_CHANGE.review.json]');
    }
    const result = await executeAction('render_code_change', {
      root: optionString(parsed, 'root') ?? config.root,
      plansPath,
      patch,
      audit,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'propose-source-patch') {
    const inputPath = parsed.positionals[0];
    const output = optionString(parsed, 'out');
    if (!inputPath || !output) {
      throw new Error('Usage: t2c propose-source-patch <plan.json|plans.json> --out source-patches.json');
    }
    const isPlanSet = inputPath.endsWith('plans.json') || optionString(parsed, 'kind') === 'set';
    const result = await executeAction('propose_source_patch', {
      root: optionString(parsed, 'root') ?? config.root,
      ...(isPlanSet ? { plansPath: inputPath } : { planPath: inputPath }),
      output,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'apply-source-patch') {
    const patchPath = parsed.positionals[0];
    const actor = optionString(parsed, 'actor');
    const approvalHash = optionString(parsed, 'approval-hash');
    const receipt = optionString(parsed, 'receipt') ?? 'CODE_CHANGE.source.receipt.json';
    if (!patchPath || !actor || !approvalHash) {
      throw new Error('Usage: t2c apply-source-patch <patch.json> --actor <id> --approval-hash <sha256> [--receipt receipt.json]');
    }
    const result = await executeAction('apply_source_patch', {
      root: optionString(parsed, 'root') ?? config.root,
      patchPath,
      actor,
      approvalHash,
      receipt,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'evaluate-code-change') {
    const planPath = parsed.positionals[0];
    const beforeGraphPath = optionString(parsed, 'before-graph');
    const afterGraphPath = optionString(parsed, 'after-graph');
    const output = optionString(parsed, 'out');
    if (!planPath || !beforeGraphPath || !afterGraphPath || !output) {
      throw new Error('Usage: t2c evaluate-code-change <plan.json> --before-graph before.json --after-graph after.json [--before-diagnostics d.json] --out acceptance.json');
    }
    const result = await executeAction('evaluate_code_change', {
      root: optionString(parsed, 'root') ?? config.root,
      planPath,
      beforeGraphPath,
      beforeDiagnosticsPath: optionString(parsed, 'before-diagnostics'),
      afterGraphPath,
      afterDiagnosticsPath: optionString(parsed, 'after-diagnostics'),
      output,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'close-code-change') {
    const inputPath = parsed.positionals[0];
    const beforeGraphPath = optionString(parsed, 'before-graph');
    const afterGraphPath = optionString(parsed, 'after-graph');
    const output = optionString(parsed, 'out');
    if (!inputPath || !beforeGraphPath || !afterGraphPath || !output) {
      throw new Error('Usage: t2c close-code-change <plan.json|plans.json> --before-graph before.json --after-graph after.json --out close.json');
    }
    const result = await executeAction('close_code_change', {
      root: optionString(parsed, 'root') ?? config.root,
      inputPath,
      beforeGraphPath,
      beforeDiagnosticsPath: optionString(parsed, 'before-diagnostics'),
      afterGraphPath,
      afterDiagnosticsPath: optionString(parsed, 'after-diagnostics'),
      output,
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'watch') {
    await handleWatch(parsed, config);
    return;
  }
  if (command === 'compare-workspace') {
    const root = path.resolve(parsed.positionals[0] ?? config.root);
    const result = await compareWorkspaceIntent({
      root,
      baseRef: optionString(parsed, 'base') ?? 'origin/main',
      taskFile: optionNullableString(parsed, 'task', null),
      todoFile: optionNullableString(parsed, 'todo', 'TODO.md'),
      changelogFile: optionNullableString(parsed, 'changelog', 'CHANGELOG.md'),
      documentPatterns: optionList(parsed, 'docs', config.documentPatterns),
      documentExcludes: optionList(parsed, 'doc-excludes', config.documentExcludes),
      includeDocumentationLlm: optionBoolean(parsed, 'docs-llm', false),
      markdownMode: optionLlmMode(parsed, 'markdown-mode', config.markdownMode),
      communicationMode: optionLlmMode(parsed, 'communication-mode', config.communicationMode),
      outputDir: optionString(parsed, 'out') ?? config.outputDir,
      gitCommitCount: optionNumber(parsed, 'git-count', config.gitCommitCount, 1, 100),
    }, config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'pipeline') {
    const root = path.resolve(parsed.positionals[0] ?? config.root);
    const options: PipelineOptions = {
      root,
      taskFile: optionNullableString(parsed, 'task', null),
      todoFile: optionNullableString(parsed, 'todo', 'TODO.md'),
      changelogFile: optionNullableString(parsed, 'changelog', 'CHANGELOG.md'),
      documentPatterns: optionList(parsed, 'docs', config.documentPatterns),
      includeDocumentationLlm: !optionBoolean(parsed, 'no-docs-llm', false),
      outputDir: optionString(parsed, 'out') ?? config.outputDir,
      gitCommitCount: optionNumber(parsed, 'git-count', config.gitCommitCount, 1, 100),
      allowSummaryFallback: optionBoolean(parsed, 'summary-fallback', true),
      includeSummaryLlm: !optionBoolean(parsed, 'no-summary-llm', false),
      nlMode: optionNlMode(parsed, config.nlMode),
      markdownMode: optionLlmMode(parsed, 'markdown-mode', config.markdownMode),
      communicationMode: optionLlmMode(parsed, 'communication-mode', config.communicationMode),
      documentExcludes: optionList(parsed, 'doc-excludes', config.documentExcludes),
      taskSynthesisMode: optionPipelineTaskMode(parsed),
      includeCommunication: !optionBoolean(parsed, 'no-communication', false),
      projectDirectory: optionString(parsed, 'project-dir') ?? 'project',
      communicationTicket: optionNullableString(parsed, 'communication-ticket', null),
    };
    const result = await runPipeline(options, config);
    reportPipelineDegradation(result.manifest);
    process.stdout.write(`${JSON.stringify({ ...result, manifest: result.manifest }, null, 2)}\n`);
    return;
  }
  throw new Error(`Unknown command: ${command}. Run t2c help.`);
}

async function handleWatch(parsed: ParsedArgs, config: ReturnType<typeof getConfig>): Promise<void> {
  const root = path.resolve(parsed.positionals[0] ?? config.root);
  const taskFile = parsed.options.has('task')
    ? optionNullableString(parsed, 'task', null)
    : await pathExists(path.join(root, 'TASK.md')) ? 'TASK.md' : null;
  const pipeline: PipelineOptions = {
    root,
    taskFile,
    todoFile: optionNullableString(parsed, 'todo', 'TODO.md'),
    changelogFile: optionNullableString(parsed, 'changelog', 'CHANGELOG.md'),
    documentPatterns: optionList(parsed, 'docs', config.documentPatterns),
    includeDocumentationLlm: !optionBoolean(parsed, 'no-docs-llm', false),
    outputDir: optionString(parsed, 'out') ?? config.outputDir,
    gitCommitCount: optionNumber(parsed, 'git-count', config.gitCommitCount, 1, 100),
    allowSummaryFallback: optionBoolean(parsed, 'summary-fallback', true),
    includeSummaryLlm: !optionBoolean(parsed, 'no-summary-llm', false),
    nlMode: optionNlMode(parsed, config.nlMode),
    markdownMode: optionLlmMode(parsed, 'markdown-mode', config.markdownMode),
    communicationMode: optionLlmMode(parsed, 'communication-mode', config.communicationMode),
    documentExcludes: optionList(parsed, 'doc-excludes', config.documentExcludes),
    taskSynthesisMode: optionPipelineTaskMode(parsed),
    includeCommunication: !optionBoolean(parsed, 'no-communication', false),
    projectDirectory: optionString(parsed, 'project-dir') ?? 'project',
    communicationTicket: optionNullableString(parsed, 'communication-ticket', null),
  };

  const controller = new AbortController();
  const stop = (): void => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  await watchRepository({
    root,
    pipeline,
    minIntervalMs: optionNumber(parsed, 'interval', 60, 0, 86_400) * 1000,
    scanIntervalMs: optionNumber(parsed, 'scan-interval', 2, 1, 3_600) * 1000,
    runOnStart: !optionBoolean(parsed, 'no-initial-report', false),
    signal: controller.signal,
    onEvent: (event) => process.stderr.write(`${formatWatchEvent(event)}\n`),
  }, config);
}

function formatWatchEvent(event: WatchEvent): string {
  const stamp = new Date().toISOString();
  switch (event.type) {
    case 'ready':
      return `[${stamp}] watching ${event.root}: ${event.files} file(s), ignore sources: ${event.sources.join(', ') || 'none'}`;
    case 'change':
      return `[${stamp}] ${event.delta.total} change(s): ${event.description}`;
    case 'throttled':
      return `[${stamp}] throttled: ${event.pending} pending change(s), next report in ${Math.ceil(event.waitMs / 1000)}s`;
    case 'report:start':
      return `[${stamp}] generating report — ${event.reason}`;
    case 'report:done':
      return `[${stamp}] report ${event.runId} written to ${event.summaryPath} in ${Math.round(event.durationMs)}ms`;
    case 'report:error':
      return `[${stamp}] report failed: ${event.message}`;
    case 'stopped':
      return `[${stamp}] watch stopped`;
  }
}

async function handleDiff(parsed: ParsedArgs, config: ReturnType<typeof getConfig>): Promise<void> {
  const mode = (optionString(parsed, 'mode') ?? 'graph').toLowerCase();
  const out = optionString(parsed, 'out');
  const svg = optionString(parsed, 'svg');
  const html = optionString(parsed, 'html');

  if (mode === 'graph') {
    const beforeFile = parsed.positionals[0];
    const afterFile = parsed.positionals[1];
    if (!beforeFile || !afterFile) {
      throw new Error('Usage: t2c diff <before.graph.json> <after.graph.json> [--out diff.json] [--svg diff.svg]');
    }
    const [before, after] = await Promise.all([
      readJson<IntentGraph>(path.resolve(beforeFile)),
      readJson<IntentGraph>(path.resolve(afterFile)),
    ]);
    const diff = diffIntentGraphs(before, after);
    if (out) await writeJson(path.resolve(out), diff);
    if (svg) await writeText(path.resolve(svg), renderGraphDiffSvg(diff, { maxItems: optionNumber(parsed, 'max-items', 18, 1, 100) }));
    if (!out && !svg) process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
    return;
  }

  const context = optionNumber(parsed, 'context', 3, 0, 100);
  const maxRows = optionNumber(parsed, 'max-rows', 400, 1, 4000);
  let diffs: FileDiff[];
  let title: string;

  if (mode === 'files') {
    const beforeFile = parsed.positionals[0];
    const afterFile = parsed.positionals[1];
    if (!beforeFile || !afterFile) {
      throw new Error('Usage: t2c diff --mode files <before> <after> [--svg diff.svg] [--html diff.html]');
    }
    const [beforeText, afterText] = await Promise.all([
      readText(path.resolve(beforeFile), config.maxFileBytes),
      readText(path.resolve(afterFile), config.maxFileBytes),
    ]);
    diffs = [diffText(beforeText, afterText, { beforePath: beforeFile, afterPath: afterFile, path: afterFile, context })];
    title = `${beforeFile} → ${afterFile}`;
  } else if (mode === 'git') {
    const root = path.resolve(parsed.positionals[0] ?? config.root);
    const result = await collectGitDiff({
      root,
      revision: optionString(parsed, 'rev') ?? 'HEAD',
      staged: optionBoolean(parsed, 'staged', false),
      context,
      maxFiles: optionNumber(parsed, 'max-files', 50, 1, 500),
    });
    for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`);
    diffs = result.diffs;
    title = `git diff ${result.staged ? '--cached ' : ''}${result.revision}`;
  } else {
    throw new Error(`Unknown --mode ${mode}. Expected graph, files or git.`);
  }

  if (out) await writeJson(path.resolve(out), diffs);
  if (svg) await writeText(path.resolve(svg), renderTextDiffSvg(diffs, { title, maxRows }));
  if (html) await writeText(path.resolve(html), renderTextDiffHtml(diffs, { title }));
  if (!out && !svg && !html) {
    for (const diff of diffs) process.stdout.write(renderUnifiedDiff(diff));
  }
}

async function handleReality(parsed: ParsedArgs, config: ReturnType<typeof getConfig>): Promise<void> {
  const graphFile = parsed.positionals[0];
  if (!graphFile) {
    throw new Error('Usage: t2c reality <intent.graph.json> [--diagnostics diagnostics.json] [--svg reality.svg] [--md reality.md]');
  }
  const graph = await readJson<IntentGraph>(path.resolve(graphFile));
  const diagnosticsPath = optionString(parsed, 'diagnostics');
  const diagnostics = diagnosticsPath
    ? await readJson<DiagnosticReport>(path.resolve(diagnosticsPath))
    : diagnoseGraph(graph);
  const view = buildRealityView(graph, diagnostics);

  const out = optionString(parsed, 'out');
  const svg = optionString(parsed, 'svg');
  const markdown = optionString(parsed, 'md');
  if (out) await writeJson(path.resolve(out), view);
  if (svg) {
    await writeText(path.resolve(svg), renderRealitySvg(view, {
      maxRows: optionNumber(parsed, 'max-rows', 30, 1, 500),
      gapsOnly: optionBoolean(parsed, 'gaps-only', false),
    }));
  }
  if (markdown) await writeText(path.resolve(markdown), renderRealityMarkdown(view));
  if (!out && !svg && !markdown) process.stdout.write(renderRealityMarkdown(view));
}

async function handleExtract(parsed: ParsedArgs, config: ReturnType<typeof getConfig>): Promise<void> {
  const extractor = parsed.positionals.shift();
  const root = path.resolve(optionString(parsed, 'root') ?? config.root);
  const out = optionString(parsed, 'out');
  if (extractor === 'nl') {
    const file = parsed.positionals[0];
    const inline = optionString(parsed, 'text');
    if (!file && !inline) throw new Error('Usage: t2c extract nl <file> [--text "..."] [--out records.jsonl]');
    const result = await extractNlIntentAudited(
      { root, sourcePath: file ?? 'cli-input.md', ...(inline ? { text: inline } : {}) },
      config,
      optionNlMode(parsed, config.nlMode),
    );
    await emitExtraction(result, out);
    process.stderr.write(`NL -> DSL: ${result.audit.status} (${result.audit.effectiveMode})\n`);
    return;
  }
  if (extractor === 'git') {
    const result = await extractGitIntent({ root, count: optionNumber(parsed, 'count', config.gitCommitCount, 1, 100) }, config);
    await emitExtraction(result, out);
    return;
  }
  if (extractor === 'ast') {
    const result = await extractAstIntent({ root: path.resolve(parsed.positionals[0] ?? root) }, config);
    await emitExtraction(result, out);
    return;
  }
  if (extractor === 'config') {
    const result = await extractConfigurationIntent(path.resolve(parsed.positionals[0] ?? root), config);
    await emitExtraction(result, out);
    return;
  }
  if (extractor === 'markdown') {
    const result = await extractMarkdownIntentAudited({
      root,
      todoPath: optionNullableString(parsed, 'todo', 'TODO.md'),
      changelogPath: optionNullableString(parsed, 'changelog', 'CHANGELOG.md'),
    }, config, optionLlmMode(parsed, 'markdown-mode', config.markdownMode));
    await emitExtraction(result, out);
    process.stderr.write(`TODO/CHANGELOG -> DSL: ${result.audit.status} (${result.audit.effectiveMode})\n`);
    return;
  }
  if (extractor === 'docs') {
    const result = await extractDocumentationIntent({
      root,
      patterns: optionList(parsed, 'patterns', config.documentPatterns),
      excludes: optionList(parsed, 'excludes', config.documentExcludes),
    }, config);
    await emitExtraction(result, out);
    process.stderr.write(`documentation -> DSL: ${result.audit.status} (${result.audit.effectiveMode}), runtime ${result.audit.runtimeVersion}\n`);
    return;
  }
  if (extractor === 'communication') {
    const result = await extractCommunicationIntentAudited({
      root,
      projectDir: optionString(parsed, 'project-dir') ?? 'project',
      ticket: optionNullableString(parsed, 'ticket', null),
    }, config, optionLlmMode(parsed, 'communication-mode', config.communicationMode));
    await emitExtraction(result, out);
    process.stderr.write(`communication -> DSL: ${result.audit.status} (${result.audit.effectiveMode})\n`);
    return;
  }
  throw new Error('Usage: t2c extract <nl|git|ast|config|markdown|docs|communication> ...');
}

async function handleCommunication(parsed: ParsedArgs, config: ReturnType<typeof getConfig>): Promise<void> {
  const root = path.resolve(parsed.positionals[0] ?? config.root);
  const [communication, git, ast] = await Promise.all([
    extractCommunicationIntentAudited({
      root,
      projectDir: optionString(parsed, 'project-dir') ?? 'project',
      ticket: optionNullableString(parsed, 'ticket', null),
    }, config, optionLlmMode(parsed, 'communication-mode', config.communicationMode)),
    extractGitIntent({ root, count: optionNumber(parsed, 'git-count', config.gitCommitCount, 1, 100) }, config),
    optionBoolean(parsed, 'no-ast', false)
      ? Promise.resolve({ records: [], warnings: [] })
      : extractAstIntent({ root }, config),
  ]);
  for (const warning of [...communication.warnings, ...git.warnings, ...ast.warnings]) process.stderr.write(`warning: ${warning}\n`);
  const graph = linkIntentRecords([...communication.records, ...git.records, ...ast.records]);
  const analysis = analyzeCommunication(graph, new Date().toISOString(), communication.participants);
  const out = optionString(parsed, 'out');
  const markdown = optionString(parsed, 'md');
  const graphOut = optionString(parsed, 'graph');
  if (out) await writeJson(path.resolve(out), analysis);
  if (markdown) await writeText(path.resolve(markdown), renderCommunicationMarkdown(analysis));
  if (graphOut) await writeJson(path.resolve(graphOut), graph);
  if (!out && !markdown && !graphOut) process.stdout.write(renderCommunicationMarkdown(analysis));
}

async function emitExtraction(result: { records: Parameters<typeof writeJsonl>[1]; warnings: string[] }, out: string | null): Promise<void> {
  for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`);
  if (out) {
    await writeJsonl(path.resolve(out), result.records);
    process.stderr.write(`wrote ${result.records.length} records to ${out}\n`);
    return;
  }
  for (const record of result.records) process.stdout.write(`${JSON.stringify(record)}\n`);
}

async function emitJson(value: unknown, out: string | null): Promise<void> {
  if (out) await writeJson(path.resolve(out), value);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function initProject(root: string): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const sourceEnv = path.join(moduleRoot, '.env.example');
  const targetEnv = path.join(root, '.env');
  if (!(await pathExists(targetEnv)) && await pathExists(sourceEnv)) await fs.copyFile(sourceEnv, targetEnv);
  const task = path.join(root, 'TASK.md');
  if (!(await pathExists(task))) {
    await writeText(task, '# Task\n\n- Zdefiniuj cel, zakres, kryteria akceptacji i wymagane dowody.\n');
  }
  // Seed the watch-mode ignore list so `t2c watch` does not rebuild a report
  // because a build artefact changed.
  const sourceIgnore = path.join(moduleRoot, '.intentignore');
  const targetIgnore = path.join(root, '.intentignore');
  if (!(await pathExists(targetIgnore)) && await pathExists(sourceIgnore)) {
    await fs.copyFile(sourceIgnore, targetIgnore);
  }
  await fs.mkdir(path.join(root, '.intent'), { recursive: true });
  process.stdout.write(`Initialized todo2code in ${root}\n`);
}

async function doctor(config: ReturnType<typeof getConfig>): Promise<void> {
  const checks: Record<string, unknown> = { config: configForDisplay(config) };
  checks.node = process.version;
  checks.openRouter = hasOpenRouter(config) ? 'configured' : 'not configured';
  for (const [name, executable, args] of [
    ['git', 'git', ['--version']],
    ['python', config.pythonExecutable, ['--version']],
    ['go', config.goExecutable, ['version']],
    ['java', config.javaExecutable, ['-version']],
    ['cargo', config.cargoExecutable, ['--version']],
    ['php', config.phpExecutable, ['--version']],
  ] as const) {
    try {
      const result = await execFileAsync(executable, args, { encoding: 'utf8' });
      checks[name] = (result.stdout || result.stderr).trim();
    } catch (error) {
      checks[name] = `unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  process.stdout.write(`${JSON.stringify(checks, null, 2)}\n`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index] ?? '';
    if (value === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (value.startsWith('--')) {
      const [rawName = '', inline] = value.slice(2).split('=', 2);
      if (inline !== undefined) {
        options.set(rawName, inline);
      } else {
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith('-')) {
          options.set(rawName, next);
          index += 1;
        } else {
          options.set(rawName, true);
        }
      }
    } else if (value.startsWith('-') && value.length === 2) {
      const aliases: Record<string, string> = { o: 'out', r: 'root', c: 'count', h: 'help' };
      const name = aliases[value.slice(1)] ?? value.slice(1);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('-')) {
        options.set(name, next);
        index += 1;
      } else {
        options.set(name, true);
      }
    } else {
      positionals.push(value);
    }
  }
  return { positionals, options };
}

function optionString(parsed: ParsedArgs, name: string): string | null {
  const value = parsed.options.get(name);
  return typeof value === 'string' ? value : null;
}

function optionNullableString(parsed: ParsedArgs, name: string, fallback: string | null): string | null {
  const value = parsed.options.get(name);
  if (value === true || value === undefined) return value === true ? null : fallback;
  if (typeof value !== 'string' || ['null', 'none', 'false', '-'].includes(value.toLowerCase())) return null;
  return value;
}

function optionBoolean(parsed: ParsedArgs, name: string, fallback: boolean): boolean {
  const value = parsed.options.get(name);
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function optionNumber(parsed: ParsedArgs, name: string, fallback: number, min: number, max: number): number {
  const value = optionString(parsed, name);
  if (value === null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`--${name} must be between ${min} and ${max}`);
  return Math.trunc(number);
}

function optionList(parsed: ParsedArgs, name: string, fallback: string[]): string[] {
  const value = optionString(parsed, name);
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback;
}

function optionNlMode(parsed: ParsedArgs, fallback: NlExtractionMode): NlExtractionMode {
  return optionLlmMode(parsed, 'nl-mode', fallback);
}

function optionLlmMode(parsed: ParsedArgs, name: string, fallback: LlmExtractionMode): LlmExtractionMode {
  const value = optionString(parsed, name)?.toLowerCase() ?? fallback;
  if (value === 'deterministic' || value === 'prefer-llm' || value === 'require-llm') return value;
  throw new Error(`--${name} must be deterministic, prefer-llm or require-llm`);
}

function optionTaskMode(parsed: ParsedArgs): 'prefer-llm' | 'require-llm' {
  const value = optionString(parsed, 'mode')?.toLowerCase() ?? 'prefer-llm';
  if (value === 'prefer-llm' || value === 'require-llm') return value;
  throw new Error('--mode must be prefer-llm or require-llm');
}

function optionSummaryMode(parsed: ParsedArgs): LlmExtractionMode {
  if (parsed.options.has('mode')) return optionLlmMode(parsed, 'mode', 'prefer-llm');
  // Preserve the old flag as a compatibility alias while making the same
  // prefer-llm default used by NL and Markdown explicit for new invocations.
  if (parsed.options.has('fallback')) {
    return optionBoolean(parsed, 'fallback', false) ? 'prefer-llm' : 'require-llm';
  }
  return 'prefer-llm';
}

function optionPipelineTaskMode(parsed: ParsedArgs): 'disabled' | 'prefer-llm' | 'require-llm' {
  const value = optionString(parsed, 'task-mode')?.toLowerCase() ?? 'disabled';
  if (value === 'disabled' || value === 'prefer-llm' || value === 'require-llm') return value;
  throw new Error('--task-mode must be disabled, prefer-llm or require-llm');
}

function reportPipelineDegradation(manifest: import('./core/types.js').PipelineManifest): void {
  if (manifest.status !== 'degraded') return;
  process.stderr.write('DEGRADED: one or more pipeline stages did not complete in the requested mode\n');
  for (const [name, stage] of Object.entries(manifest.stages)) {
    if (stage.degraded) process.stderr.write(`  ${name}: ${stage.status} (${stage.reason?.code ?? 'UNKNOWN'})\n`);
  }
}

function printHelp(): void {
  process.stdout.write(`todo2code (t2c)\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  t2c init [root]\n`);
  process.stdout.write(`  t2c doctor\n`);
  process.stdout.write(`  t2c extract nl <file> [--nl-mode deterministic|prefer-llm|require-llm] [--out nl.intent.jsonl]\n`);
  process.stdout.write(`  t2c extract git [--root .] [--count 10] [--out git.intent.jsonl]\n`);
  process.stdout.write(`  t2c extract ast [root] [--out ast.intent.jsonl]\n`);
  process.stdout.write(`  t2c extract markdown [--todo TODO.md] [--changelog CHANGELOG.md] [--markdown-mode prefer-llm] [--out records.jsonl]\n`);
  process.stdout.write(`  t2c extract docs [--patterns 'README.md,docs/**/*.md'] [--out docs.intent.jsonl]\n`);
  process.stdout.write(`  t2c extract communication [--root .] [--project-dir project] [--ticket TICKET] [--communication-mode deterministic|prefer-llm|require-llm] [--out communication.intent.jsonl]\n`);
  process.stdout.write(`  t2c communication [root] [--project-dir project] [--ticket TICKET] [--communication-mode deterministic|prefer-llm|require-llm] [--no-ast]\n`);
  process.stdout.write(`                    [--out analysis.json] [--md analysis.md] [--graph intent.graph.json]\n`);
  process.stdout.write(`  t2c link <*.intent.jsonl>... [--out intent.graph.json]\n`);
  process.stdout.write(`  t2c diagnose <intent.graph.json> [--out diagnostics.json]\n`);
  process.stdout.write(`  t2c diff <before.graph.json> <after.graph.json> [--out diff.json] [--svg diff.svg]\n`);
  process.stdout.write(`  t2c summarize <intent.graph.json> [--diagnostics diagnostics.json] [--mode deterministic|prefer-llm|require-llm] [--out team-summary.md]\n`);
  process.stdout.write(`  t2c propose-todo <graph.json> --diagnostics diagnostics.json --mode prefer-llm|require-llm --out synthesis.json\n`);
  process.stdout.write(`  t2c render-todo <synthesis.json> --graph graph.json --diagnostics diagnostics.json --todo TODO.md --patch TODO.patch --audit TODO.patch.json\n`);
  process.stdout.write(`  t2c apply-todo --todo TODO.md --patch TODO.patch --audit TODO.patch.json --receipt receipt.json --actor <identity> --approval-hash <sha256>\n`);
  process.stdout.write(`  t2c propose-code-change <graph.json> --diagnostics diagnostics.json [--proposals proposals.json] --out plans.json\n`);
  process.stdout.write(`  t2c render-code-change <plans.json> [--patch CODE_CHANGE.review.md] [--audit CODE_CHANGE.review.json]\n`);
  process.stdout.write(`  t2c propose-source-patch <plan.json|plans.json> --out source-patches.json\n`);
  process.stdout.write(`  t2c apply-source-patch <patch.json> --actor <id> --approval-hash <sha256> [--receipt receipt.json]\n`);
  process.stdout.write(`  t2c evaluate-code-change <plan.json> --before-graph before.json --after-graph after.json --out acceptance.json\n`);
  process.stdout.write(`  t2c close-code-change <plan.json|plans.json> --before-graph before.json --after-graph after.json --out close.json\n`);
  process.stdout.write(`  t2c diff --mode files <before> <after> [--svg diff.svg] [--html diff.html] [--context 3]\n`);
  process.stdout.write(`  t2c diff --mode git [root] [--rev HEAD] [--staged] [--svg diff.svg] [--html diff.html]\n`);
  process.stdout.write(`  t2c reality <intent.graph.json> [--diagnostics diagnostics.json] [--svg reality.svg]\n`);
  process.stdout.write(`               [--md reality.md] [--gaps-only] [--max-rows 30]\n`);
  process.stdout.write(`  t2c watch [root] [--interval 60] [--scan-interval 2] [--no-initial-report]\n`);
  process.stdout.write(`               [--task TASK.md|none] [--nl-mode prefer-llm] [--markdown-mode prefer-llm] [--todo TODO.md]\n`);
  process.stdout.write(`               [--no-docs-llm] [--no-summary-llm] [--out .intent]\n`);
  process.stdout.write(`  t2c pipeline [root] [--task TASK.md] [--todo TODO.md] [--changelog CHANGELOG.md]\n`);
  process.stdout.write(`               [--nl-mode prefer-llm] [--markdown-mode prefer-llm] [--docs 'README.md,docs/**/*.md'] [--doc-excludes '...']\n`);
  process.stdout.write(`               [--no-docs-llm] [--no-summary-llm] [--task-mode disabled|prefer-llm|require-llm]\n`);
  process.stdout.write(`               [--project-dir project] [--communication-ticket TICKET] [--communication-mode deterministic|prefer-llm|require-llm] [--no-communication] [--out .intent]\n`);
  process.stdout.write(`  t2c compare-workspace [root] [--base origin/main] [--task TASK.md] [--markdown-mode prefer-llm] [--docs-llm]\n`);
  process.stdout.write(`               [--docs 'README.md,docs/**/*.md'] [--doc-excludes '...'] [--out .intent]\n`);
  process.stdout.write(`  t2c mcp\n`);
  process.stdout.write(`  t2c a2a\n\n`);
  process.stdout.write(`LLM boundary: NL, TODO/CHANGELOG and communication enrichment, documentation extraction, task synthesis and summarization are the audited OpenRouter stages.\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`t2c: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
