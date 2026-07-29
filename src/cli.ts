#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { configForDisplay, getConfig, hasOpenRouter, loadEnvFile } from './config/env.js';
import { pathExists, readJson, readJsonl, readText, writeJson, writeJsonl, writeText } from './core/io.js';
import type { DiagnosticReport, IntentGraph, PipelineOptions } from './core/types.js';
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
import { extractDocumentationIntent } from './extractors/docs-llm.js';
import { extractGitIntent } from './extractors/git.js';
import { extractMarkdownIntent } from './extractors/markdown.js';
import { extractNlIntent } from './extractors/nl.js';
import { diagnoseGraph } from './graph/diagnostics.js';
import { diffIntentGraphs, renderGraphDiffSvg } from './graph/diff.js';
import { linkIntentRecords } from './graph/linker.js';
import { startA2aServer } from './interfaces/a2a.js';
import { startMcpServer } from './interfaces/mcp.js';
import { runPipeline } from './pipeline/run.js';
import { summarizeGraph } from './summary/summarizer.js';

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
    process.stdout.write('todo2code 0.2.0\n');
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
    process.stdout.write('todo2code 0.2.0\n');
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
    if (!graphFile) throw new Error('Usage: t2c summarize <intent.graph.json> [--diagnostics diagnostics.json] [--fallback] [--out summary.md]');
    const graph = await readJson<IntentGraph>(path.resolve(graphFile));
    const diagnosticsPath = optionString(parsed, 'diagnostics');
    const diagnostics = diagnosticsPath
      ? await readJson<DiagnosticReport>(path.resolve(diagnosticsPath))
      : diagnoseGraph(graph);
    const result = await summarizeGraph(graph, diagnostics, config, {
      allowDeterministicFallback: optionBoolean(parsed, 'fallback', false),
    });
    for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`);
    const out = optionString(parsed, 'out');
    if (out) await writeText(path.resolve(out), result.markdown);
    else process.stdout.write(result.markdown);
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
    };
    const result = await runPipeline(options, config);
    process.stdout.write(`${JSON.stringify({ ...result, manifest: result.manifest }, null, 2)}\n`);
    return;
  }
  throw new Error(`Unknown command: ${command}. Run t2c help.`);
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
    const result = await extractNlIntent({ root, sourcePath: file ?? 'cli-input.md', ...(inline ? { text: inline } : {}) }, config);
    await emitExtraction(result, out);
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
  if (extractor === 'markdown') {
    const result = await extractMarkdownIntent({
      root,
      todoPath: optionNullableString(parsed, 'todo', 'TODO.md'),
      changelogPath: optionNullableString(parsed, 'changelog', 'CHANGELOG.md'),
    }, config);
    await emitExtraction(result, out);
    return;
  }
  if (extractor === 'docs') {
    const result = await extractDocumentationIntent({
      root,
      patterns: optionList(parsed, 'patterns', config.documentPatterns),
      excludes: optionList(parsed, 'excludes', config.documentExcludes),
    }, config);
    await emitExtraction(result, out);
    return;
  }
  throw new Error('Usage: t2c extract <nl|git|ast|markdown|docs> ...');
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

function printHelp(): void {
  process.stdout.write(`todo2code (t2c)\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  t2c init [root]\n`);
  process.stdout.write(`  t2c doctor\n`);
  process.stdout.write(`  t2c extract nl <file> [--root .] [--out nl.intent.jsonl]\n`);
  process.stdout.write(`  t2c extract git [--root .] [--count 10] [--out git.intent.jsonl]\n`);
  process.stdout.write(`  t2c extract ast [root] [--out ast.intent.jsonl]\n`);
  process.stdout.write(`  t2c extract markdown [--todo TODO.md] [--changelog CHANGELOG.md] [--out records.jsonl]\n`);
  process.stdout.write(`  t2c extract docs [--patterns 'README.md,docs/**/*.md'] [--out docs.intent.jsonl]\n`);
  process.stdout.write(`  t2c link <*.intent.jsonl>... [--out intent.graph.json]\n`);
  process.stdout.write(`  t2c diagnose <intent.graph.json> [--out diagnostics.json]\n`);
  process.stdout.write(`  t2c diff <before.graph.json> <after.graph.json> [--out diff.json] [--svg diff.svg]\n`);
  process.stdout.write(`  t2c summarize <intent.graph.json> [--diagnostics diagnostics.json] [--fallback] [--out team-summary.md]\n`);
  process.stdout.write(`  t2c diff --mode files <before> <after> [--svg diff.svg] [--html diff.html] [--context 3]\n`);
  process.stdout.write(`  t2c diff --mode git [root] [--rev HEAD] [--staged] [--svg diff.svg] [--html diff.html]\n`);
  process.stdout.write(`  t2c reality <intent.graph.json> [--diagnostics diagnostics.json] [--svg reality.svg]\n`);
  process.stdout.write(`               [--md reality.md] [--gaps-only] [--max-rows 30]\n`);
  process.stdout.write(`  t2c pipeline [root] [--task TASK.md] [--todo TODO.md] [--changelog CHANGELOG.md]\n`);
  process.stdout.write(`               [--docs 'README.md,docs/**/*.md'] [--no-docs-llm] [--out .intent]\n`);
  process.stdout.write(`  t2c mcp\n`);
  process.stdout.write(`  t2c a2a\n\n`);
  process.stdout.write(`LLM boundary: only 'extract docs' and 'summarize' call OpenRouter.\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`t2c: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
