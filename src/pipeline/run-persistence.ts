import path from 'node:path';

import { sha256, stableStringify } from '../core/id.js';
import { writeJson, writeJsonl, writeText } from '../core/io.js';
import { T2C_VERSION } from '../version.js';
import { hasOpenRouter } from '../config/env.js';
import type { PipelineManifest, PipelineOptions, PipelineStageAudit } from '../core/types.js';
import type { T2CConfig } from '../config/env.js';
import type { PipelineContext, PipelineExecutionOutput, PipelinePersistedPaths } from './run-types.js';
import { persistOptionalArtifacts } from './persist-optional-artifacts.js';

export function makePipelineManifest(
  context: PipelineContext,
  options: PipelineOptions,
  config: T2CConfig,
  execution: PipelineExecutionOutput,
  files: Record<string, string>,
  stageAudits: {
    naturalLanguageExtraction: PipelineStageAudit;
    markdownExtraction: PipelineStageAudit;
    documentationExtraction: PipelineStageAudit;
    communicationAnalysis: PipelineStageAudit;
    taskSynthesis: PipelineStageAudit;
    codeChangePlanning: PipelineStageAudit;
    summary: PipelineStageAudit;
  },
): PipelineManifest {
  return {
    schemaVersion: 't2c.run/v1',
    runId: context.runId,
    root: context.root,
    createdAt: execution.generatedAt,
    graphFingerprint: execution.graph.fingerprint,
    files,
    warnings: [...new Set(context.warnings)].sort(),
    status: Object.values(stageAudits).some((stage) => stage.degraded) ? 'degraded' : 'succeeded',
    failure: null,
    runtime: { name: 'todo2code', version: T2C_VERSION },
    configuration: manifestConfiguration(options, config),
    stages: stageAudits,
    llm: {
      naturalLanguageExtraction: stageAudits.naturalLanguageExtraction.effectiveMode === 'llm',
      markdownExtraction: stageAudits.markdownExtraction.effectiveMode === 'llm',
      documentationExtraction: stageAudits.documentationExtraction.effectiveMode === 'llm',
      communicationEnrichment: stageAudits.communicationAnalysis.effectiveMode === 'llm',
      taskSynthesis: stageAudits.taskSynthesis.effectiveMode === 'llm',
      summary: execution.summary.llmUsed,
    },
  };
}

export async function persistPipelineArtifacts(context: PipelineContext, execution: PipelineExecutionOutput): Promise<PipelinePersistedPaths> {
  const { root, runDirectory, bySource } = context;
  const {
    graph,
    diagnostics,
    summary,
    taskSynthesis,
    todoPatch,
    codeChangePlans,
    codeChangeReview,
    codeChangeSourcePatches,
    communicationAnalysis,
  } = execution;

  const files: Record<string, string> = {};

  Object.assign(files, await persistIntentArtifacts(runDirectory, root, bySource));

  const coreArtifacts = await persistCoreArtifacts(
    runDirectory,
    root,
    graph,
    diagnostics,
    summary,
    codeChangePlans,
    codeChangeReview,
    codeChangeSourcePatches,
  );
  Object.assign(files, coreArtifacts.files);

  const optionalArtifacts = await persistOptionalArtifacts(
    runDirectory,
    root,
    taskSynthesis,
    todoPatch,
    communicationAnalysis,
  );
  Object.assign(files, optionalArtifacts.files);

  return {
    files,
    graphPath: coreArtifacts.graphPath,
    diagnosticsPath: coreArtifacts.diagnosticsPath,
    summaryPath: coreArtifacts.summaryPath,
    summaryConclusionsPath: coreArtifacts.summaryConclusionsPath,
    taskSynthesisPath: optionalArtifacts.taskSynthesisPath,
    todoPatchPath: optionalArtifacts.todoPatchPath,
    todoPatchAuditPath: optionalArtifacts.todoPatchAuditPath,
    codeChangePlansPath: coreArtifacts.codeChangePlansPath,
    codeChangeReviewPath: coreArtifacts.codeChangeReviewPath,
    codeChangeReviewAuditPath: coreArtifacts.codeChangeReviewAuditPath,
    codeChangeSourcePatchesPath: coreArtifacts.codeChangeSourcePatchesPath,
    communicationAnalysisPath: optionalArtifacts.communicationAnalysisPath,
  };
}

async function persistIntentArtifacts(
  runDirectory: string,
  root: string,
  bySource: PipelineContext['bySource'],
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const [source, records] of Object.entries(bySource)) {
    const filePath = path.join(runDirectory, `${source}.intent.jsonl`);
    await writeJsonl(filePath, records);
    files[`${source}Intent`] = path.relative(root, filePath).replace(/\\/g, '/');
  }
  return files;
}

type PersistCoreArtifactsResult = {
  files: Record<string, string>;
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
  summaryConclusionsPath: string;
  codeChangePlansPath: string;
  codeChangeReviewPath: string;
  codeChangeReviewAuditPath: string;
  codeChangeSourcePatchesPath: string;
};

async function persistCoreArtifacts(
  runDirectory: string,
  root: string,
  graph: PipelineExecutionOutput['graph'],
  diagnostics: PipelineExecutionOutput['diagnostics'],
  summary: PipelineExecutionOutput['summary'],
  codeChangePlans: PipelineExecutionOutput['codeChangePlans'],
  codeChangeReview: PipelineExecutionOutput['codeChangeReview'],
  codeChangeSourcePatches: PipelineExecutionOutput['codeChangeSourcePatches'],
): Promise<PersistCoreArtifactsResult> {
  const files: Record<string, string> = {};

  const graphPath = path.join(runDirectory, 'intent.graph.json');
  const diagnosticsPath = path.join(runDirectory, 'diagnostics.json');
  const summaryPath = path.join(runDirectory, 'team-summary.md');
  const summaryConclusionsPath = path.join(runDirectory, 'summary-conclusions.json');
  const codeChangePlansPath = path.join(runDirectory, 'code-change-plans.json');
  const codeChangeReviewPath = path.join(runDirectory, 'CODE_CHANGE.review.md');
  const codeChangeReviewAuditPath = path.join(runDirectory, 'CODE_CHANGE.review.json');
  const codeChangeSourcePatchesPath = path.join(runDirectory, 'code-change-source-patches.json');

  await writeJson(graphPath, graph);
  await writeJson(diagnosticsPath, diagnostics);
  await writeText(summaryPath, summary.markdown);
  await writeJson(summaryConclusionsPath, summary.conclusions);
  await writeJson(codeChangePlansPath, codeChangePlans);
  await writeText(codeChangeReviewPath, codeChangeReview.markdown);
  await writeJson(codeChangeReviewAuditPath, codeChangeReview.artifact);
  await writeJson(codeChangeSourcePatchesPath, codeChangeSourcePatches);

  files.graph = path.relative(root, graphPath).replace(/\\/g, '/');
  files.diagnostics = path.relative(root, diagnosticsPath).replace(/\\/g, '/');
  files.summary = path.relative(root, summaryPath).replace(/\\/g, '/');
  files.summaryConclusions = path.relative(root, summaryConclusionsPath).replace(/\\/g, '/');
  files.codeChangePlans = path.relative(root, codeChangePlansPath).replace(/\\/g, '/');
  files.codeChangeReview = path.relative(root, codeChangeReviewPath).replace(/\\/g, '/');
  files.codeChangeReviewAudit = path.relative(root, codeChangeReviewAuditPath).replace(/\\/g, '/');
  files.codeChangeSourcePatches = path.relative(root, codeChangeSourcePatchesPath).replace(/\\/g, '/');

  return {
    files,
    graphPath,
    diagnosticsPath,
    summaryPath,
    summaryConclusionsPath,
    codeChangePlansPath,
    codeChangeReviewPath,
    codeChangeReviewAuditPath,
    codeChangeSourcePatchesPath,
  };
}

export function manifestConfiguration(options: PipelineOptions, config: T2CConfig): PipelineManifest['configuration'] {
  const configuration = {
    nlMode: options.nlMode ?? config.nlMode,
    markdownMode: options.markdownMode ?? config.markdownMode,
    communicationMode: options.communicationMode ?? config.communicationMode,
    gitCommitCount: options.gitCommitCount,
    maxFileBytes: config.maxFileBytes,
    markdownConcurrency: config.markdownConcurrency,
    documentConcurrency: config.documentConcurrency,
    documentChunkChars: config.documentChunkChars,
    documentMaxChunks: config.documentMaxChunks,
    documentRecordsPerChunk: config.documentRecordsPerChunk,
    documentTimeoutMs: config.documentTimeoutMs,
    summaryLlm: options.includeSummaryLlm !== false,
    taskSynthesisMode: options.taskSynthesisMode ?? 'disabled',
    includeCommunication: options.includeCommunication !== false,
    projectDirectory: options.projectDirectory ?? 'project',
    communicationTicket: options.communicationTicket ?? null,
    documentPatterns: [...options.documentPatterns],
    documentExcludes: [...(options.documentExcludes ?? config.documentExcludes)],
    adapters: {
      python: { enabled: config.enablePythonAst, executable: config.pythonExecutable },
      go: { enabled: config.enableGoAst, executable: config.goExecutable },
      java: { enabled: config.enableJavaAst, executable: config.javaExecutable },
      rust: { enabled: config.enableRustAst, executable: config.cargoExecutable },
      php: { enabled: config.enablePhpAst, executable: config.phpExecutable },
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
      communicationModel: config.openRouter.communicationModel,
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
