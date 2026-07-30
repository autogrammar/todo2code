import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { hasOpenRouter } from '../config/env.js';
import { createIntentId, newRunId, sha256, stableStringify } from '../core/id.js';
import { ensureDir, pathExists, readText, writeJson, writeJsonl, writeText } from '../core/io.js';
import type {
  Diagnostic,
  DiagnosticReport,
  IntentRecord,
  PipelineManifest,
  PipelineFailureStage,
  PipelineOptions,
  PipelineStageAudit,
} from '../core/types.js';
import { extractAstIntent } from '../extractors/ast.js';
import { DocumentationLlmRequiredError, extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntentAudited, MarkdownLlmRequiredError } from '../extractors/markdown-llm.js';
import { extractNlIntentAudited, NlLlmRequiredError } from '../extractors/nl-llm.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import { summarizeGraph } from '../summary/summarizer.js';
import { synthesizeTodoProposals, TaskSynthesisRequiredError, type AuditedTaskSynthesisResult } from '../synthesis/tasks-llm.js';
import { createTodoPatch, type CreatedTodoPatch } from '../synthesis/todo-patch.js';
import { T2C_VERSION } from '../version.js';

export interface PipelineResult {
  runDirectory: string;
  manifest: PipelineManifest;
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
  taskSynthesisPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
}

export async function runPipeline(options: PipelineOptions, config: T2CConfig): Promise<PipelineResult> {
  const root = path.resolve(options.root);
  if (!(await pathExists(root))) throw new Error(`Root does not exist: ${root}`);
  const runId = newRunId();
  const baseOutput = path.resolve(root, options.outputDir);
  const runDirectory = path.join(baseOutput, 'runs', runId);
  await ensureDir(runDirectory);
  let activeStage: PipelineFailureStage = 'setup';
  const completedStages: Partial<PipelineManifest['stages']> = {};

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
    activeStage = 'naturalLanguageExtraction';
    const result = await extractNlIntentAudited(
      { root, sourcePath: options.taskFile },
      config,
      options.nlMode ?? config.nlMode,
    );
    bySource.nl = result.records;
    warnings.push(...result.warnings);
    naturalLanguageAudit = result.audit;
  }
  completedStages.naturalLanguageExtraction = naturalLanguageAudit;

  activeStage = 'gitExtraction';
  const git = await extractGitIntent({ root, count: options.gitCommitCount }, config);
  bySource.git = git.records;
  warnings.push(...git.warnings);

  activeStage = 'astExtraction';
  const ast = await extractAstIntent({ root }, config);
  bySource.ast = ast.records;
  warnings.push(...ast.warnings);

  activeStage = 'markdownExtraction';
  const markdown = await extractMarkdownIntentAudited(
    { root, todoPath: options.todoFile, changelogPath: options.changelogFile },
    config,
    options.markdownMode ?? config.markdownMode,
  );
  bySource.todo = markdown.records.filter((record) => record.source.kind === 'todo');
  bySource.changelog = markdown.records.filter((record) => record.source.kind === 'changelog');
  warnings.push(...markdown.warnings);
  completedStages.markdownExtraction = markdown.audit;

  let documentationAudit = skippedAudit('disabled', 'Documentation LLM extraction was disabled');
  if (options.includeDocumentationLlm) {
    if (hasOpenRouter(config)) {
      activeStage = 'documentationExtraction';
      const docs = await extractDocumentationIntent({
        root,
        patterns: options.documentPatterns,
        excludes: options.documentExcludes ?? config.documentExcludes,
        targetHints: collectTargetHints(Object.values(bySource).flat()),
      }, config);
      bySource.document = docs.records;
      warnings.push(...docs.warnings);
      documentationAudit = docs.audit;
    } else {
      const message = 'OPENROUTER_API_KEY is not configured; documentation -> Intent DSL was skipped';
      warnings.push(message);
      documentationAudit = {
        ...skippedAudit('llm', message),
        configuration: openRouterAuditConfiguration(config, config.openRouter.documentModel, config.documentTimeoutMs),
        status: 'failed',
        degraded: true,
        model: config.openRouter.documentModel,
        reason: { code: 'LLM_NOT_CONFIGURED', message },
        responses: [],
      };
    }
  }
  completedStages.documentationExtraction = documentationAudit;

  activeStage = 'linking';
  const allRecords = Object.values(bySource).flat();
  const generatedAt = new Date().toISOString();
  const graph = linkIntentRecords(allRecords, generatedAt);
  activeStage = 'diagnostics';
  const diagnostics = diagnoseGraph(graph, generatedAt);
  if (options.includeDocumentationLlm && !hasOpenRouter(config)) appendLlmNotConfigured(diagnostics);
  const taskSynthesisMode = options.taskSynthesisMode ?? 'disabled';
  let taskSynthesis: AuditedTaskSynthesisResult | null = null;
  let todoPatch: CreatedTodoPatch | null = null;
  let taskSynthesisAudit = skippedAudit('disabled', 'Task synthesis was disabled');
  if (taskSynthesisMode !== 'disabled') {
    activeStage = 'taskSynthesis';
    taskSynthesis = await synthesizeTodoProposals(graph, diagnostics, config, taskSynthesisMode);
    warnings.push(...taskSynthesis.warnings);
    taskSynthesisAudit = taskSynthesis.audit;
    completedStages.taskSynthesis = taskSynthesisAudit;
    if (!options.todoFile) throw new Error('Task synthesis rendering requires a TODO source file');
    activeStage = 'todoRendering';
    const todoContent = await readText(path.resolve(root, options.todoFile), config.maxFileBytes);
    todoPatch = createTodoPatch({
      todoPath: path.relative(root, path.resolve(root, options.todoFile)).replace(/\\/g, '/'),
      todoContent,
      graph,
      diagnostics,
      conclusions: taskSynthesis.conclusions,
      proposals: taskSynthesis.proposals,
      validation: taskSynthesis.validation,
      synthesisAudit: taskSynthesis.audit,
    });
  }
  completedStages.taskSynthesis = taskSynthesisAudit;
  activeStage = 'summary';
  const summaryStartedAt = Date.now();
  const includeSummaryLlm = options.includeSummaryLlm !== false;
  const summary = await summarizeGraph(graph, diagnostics, config, {
    allowDeterministicFallback: options.allowSummaryFallback,
    preferLlm: includeSummaryLlm,
  });
  warnings.push(...summary.warnings);
  const summaryAudit: PipelineStageAudit = !includeSummaryLlm
    ? {
        runtimeVersion: T2C_VERSION,
        configuration: openRouterAuditConfiguration(config, null),
        status: 'skipped', requestedMode: 'deterministic', effectiveMode: 'deterministic', degraded: false,
        recordCount: 0, warningCount: 0, model: null,
        durationMs: Date.now() - summaryStartedAt,
        reason: { code: 'LLM_DISABLED', message: 'LLM summary was disabled; generated the deterministic report' },
        responses: [],
      }
    : summary.llmUsed
    ? {
        runtimeVersion: T2C_VERSION,
        configuration: openRouterAuditConfiguration(config, config.openRouter.summaryModel),
        status: 'succeeded', requestedMode: 'llm', effectiveMode: 'llm', degraded: false,
        recordCount: 0, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
        durationMs: Date.now() - summaryStartedAt, reason: null, responses: summary.responses,
      }
    : {
        runtimeVersion: T2C_VERSION,
        configuration: openRouterAuditConfiguration(config, config.openRouter.summaryModel),
        status: 'fallback', requestedMode: 'llm', effectiveMode: 'deterministic', degraded: true,
        recordCount: 0, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
        durationMs: Date.now() - summaryStartedAt,
        reason: { code: hasOpenRouter(config) ? 'LLM_UNAVAILABLE' : 'LLM_NOT_CONFIGURED', message: summary.warnings[0] ?? 'Deterministic summary fallback was used' },
        responses: [],
      };
  completedStages.summary = summaryAudit;

  activeStage = 'persistence';
  const files: Record<string, string> = {};
  for (const [source, records] of Object.entries(bySource)) {
    const filePath = path.join(runDirectory, `${source}.intent.jsonl`);
    await writeJsonl(filePath, records);
    files[`${source}Intent`] = path.relative(root, filePath).replace(/\\/g, '/');
  }
  const graphPath = path.join(runDirectory, 'intent.graph.json');
  const diagnosticsPath = path.join(runDirectory, 'diagnostics.json');
  const summaryPath = path.join(runDirectory, 'team-summary.md');
  const taskSynthesisPath = taskSynthesis ? path.join(runDirectory, 'task-synthesis.json') : null;
  const todoValidationPath = taskSynthesis ? path.join(runDirectory, 'todo-validation.json') : null;
  const todoPatchPath = todoPatch ? path.join(runDirectory, 'TODO.patch') : null;
  const todoPatchAuditPath = todoPatch ? path.join(runDirectory, 'TODO.patch.json') : null;
  await writeJson(graphPath, graph);
  await writeJson(diagnosticsPath, diagnostics);
  await writeText(summaryPath, summary.markdown);
  if (taskSynthesisPath && todoValidationPath && todoPatchPath && todoPatchAuditPath && taskSynthesis && todoPatch) {
    await Promise.all([
      writeJson(taskSynthesisPath, taskSynthesis),
      writeJson(todoValidationPath, taskSynthesis.validation),
      writeText(todoPatchPath, todoPatch.markdown),
      writeJson(todoPatchAuditPath, todoPatch.artifact),
    ]);
    files.taskSynthesis = path.relative(root, taskSynthesisPath).replace(/\\/g, '/');
    files.todoValidation = path.relative(root, todoValidationPath).replace(/\\/g, '/');
    files.todoPatch = path.relative(root, todoPatchPath).replace(/\\/g, '/');
    files.todoPatchAudit = path.relative(root, todoPatchAuditPath).replace(/\\/g, '/');
  }
  files.graph = path.relative(root, graphPath).replace(/\\/g, '/');
  files.diagnostics = path.relative(root, diagnosticsPath).replace(/\\/g, '/');
  files.summary = path.relative(root, summaryPath).replace(/\\/g, '/');

  const configuration = manifestConfiguration(options, config);
  const stageAudits = {
    naturalLanguageExtraction: naturalLanguageAudit,
    markdownExtraction: markdown.audit,
    documentationExtraction: documentationAudit,
    taskSynthesis: taskSynthesisAudit,
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
      taskSynthesis: taskSynthesisAudit.effectiveMode === 'llm',
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
  return { runDirectory, manifest, graphPath, diagnosticsPath, summaryPath, taskSynthesisPath, todoPatchPath, todoPatchAuditPath };
  } catch (error) {
    await persistFailedRun(runId, root, runDirectory, options, config, error, activeStage, completedStages);
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
    taskSynthesisMode: options.taskSynthesisMode ?? 'disabled',
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
      taskModel: config.openRouter.taskModel,
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
  error: unknown,
  failedStage: PipelineFailureStage,
  completedStages: Partial<PipelineManifest['stages']>,
): Promise<void> {
  const aborted = (stage: string): PipelineStageAudit => ({
    ...skippedAudit('disabled', `Pipeline aborted before ${stage}`),
    reason: { code: 'PIPELINE_ABORTED', message: `Pipeline aborted before ${stage}` },
  });
  const message = error instanceof Error ? error.message : String(error);
  const knownAudit = error instanceof NlLlmRequiredError
    || error instanceof MarkdownLlmRequiredError
    || error instanceof DocumentationLlmRequiredError
    || error instanceof TaskSynthesisRequiredError
    ? error.audit
    : null;
  const failedAudit = (stage: keyof PipelineManifest['stages']): PipelineStageAudit => {
    if (knownAudit && stage === failedStage) return knownAudit;
    return {
      runtimeVersion: T2C_VERSION,
      configuration: openRouterAuditConfiguration(
        config,
        stage === 'summary' ? config.openRouter.summaryModel : stage === 'taskSynthesis' ? config.openRouter.taskModel : null,
      ),
      status: 'failed', requestedMode: stage === 'summary' || stage === 'taskSynthesis' ? 'llm' : 'disabled', effectiveMode: 'none', degraded: true,
      recordCount: 0, warningCount: 1,
      model: stage === 'summary' ? config.openRouter.summaryModel : stage === 'taskSynthesis' ? config.openRouter.taskModel : null,
      durationMs: 0,
      reason: { code: failureCode(failedStage), message },
      responses: [],
    };
  };
  const stageValue = (stage: keyof PipelineManifest['stages'], label: string): PipelineStageAudit => {
    if (completedStages[stage]) return completedStages[stage];
    if (stage === failedStage) return failedAudit(stage);
    return aborted(label);
  };
  const stages: PipelineManifest['stages'] = {
    naturalLanguageExtraction: stageValue('naturalLanguageExtraction', 'natural-language extraction'),
    markdownExtraction: stageValue('markdownExtraction', 'Markdown extraction'),
    documentationExtraction: stageValue('documentationExtraction', 'documentation extraction'),
    taskSynthesis: stageValue('taskSynthesis', 'task synthesis'),
    summary: stageValue('summary', 'summary generation'),
  };
  const reason = knownAudit?.reason ?? { code: failureCode(failedStage), message };
  const manifest: PipelineManifest = {
    schemaVersion: 't2c.run/v1',
    runId,
    root,
    createdAt: new Date().toISOString(),
    graphFingerprint: null,
    files: {},
    warnings: [message],
    status: 'failed',
    failure: { stage: failedStage, code: reason.code, message: reason.message },
    runtime: { name: 'todo2code', version: T2C_VERSION },
    configuration: manifestConfiguration(options, config),
    stages,
    llm: {
      naturalLanguageExtraction: stages.naturalLanguageExtraction.effectiveMode === 'llm',
      markdownExtraction: stages.markdownExtraction.effectiveMode === 'llm',
      documentationExtraction: false,
      taskSynthesis: false,
      summary: false,
    },
  };
  await writeJson(path.join(runDirectory, 'manifest.json'), manifest);
}

function failureCode(stage: PipelineFailureStage): string {
  return `PIPELINE_${stage.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_FAILED`;
}

function skippedAudit(requestedMode: PipelineStageAudit['requestedMode'], message: string): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: {},
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
