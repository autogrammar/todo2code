import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { hasOpenRouter } from '../config/env.js';
import { createIntentId, newRunId } from '../core/id.js';
import { ensureDir, pathExists, writeJson, writeJsonl, writeText } from '../core/io.js';
import type {
  Diagnostic,
  DiagnosticReport,
  IntentRecord,
  PipelineManifest,
  PipelineOptions,
} from '../core/types.js';
import { extractAstIntent } from '../extractors/ast.js';
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntent } from '../extractors/markdown.js';
import { extractNlIntent } from '../extractors/nl.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import { summarizeGraph } from '../summary/summarizer.js';

export interface PipelineResult {
  runDirectory: string;
  manifest: PipelineManifest;
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
}

export async function runPipeline(options: PipelineOptions, config: T2CConfig): Promise<PipelineResult> {
  const root = path.resolve(options.root);
  if (!(await pathExists(root))) throw new Error(`Root does not exist: ${root}`);
  const runId = newRunId();
  const baseOutput = path.resolve(root, options.outputDir);
  const runDirectory = path.join(baseOutput, 'runs', runId);
  await ensureDir(runDirectory);

  const warnings: string[] = [];
  const bySource: Record<string, IntentRecord[]> = {
    nl: [],
    git: [],
    ast: [],
    todo: [],
    changelog: [],
    document: [],
  };

  if (options.taskFile) {
    const result = await extractNlIntent({ root, sourcePath: options.taskFile }, config);
    bySource.nl = result.records;
    warnings.push(...result.warnings);
  }

  const git = await extractGitIntent({ root, count: options.gitCommitCount }, config);
  bySource.git = git.records;
  warnings.push(...git.warnings);

  const ast = await extractAstIntent({ root }, config);
  bySource.ast = ast.records;
  warnings.push(...ast.warnings);

  const markdown = await extractMarkdownIntent({ root, todoPath: options.todoFile, changelogPath: options.changelogFile }, config);
  bySource.todo = markdown.records.filter((record) => record.source.kind === 'todo');
  bySource.changelog = markdown.records.filter((record) => record.source.kind === 'changelog');
  warnings.push(...markdown.warnings);

  let documentationLlmUsed = false;
  if (options.includeDocumentationLlm) {
    if (hasOpenRouter(config)) {
      const docs = await extractDocumentationIntent({ root, patterns: options.documentPatterns }, config);
      bySource.document = docs.records;
      warnings.push(...docs.warnings);
      documentationLlmUsed = true;
    } else {
      warnings.push('OPENROUTER_API_KEY is not configured; documentation -> Intent DSL was skipped');
    }
  }

  const allRecords = Object.values(bySource).flat();
  const generatedAt = new Date().toISOString();
  const graph = linkIntentRecords(allRecords, generatedAt);
  const diagnostics = diagnoseGraph(graph, generatedAt);
  if (options.includeDocumentationLlm && !hasOpenRouter(config)) appendLlmNotConfigured(diagnostics);
  const summary = await summarizeGraph(graph, diagnostics, config, {
    allowDeterministicFallback: options.allowSummaryFallback,
  });
  warnings.push(...summary.warnings);

  const files: Record<string, string> = {};
  for (const [source, records] of Object.entries(bySource)) {
    const filePath = path.join(runDirectory, `${source}.intent.jsonl`);
    await writeJsonl(filePath, records);
    files[`${source}Intent`] = path.relative(root, filePath).replace(/\\/g, '/');
  }
  const graphPath = path.join(runDirectory, 'intent.graph.json');
  const diagnosticsPath = path.join(runDirectory, 'diagnostics.json');
  const summaryPath = path.join(runDirectory, 'team-summary.md');
  await writeJson(graphPath, graph);
  await writeJson(diagnosticsPath, diagnostics);
  await writeText(summaryPath, summary.markdown);
  files.graph = path.relative(root, graphPath).replace(/\\/g, '/');
  files.diagnostics = path.relative(root, diagnosticsPath).replace(/\\/g, '/');
  files.summary = path.relative(root, summaryPath).replace(/\\/g, '/');

  const manifest: PipelineManifest = {
    schemaVersion: 't2c.run/v1',
    runId,
    root,
    createdAt: generatedAt,
    graphFingerprint: graph.fingerprint,
    files,
    warnings: [...new Set(warnings)].sort(),
    llm: {
      documentationExtraction: documentationLlmUsed,
      summary: summary.llmUsed,
    },
  };
  await writeJson(path.join(runDirectory, 'manifest.json'), manifest);
  await writeJson(path.join(baseOutput, 'latest.json'), {
    runId,
    runDirectory: path.relative(root, runDirectory).replace(/\\/g, '/'),
    graphFingerprint: graph.fingerprint,
    summary: files.summary,
  });
  return { runDirectory, manifest, graphPath, diagnosticsPath, summaryPath };
}

function appendLlmNotConfigured(report: DiagnosticReport): void {
  const diagnostic: Diagnostic = {
    id: createIntentId({ code: 'LLM_NOT_CONFIGURED', graph: report.graphFingerprint }, 'DIAG'),
    code: 'LLM_NOT_CONFIGURED',
    severity: 'warning',
    title: 'OpenRouter nie jest skonfigurowany',
    detail: 'Etap dokumentacja -> Intent DSL został pominięty, ponieważ brakuje OPENROUTER_API_KEY.',
    recordIds: [],
    suggestedAction: 'Ustawić OPENROUTER_API_KEY w .env i ponownie uruchomić pipeline.',
  };
  report.diagnostics.unshift(diagnostic);
  report.counts.warning += 1;
}
