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
import { extractMarkdownIntentAudited, MarkdownLlmRequiredError } from '../extractors/markdown-llm.js';
import { extractNlIntentAudited, NlLlmRequiredError } from '../extractors/nl-llm.js';
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

  try {

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
        targetHints: collectTargetHints(Object.values(bySource).flat()),
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
        responses: docs.responses,
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
        responses: [],
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
        responses: [],
      }
    : summary.llmUsed
    ? {
        status: 'succeeded', requestedMode: 'llm', effectiveMode: 'llm', degraded: false,
        recordCount: 0, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
        durationMs: Date.now() - summaryStartedAt, reason: null, responses: summary.responses,
      }
    : {
        status: 'fallback', requestedMode: 'llm', effectiveMode: 'deterministic', degraded: true,
        recordCount: 0, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
        durationMs: Date.now() - summaryStartedAt,
        reason: { code: hasOpenRouter(config) ? 'LLM_UNAVAILABLE' : 'LLM_NOT_CONFIGURED', message: summary.warnings[0] ?? 'Deterministic summary fallback was used' },
        responses: [],
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

  const configuration = manifestConfiguration(options, config);
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
    failure: null,
    runtime: { name: 'todo2code', version: T2C_VERSION },
    configuration,
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
  } catch (error) {
    if (error instanceof NlLlmRequiredError || error instanceof MarkdownLlmRequiredError) {
      await persistFailedRun(runId, root, runDirectory, options, config, error);
    }
    throw error;
  }
}

function manifestConfiguration(options: PipelineOptions, config: T2CConfig): PipelineManifest['configuration'] {
  const configuration = {
    nlMode: options.nlMode ?? config.nlMode,
    markdownMode: options.markdownMode ?? config.markdownMode,
    gitCommitCount: options.gitCommitCount,
    maxFileBytes: config.maxFileBytes,
    documentConcurrency: config.documentConcurrency,
    documentChunkChars: config.documentChunkChars,
    documentMaxChunks: config.documentMaxChunks,
    documentRecordsPerChunk: config.documentRecordsPerChunk,
    documentTimeoutMs: config.documentTimeoutMs,
    summaryLlm: options.includeSummaryLlm !== false,
    documentPatterns: [...options.documentPatterns],
    documentExcludes: [...(options.documentExcludes ?? config.documentExcludes)],
    adapters: {
      python: { enabled: config.enablePythonAst, executable: config.pythonExecutable },
      go: { enabled: config.enableGoAst, executable: config.goExecutable },
      java: { enabled: config.enableJavaAst, executable: config.javaExecutable },
      rust: { enabled: config.enableRustAst, executable: config.cargoExecutable },
      tensorflow: {
        enabled: config.enableTensorFlow,
        modelPath: config.tensorflowModelPath,
        modulePath: config.tensorflowModulePath,
        labels: [...config.tensorflowLabels],
      },
    },
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
  return { fingerprint: sha256(stableStringify(configuration)), ...configuration };
}

function collectTargetHints(records: IntentRecord[]): { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] } {
  const values = <K extends keyof IntentRecord['statement']['target']>(key: K): string[] => [
    ...new Set(records.flatMap((record) => record.statement.target[key])),
  ].slice(0, 200);
  return {
    paths: values('paths'),
    symbols: values('symbols'),
    tickets: values('tickets'),
    versions: values('versions'),
  };
}

async function persistFailedRun(
  runId: string,
  root: string,
  runDirectory: string,
  options: PipelineOptions,
  config: T2CConfig,
  error: NlLlmRequiredError | MarkdownLlmRequiredError,
): Promise<void> {
  const failedStage = error instanceof NlLlmRequiredError ? 'naturalLanguageExtraction' : 'markdownExtraction';
  const aborted = (stage: string): PipelineStageAudit => ({
    ...skippedAudit('disabled', `Pipeline aborted before ${stage}`),
    reason: { code: 'PIPELINE_ABORTED', message: `Pipeline aborted before ${stage}` },
  });
  const stages: PipelineManifest['stages'] = {
    naturalLanguageExtraction: failedStage === 'naturalLanguageExtraction' ? error.audit : aborted('natural-language extraction'),
    markdownExtraction: failedStage === 'markdownExtraction' ? error.audit : aborted('Markdown extraction'),
    documentationExtraction: aborted('documentation extraction'),
    summary: aborted('summary generation'),
  };
  const reason = error.audit.reason ?? { code: 'LLM_REQUIRED_FAILED', message: error.message };
  const manifest: PipelineManifest = {
    schemaVersion: 't2c.run/v1',
    runId,
    root,
    createdAt: new Date().toISOString(),
    graphFingerprint: null,
    files: {},
    warnings: [error.message],
    status: 'failed',
    failure: { stage: failedStage, code: reason.code, message: reason.message },
    runtime: { name: 'todo2code', version: T2C_VERSION },
    configuration: manifestConfiguration(options, config),
    stages,
    llm: {
      naturalLanguageExtraction: stages.naturalLanguageExtraction.effectiveMode === 'llm',
      markdownExtraction: stages.markdownExtraction.effectiveMode === 'llm',
      documentationExtraction: false,
      summary: false,
    },
  };
  await writeJson(path.join(runDirectory, 'manifest.json'), manifest);
}

function skippedAudit(requestedMode: PipelineStageAudit['requestedMode'], message: string): PipelineStageAudit {
  return {
    status: 'skipped', requestedMode, effectiveMode: 'none', degraded: false,
    recordCount: 0, warningCount: 0, model: null, durationMs: 0,
    reason: { code: 'STAGE_SKIPPED', message },
    responses: [],
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
