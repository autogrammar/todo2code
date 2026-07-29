import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { hasOpenRouter } from '../config/env.js';
import { createIntentId, newRunId, sha256, stableStringify } from '../core/id.js';
import { ensureDir, pathExists, writeJson, writeJsonl, writeText } from '../core/io.js';
import type {
  Diagnostic,
  DiagnosticReport,
  IntentRecord,
  PipelineManifest,
  PipelineOptions,
  PipelineStageAudit,
} from '../core/types.js';
import { extractAstIntent } from '../extractors/ast.js';
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntentAudited } from '../extractors/markdown-llm.js';
import { extractNlIntentAudited } from '../extractors/nl-llm.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import { summarizeGraph } from '../summary/summarizer.js';
import { T2C_VERSION } from '../version.js';

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

  let naturalLanguageAudit = skippedAudit('disabled', 'No NL task file was selected');

  if (options.taskFile) {
    const result = await extractNlIntentAudited(
      { root, sourcePath: options.taskFile },
      config,
      options.nlMode ?? config.nlMode,
    );
    bySource.nl = result.records;
    warnings.push(...result.warnings);
    naturalLanguageAudit = result.audit;
  }

  const git = await extractGitIntent({ root, count: options.gitCommitCount }, config);
  bySource.git = git.records;
  warnings.push(...git.warnings);

  const ast = await extractAstIntent({ root }, config);
  bySource.ast = ast.records;
  warnings.push(...ast.warnings);

  const markdown = await extractMarkdownIntentAudited(
    { root, todoPath: options.todoFile, changelogPath: options.changelogFile },
    config,
    options.markdownMode ?? config.markdownMode,
  );
  bySource.todo = markdown.records.filter((record) => record.source.kind === 'todo');
  bySource.changelog = markdown.records.filter((record) => record.source.kind === 'changelog');
  warnings.push(...markdown.warnings);

  let documentationAudit = skippedAudit('disabled', 'Documentation LLM extraction was disabled');
  if (options.includeDocumentationLlm) {
    if (hasOpenRouter(config)) {
      const docsStartedAt = Date.now();
      const docs = await extractDocumentationIntent({
        root,
        patterns: options.documentPatterns,
        excludes: options.documentExcludes ?? config.documentExcludes,
      }, config);
      bySource.document = docs.records;
      warnings.push(...docs.warnings);
      const status = docs.warnings.length === 0 ? 'succeeded' : docs.records.length > 0 ? 'partial' : 'failed';
      documentationAudit = {
        status,
        requestedMode: 'llm',
        effectiveMode: 'llm',
        degraded: docs.warnings.length > 0,
        recordCount: docs.records.length,
        warningCount: docs.warnings.length,
        model: config.openRouter.documentModel,
        durationMs: Date.now() - docsStartedAt,
        reason: docs.warnings.length ? { code: 'LLM_CHUNK_FAILURE', message: `${docs.warnings.length} documentation chunk(s) failed` } : null,
      };
    } else {
      const message = 'OPENROUTER_API_KEY is not configured; documentation -> Intent DSL was skipped';
      warnings.push(message);
      documentationAudit = {
        ...skippedAudit('llm', message),
        status: 'failed',
        degraded: true,
        model: config.openRouter.documentModel,
        reason: { code: 'LLM_NOT_CONFIGURED', message },
      };
    }
  }

  const allRecords = Object.values(bySource).flat();
  const generatedAt = new Date().toISOString();
  const graph = linkIntentRecords(allRecords, generatedAt);
  const diagnostics = diagnoseGraph(graph, generatedAt);
  if (options.includeDocumentationLlm && !hasOpenRouter(config)) appendLlmNotConfigured(diagnostics);
  const summaryStartedAt = Date.now();
  const includeSummaryLlm = options.includeSummaryLlm !== false;
  const summary = await summarizeGraph(graph, diagnostics, config, {
    allowDeterministicFallback: options.allowSummaryFallback,
    preferLlm: includeSummaryLlm,
  });
  warnings.push(...summary.warnings);
  const summaryAudit: PipelineStageAudit = !includeSummaryLlm
    ? {
        status: 'skipped', requestedMode: 'deterministic', effectiveMode: 'deterministic', degraded: false,
        recordCount: 0, warningCount: 0, model: null,
        durationMs: Date.now() - summaryStartedAt,
        reason: { code: 'LLM_DISABLED', message: 'LLM summary was disabled; generated the deterministic report' },
      }
    : summary.llmUsed
    ? {
        status: 'succeeded', requestedMode: 'llm', effectiveMode: 'llm', degraded: false,
        recordCount: 0, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
        durationMs: Date.now() - summaryStartedAt, reason: null,
      }
    : {
        status: 'fallback', requestedMode: 'llm', effectiveMode: 'deterministic', degraded: true,
        recordCount: 0, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
        durationMs: Date.now() - summaryStartedAt,
        reason: { code: hasOpenRouter(config) ? 'LLM_UNAVAILABLE' : 'LLM_NOT_CONFIGURED', message: summary.warnings[0] ?? 'Deterministic summary fallback was used' },
      };

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

  const documentExcludes = options.documentExcludes ?? config.documentExcludes;
  const configuration = {
    nlMode: options.nlMode ?? config.nlMode,
    markdownMode: options.markdownMode ?? config.markdownMode,
    gitCommitCount: options.gitCommitCount,
    maxFileBytes: config.maxFileBytes,
    documentConcurrency: config.documentConcurrency,
    summaryLlm: includeSummaryLlm,
    documentPatterns: [...options.documentPatterns],
    documentExcludes: [...documentExcludes],
    llm: {
      configured: hasOpenRouter(config),
      baseUrl: config.openRouter.baseUrl,
      nlModel: config.openRouter.nlModel,
      markdownModel: config.openRouter.markdownModel,
      documentModel: config.openRouter.documentModel,
      summaryModel: config.openRouter.summaryModel,
      timeoutMs: config.openRouter.timeoutMs,
      maxTokens: config.openRouter.maxTokens,
      temperature: config.openRouter.temperature,
      requireStructuredOutput: config.openRouter.requireStructuredOutput,
      responseHealing: config.openRouter.responseHealing,
    },
  };
  const stageAudits = {
    naturalLanguageExtraction: naturalLanguageAudit,
    markdownExtraction: markdown.audit,
    documentationExtraction: documentationAudit,
    summary: summaryAudit,
  };
  const manifest: PipelineManifest = {
    schemaVersion: 't2c.run/v1',
    runId,
    root,
    createdAt: generatedAt,
    graphFingerprint: graph.fingerprint,
    files,
    warnings: [...new Set(warnings)].sort(),
    status: Object.values(stageAudits).some((stage) => stage.degraded) ? 'degraded' : 'succeeded',
    runtime: { name: 'todo2code', version: T2C_VERSION },
    configuration: {
      fingerprint: sha256(stableStringify(configuration)),
      ...configuration,
    },
    stages: stageAudits,
    llm: {
      naturalLanguageExtraction: naturalLanguageAudit.effectiveMode === 'llm',
      markdownExtraction: markdown.audit.effectiveMode === 'llm',
      documentationExtraction: documentationAudit.effectiveMode === 'llm',
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

function skippedAudit(requestedMode: PipelineStageAudit['requestedMode'], message: string): PipelineStageAudit {
  return {
    status: 'skipped', requestedMode, effectiveMode: 'none', degraded: false,
    recordCount: 0, warningCount: 0, model: null, durationMs: 0,
    reason: { code: 'STAGE_SKIPPED', message },
  };
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
