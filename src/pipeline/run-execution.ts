import path from 'node:path';

import { hasOpenRouter } from '../config/env.js';
import type { T2CConfig } from '../config/env.js';
import { addCommunicationIssuesToDiagnostics, analyzeCommunication } from '../communication/analyzer.js';
import { ensureDir, pathExists, resolveGlobs } from '../core/io.js';
import { newRunId } from '../core/id.js';
import type { PipelineOptions } from '../core/types.js';
import { extractAstIntent } from '../extractors/ast.js';
import { extractConfigurationIntent } from '../extractors/configuration.js';
import { extractRuntimeCycleIntent } from '../extractors/runtime-cycle.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntentAudited } from '../extractors/markdown-llm.js';
import { extractNlIntentAudited } from '../extractors/nl-llm.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import {
  appendLlmNotConfigured,
  collectCommunicationAnalysis,
  collectTaskSynthesis,
  createCodeChangeArtifacts,
} from './run-helpers.js';
import { collectDocumentationExtraction } from './run-documentation.js';
import { collectSummary } from './run-summary.js';
import { skippedAudit } from './run-failed.js';
import type { PipelineContext, PipelineExecutionOutput } from './run-types.js';

export async function initializePipelineContext(options: PipelineOptions): Promise<PipelineContext> {
  const root = path.resolve(options.root);
  if (!(await pathExists(root))) throw new Error(`Root does not exist: ${root}`);
  const runId = newRunId();
  const baseOutput = path.resolve(root, options.outputDir);
  const runDirectory = path.join(baseOutput, 'runs', runId);
  await ensureDir(runDirectory);

  return {
    root,
    runId,
    baseOutput,
    runDirectory,
    activeStage: 'setup',
    warnings: [],
    bySource: {
      nl: [],
      git: [],
      ast: [],
      todo: [],
      changelog: [],
      document: [],
      configuration: [],
      runtime: [],
      communication: [],
    },
    completedStages: {},
  };
}

export async function executePipeline(context: PipelineContext, options: PipelineOptions, config: T2CConfig): Promise<PipelineExecutionOutput> {
  const { root, warnings, bySource, completedStages } = context;
  const deterministicDocumentFiles = await resolveGlobs(
    root,
    options.documentPatterns,
    options.documentExcludes ?? config.documentExcludes,
  );

  let naturalLanguageAudit = skippedAudit('disabled', 'No NL task file was selected');
  if (options.taskFile) {
    context.activeStage = 'naturalLanguageExtraction';
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

  context.activeStage = 'gitExtraction';
  const git = await extractGitIntent({ root, count: options.gitCommitCount }, config);
  bySource.git = git.records;
  warnings.push(...git.warnings);

  context.activeStage = 'astExtraction';
  const ast = await extractAstIntent({ root }, config);
  bySource.ast = ast.records;
  warnings.push(...ast.warnings);

  context.activeStage = 'markdownExtraction';
  const markdown = await extractMarkdownIntentAudited(
    { root, todoPath: options.todoFile, changelogPath: options.changelogFile },
    config,
    options.markdownMode ?? config.markdownMode,
  );
  bySource.todo = markdown.records.filter((record) => record.source.kind === 'todo');
  bySource.changelog = markdown.records.filter((record) => record.source.kind === 'changelog');
  warnings.push(...markdown.warnings);
  const markdownAudit = markdown.audit;
  completedStages.markdownExtraction = markdownAudit;

  context.activeStage = 'documentationExtraction';
  const documentationResult = await collectDocumentationExtraction(context, options, config, deterministicDocumentFiles);
  const documentationAudit = documentationResult.documentationAudit;
  completedStages.documentationExtraction = documentationAudit;

  context.activeStage = 'configurationExtraction';
  const configurationExtraction = await extractConfigurationIntent(root, config);
  bySource.configuration = configurationExtraction.records;
  warnings.push(...configurationExtraction.warnings);

  context.activeStage = 'runtimeExtraction';
  if (options.cycleFile) {
    try {
      const runtime = await extractRuntimeCycleIntent(options.cycleFile, config, root);
      bySource.runtime = runtime.records;
      warnings.push(...runtime.warnings);
    } catch (error) {
      warnings.push(`runtime cycle ignored: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const communicationInput = await collectCommunicationAnalysis(context, options, config);
  const communicationAudit = communicationInput.audit;
  const communicationInputPresent = !communicationInput.missingDirectory;
  const communicationSyntheses = communicationInput.syntheses;
  completedStages.communicationAnalysis = communicationAudit;

  context.activeStage = 'linking';
  const allRecords = Object.values(bySource).flat();
  const generatedAt = new Date().toISOString();
  const graph = linkIntentRecords(allRecords, generatedAt);

  context.activeStage = 'diagnostics';
  let diagnostics = diagnoseGraph(graph, generatedAt);
  const communicationAnalysis = communicationInputPresent
    ? analyzeCommunication(graph, generatedAt, communicationSyntheses)
    : null;
  if (communicationAnalysis) diagnostics = addCommunicationIssuesToDiagnostics(diagnostics, communicationAnalysis);
  if (options.includeDocumentationLlm && !hasOpenRouter(config)) appendLlmNotConfigured(diagnostics);

  const taskSynthesis = await collectTaskSynthesis(
    context,
    options,
    config,
    root,
    graph,
    diagnostics,
  );
  completedStages.taskSynthesis = taskSynthesis.audit;

  context.activeStage = 'codeChangePlanning';
  const { codeChangePlans, codeChangeReview, codeChangeSourcePatches, codeChangePlanningAudit } = createCodeChangeArtifacts(
    graph,
    diagnostics,
    generatedAt,
    root,
    taskSynthesis.result,
    config,
  );
  completedStages.codeChangePlanning = codeChangePlanningAudit;

  context.activeStage = 'summary';
  const { summary, audit: summaryAudit } = await collectSummary(graph, diagnostics, config, options);
  warnings.push(...summary.warnings);
  completedStages.summary = summaryAudit;

  return {
    generatedAt,
    bySource,
    graph,
    diagnostics,
    communicationAnalysis,
    communicationSyntheses,
    naturalLanguageAudit,
    markdownAudit,
    documentationAudit,
    communicationAudit,
    taskSynthesisAudit: taskSynthesis.audit,
    codeChangePlanningAudit,
    summary,
    summaryAudit,
    taskSynthesis: taskSynthesis.result,
    todoPatch: taskSynthesis.patch,
    codeChangePlans,
    codeChangeReview,
    codeChangeSourcePatches,
  };
}
