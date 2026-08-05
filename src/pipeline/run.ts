import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { hasOpenRouter } from '../config/env.js';
import { addCommunicationIssuesToDiagnostics, analyzeCommunication, renderCommunicationMarkdown } from '../communication/analyzer.js';
import { CommunicationLlmRequiredError, extractCommunicationIntentAudited, type ParticipantCommunicationSynthesis } from '../communication/llm.js';
import { createIntentId, newRunId, sha256, stableStringify } from '../core/id.js';
import { ensureDir, pathExists, readText, resolveGlobs, writeJson, writeJsonl, writeText } from '../core/io.js';
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
import { extractConfigurationIntent } from '../extractors/configuration.js';
import { extractRuntimeCycleIntent } from '../extractors/runtime-cycle.js';
import { DocumentationLlmRequiredError, extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractDocumentationBaseline } from '../extractors/docs-deterministic.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntentAudited, MarkdownLlmRequiredError } from '../extractors/markdown-llm.js';
import { extractNlIntentAudited, NlLlmRequiredError } from '../extractors/nl-llm.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import { summarizeGraph } from '../summary/summarizer.js';
import {
  createCodeChangeReviewPatch,
  createCodeChangeSourcePatchSet,
  createRepositoryPathProbe,
  proposeCodeChangePlans,
} from '../synthesis/code-change-plan.js';
import { synthesizeTodoProposals, TaskSynthesisRequiredError, type AuditedTaskSynthesisResult } from '../synthesis/tasks-llm.js';
import { createTodoPatch, type CreatedTodoPatch } from '../synthesis/todo-patch.js';
import { T2C_VERSION } from '../version.js';
import { persistPipelineEventLog } from './event-log-persistence.js';

export interface PipelineResult {
  runDirectory: string;
  manifest: PipelineManifest;
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
  summaryConclusionsPath: string;
  taskSynthesisPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
  codeChangePlansPath: string | null;
  codeChangeReviewPath: string | null;
  codeChangeReviewAuditPath: string | null;
  codeChangeSourcePatchesPath: string | null;
  communicationAnalysisPath: string | null;
}

export async function runPipeline(options: PipelineOptions, config: T2CConfig): Promise<PipelineResult> {
  return new PipelineRun(options, config).run();
}

type IntentGraphResult = ReturnType<typeof linkIntentRecords>;
type CommunicationAnalysisResult = ReturnType<typeof analyzeCommunication>;
type CodeChangePlansResult = ReturnType<typeof proposeCodeChangePlans>;
type CodeChangeReviewResult = ReturnType<typeof createCodeChangeReviewPatch>;
type CodeChangeSourcePatchesResult = ReturnType<typeof createCodeChangeSourcePatchSet>;
type SummaryResult = Awaited<ReturnType<typeof summarizeGraph>>;

interface ExtractionResult {
  naturalLanguageAudit: PipelineStageAudit;
  markdownAudit: PipelineStageAudit;
  documentationAudit: PipelineStageAudit;
  communicationAudit: PipelineStageAudit;
  communicationInputPresent: boolean;
  communicationSyntheses: ParticipantCommunicationSynthesis[];
}

interface AnalysisResult {
  generatedAt: string;
  graph: IntentGraphResult;
  diagnostics: DiagnosticReport;
  communicationAnalysis: CommunicationAnalysisResult | null;
}

interface SynthesisResult {
  taskSynthesis: AuditedTaskSynthesisResult | null;
  todoPatch: CreatedTodoPatch | null;
  audit: PipelineStageAudit;
}

interface PlanningResult {
  plans: CodeChangePlansResult;
  review: CodeChangeReviewResult;
  sourcePatches: CodeChangeSourcePatchesResult;
  audit: PipelineStageAudit;
}

interface PipelineSummaryResult {
  summary: SummaryResult;
  audit: PipelineStageAudit;
}

interface OutputPaths {
  graphPath: string;
  diagnosticsPath: string;
  summaryPath: string;
  summaryConclusionsPath: string;
  taskSynthesisPath: string | null;
  todoValidationPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
  codeChangePlansPath: string;
  codeChangeReviewPath: string;
  codeChangeReviewAuditPath: string;
  codeChangeSourcePatchesPath: string;
  communicationAnalysisPath: string | null;
  communicationMarkdownPath: string | null;
  eventLogPath: string;
}

class PipelineRun {
  private readonly root: string;
  private readonly runId = newRunId();
  private readonly baseOutput: string;
  private readonly runDirectory: string;
  private activeStage: PipelineFailureStage = 'setup';
  private readonly completedStages: Partial<PipelineManifest['stages']> = {};
  private readonly warnings: string[] = [];
  private readonly bySource: Record<string, IntentRecord[]> = {
    nl: [], git: [], ast: [], todo: [], changelog: [], document: [],
    configuration: [], runtime: [], communication: [],
  };

  constructor(private readonly options: PipelineOptions, private readonly config: T2CConfig) {
    this.root = path.resolve(options.root);
    this.baseOutput = path.resolve(this.root, options.outputDir);
    this.runDirectory = path.join(this.baseOutput, 'runs', this.runId);
  }

  async run(): Promise<PipelineResult> {
    if (!(await pathExists(this.root))) throw new Error(`Root does not exist: ${this.root}`);
    await ensureDir(this.runDirectory);
    try {
      return await this.execute();
    } catch (error) {
      await persistFailedRun(
        this.runId, this.root, this.runDirectory, this.options, this.config,
        error, this.activeStage, this.completedStages,
      );
      throw error;
    }
  }

  private async execute(): Promise<PipelineResult> {
    const extraction = await this.extractSources();
    const analysis = this.analyze(extraction);
    const synthesis = await this.synthesizeTasks(analysis);
    const planning = this.planChanges(analysis, synthesis);
    const summary = await this.summarize(analysis);
    return this.persist(extraction, analysis, synthesis, planning, summary);
  }

  private async extractSources(): Promise<ExtractionResult> {
    const naturalLanguageAudit = await this.extractNaturalLanguage();
    this.activeStage = 'gitExtraction';
    const git = await extractGitIntent({ root: this.root, count: this.options.gitCommitCount }, this.config);
    this.bySource.git = git.records;
    this.warnings.push(...git.warnings);
    this.activeStage = 'astExtraction';
    const ast = await extractAstIntent({ root: this.root }, this.config);
    this.bySource.ast = ast.records;
    this.warnings.push(...ast.warnings);
    const markdownAudit = await this.extractMarkdown();
    const documentationAudit = await this.extractDocumentation();
    await this.extractConfigurationAndRuntime();
    const communication = await this.extractCommunication();
    return { naturalLanguageAudit, markdownAudit, documentationAudit, ...communication };
  }

  private async extractNaturalLanguage(): Promise<PipelineStageAudit> {
    let audit = skippedAudit('disabled', 'No NL task file was selected');
    if (this.options.taskFile) {
      this.activeStage = 'naturalLanguageExtraction';
      const result = await extractNlIntentAudited(
        { root: this.root, sourcePath: this.options.taskFile },
        this.config,
        this.options.nlMode ?? this.config.nlMode,
      );
      this.bySource.nl = result.records;
      this.warnings.push(...result.warnings);
      audit = result.audit;
    }
    this.completedStages.naturalLanguageExtraction = audit;
    return audit;
  }

  private async extractMarkdown(): Promise<PipelineStageAudit> {
    this.activeStage = 'markdownExtraction';
    const markdown = await extractMarkdownIntentAudited(
      { root: this.root, todoPath: this.options.todoFile, changelogPath: this.options.changelogFile },
      this.config,
      this.options.markdownMode ?? this.config.markdownMode,
    );
    this.bySource.todo = markdown.records.filter((record) => record.source.kind === 'todo');
    this.bySource.changelog = markdown.records.filter((record) => record.source.kind === 'changelog');
    this.warnings.push(...markdown.warnings);
    this.completedStages.markdownExtraction = markdown.audit;
    return markdown.audit;
  }

  private async extractDocumentation(): Promise<PipelineStageAudit> {
    this.activeStage = 'documentationExtraction';
    const files = await resolveGlobs(
      this.root, this.options.documentPatterns,
      this.options.documentExcludes ?? this.config.documentExcludes,
    );
    const startedAt = Date.now();
    const deterministic = await extractDocumentationBaseline({ root: this.root, files }, this.config);
    this.bySource.document = deterministic.records;
    this.warnings.push(...deterministic.warnings);
    let audit = this.deterministicDocumentationAudit(files.length, deterministic, startedAt);
    if (this.options.includeDocumentationLlm) {
      audit = hasOpenRouter(this.config)
        ? await this.enrichDocumentation(deterministic.records.length)
        : this.missingDocumentationLlmAudit(deterministic.records.length);
    }
    this.completedStages.documentationExtraction = audit;
    return audit;
  }

  private deterministicDocumentationAudit(
    fileCount: number,
    result: Awaited<ReturnType<typeof extractDocumentationBaseline>>,
    startedAt: number,
  ): PipelineStageAudit {
    if (fileCount === 0) return skippedAudit('deterministic', 'No documentation files matched the configured patterns');
    return {
      runtimeVersion: T2C_VERSION,
      configuration: { generator: 't2c/markdown-documentation', generatorVersion: '2' },
      status: result.warnings.length ? 'partial' : 'succeeded',
      requestedMode: 'deterministic', effectiveMode: 'deterministic',
      degraded: result.warnings.length > 0,
      recordCount: result.records.length, warningCount: result.warnings.length,
      model: null, durationMs: Date.now() - startedAt,
      reason: result.warnings.length
        ? { code: 'DOCUMENT_EXTRACTION_PARTIAL', message: `${result.warnings.length} deterministic documentation warning(s)` }
        : null,
      responses: [],
    };
  }

  private async enrichDocumentation(deterministicRecordCount: number): Promise<PipelineStageAudit> {
    this.activeStage = 'documentationExtraction';
    const docs = await extractDocumentationIntent({
      root: this.root,
      patterns: this.options.documentPatterns,
      excludes: this.options.documentExcludes ?? this.config.documentExcludes,
      targetHints: collectTargetHints(Object.values(this.bySource).flat()),
    }, this.config);
    this.bySource.document!.push(...docs.records);
    this.warnings.push(...docs.warnings);
    return {
      ...docs.audit,
      recordCount: this.bySource.document!.length,
      configuration: {
        ...docs.audit.configuration,
        deterministicGenerator: 't2c/markdown-documentation@2',
        deterministicRecordCount,
      },
    };
  }

  private missingDocumentationLlmAudit(deterministicRecordCount: number): PipelineStageAudit {
    const message = 'OPENROUTER_API_KEY is not configured; documentation -> Intent DSL was skipped';
    this.warnings.push(message);
    return {
      ...skippedAudit('llm', message),
      configuration: openRouterAuditConfiguration(
        this.config, this.config.openRouter.documentModel, this.config.documentTimeoutMs,
      ),
      status: deterministicRecordCount ? 'fallback' : 'failed',
      effectiveMode: deterministicRecordCount ? 'deterministic' : 'none',
      degraded: true, recordCount: deterministicRecordCount,
      model: this.config.openRouter.documentModel,
      reason: { code: 'LLM_NOT_CONFIGURED', message }, responses: [],
    };
  }

  private async extractConfigurationAndRuntime(): Promise<void> {
    this.activeStage = 'configurationExtraction';
    const configuration = await extractConfigurationIntent(this.root, this.config);
    this.bySource.configuration = configuration.records;
    this.warnings.push(...configuration.warnings);
    this.activeStage = 'runtimeExtraction';
    if (!this.options.cycleFile) return;
    try {
      const runtime = await extractRuntimeCycleIntent(this.options.cycleFile, this.config, this.root);
      this.bySource.runtime = runtime.records;
      this.warnings.push(...runtime.warnings);
    } catch (error) {
      this.warnings.push(`runtime cycle ignored: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async extractCommunication(): Promise<Pick<ExtractionResult,
    'communicationAudit' | 'communicationInputPresent' | 'communicationSyntheses'>> {
    let communicationAudit = skippedAudit('disabled', 'Communication analysis was disabled');
    if (this.options.includeCommunication === false) {
      this.completedStages.communicationAnalysis = communicationAudit;
      return { communicationAudit, communicationInputPresent: false, communicationSyntheses: [] };
    }
    this.activeStage = 'communicationAnalysis';
    const startedAt = Date.now();
    const communication = await extractCommunicationIntentAudited({
      root: this.root,
      projectDir: this.options.projectDirectory ?? 'project',
      ticket: this.options.communicationTicket ?? null,
    }, this.config, this.options.communicationMode ?? this.config.communicationMode);
    const missing = communication.records.length === 0 && communication.warnings.length === 1
      && communication.warnings[0]?.startsWith('Communication directory not found:');
    this.bySource.communication = communication.records;
    if (!missing) this.warnings.push(...communication.warnings);
    communicationAudit = missing
      ? skippedAudit('deterministic', communication.warnings[0] ?? 'Communication directory not found')
      : { ...communication.audit, durationMs: Date.now() - startedAt };
    this.completedStages.communicationAnalysis = communicationAudit;
    return {
      communicationAudit,
      communicationInputPresent: !missing,
      communicationSyntheses: communication.participants,
    };
  }

  private analyze(extraction: ExtractionResult): AnalysisResult {
    this.activeStage = 'linking';
    const generatedAt = new Date().toISOString();
    const graph = linkIntentRecords(Object.values(this.bySource).flat(), generatedAt);
    this.activeStage = 'diagnostics';
    const communicationAnalysis = extraction.communicationInputPresent
      ? analyzeCommunication(graph, generatedAt, extraction.communicationSyntheses)
      : null;
    let diagnostics = diagnoseGraph(graph, generatedAt);
    if (communicationAnalysis) diagnostics = addCommunicationIssuesToDiagnostics(diagnostics, communicationAnalysis);
    if (this.options.includeDocumentationLlm && !hasOpenRouter(this.config)) appendLlmNotConfigured(diagnostics);
    return { generatedAt, graph, diagnostics, communicationAnalysis };
  }

  private async synthesizeTasks(analysis: AnalysisResult): Promise<SynthesisResult> {
    const mode = this.options.taskSynthesisMode ?? 'disabled';
    let taskSynthesis: AuditedTaskSynthesisResult | null = null;
    let todoPatch: CreatedTodoPatch | null = null;
    let audit = skippedAudit('disabled', 'Task synthesis was disabled');
    if (mode !== 'disabled') {
      this.activeStage = 'taskSynthesis';
      taskSynthesis = await synthesizeTodoProposals(analysis.graph, analysis.diagnostics, this.config, mode);
      this.warnings.push(...taskSynthesis.warnings);
      audit = taskSynthesis.audit;
      this.completedStages.taskSynthesis = audit;
      if (!this.options.todoFile) throw new Error('Task synthesis rendering requires a TODO source file');
      this.activeStage = 'todoRendering';
      const todoPath = path.resolve(this.root, this.options.todoFile);
      const todoContent = await readText(todoPath, this.config.maxFileBytes);
      todoPatch = createTodoPatch({
        todoPath: path.relative(this.root, todoPath).replace(/\\/g, '/'), todoContent,
        graph: analysis.graph, diagnostics: analysis.diagnostics,
        conclusions: taskSynthesis.conclusions, proposals: taskSynthesis.proposals,
        validation: taskSynthesis.validation, synthesisAudit: taskSynthesis.audit,
      });
    }
    this.completedStages.taskSynthesis = audit;
    return { taskSynthesis, todoPatch, audit };
  }

  private planChanges(analysis: AnalysisResult, synthesis: SynthesisResult): PlanningResult {
    this.activeStage = 'codeChangePlanning';
    const plans = proposeCodeChangePlans({
      graph: analysis.graph, diagnostics: analysis.diagnostics,
      ...(synthesis.taskSynthesis ? {
        conclusions: synthesis.taskSynthesis.conclusions,
        proposals: synthesis.taskSynthesis.proposals,
      } : {}),
      generatedAt: analysis.generatedAt,
      pathExists: createRepositoryPathProbe(this.root),
    });
    const review = createCodeChangeReviewPatch({
      plans: plans.plans, graphFingerprint: analysis.graph.fingerprint,
      createdAt: analysis.generatedAt,
    });
    const sourcePatches = createCodeChangeSourcePatchSet({
      plans: plans.plans, graphFingerprint: analysis.graph.fingerprint,
      generatedAt: analysis.generatedAt,
    });
    const audit: PipelineStageAudit = {
      runtimeVersion: T2C_VERSION, configuration: openRouterAuditConfiguration(this.config, null),
      status: 'succeeded', requestedMode: 'deterministic', effectiveMode: 'deterministic',
      degraded: false, recordCount: plans.plans.length, warningCount: 0,
      model: null, durationMs: 0, reason: null, responses: [],
    };
    this.completedStages.codeChangePlanning = audit;
    return { plans, review, sourcePatches, audit };
  }

  private async summarize(analysis: AnalysisResult): Promise<PipelineSummaryResult> {
    this.activeStage = 'summary';
    const startedAt = Date.now();
    const includeLlm = this.options.includeSummaryLlm !== false;
    const summary = await summarizeGraph(analysis.graph, analysis.diagnostics, this.config, {
      allowDeterministicFallback: this.options.allowSummaryFallback,
      preferLlm: includeLlm,
    });
    this.warnings.push(...summary.warnings);
    let audit: PipelineStageAudit;
    if (!includeLlm) audit = this.disabledSummaryAudit(summary, startedAt);
    else if (summary.llmUsed) audit = this.successfulSummaryAudit(summary, startedAt);
    else audit = this.fallbackSummaryAudit(summary, startedAt);
    this.completedStages.summary = audit;
    return { summary, audit };
  }

  private disabledSummaryAudit(summary: SummaryResult, startedAt: number): PipelineStageAudit {
    return {
      runtimeVersion: T2C_VERSION, configuration: openRouterAuditConfiguration(this.config, null),
      status: 'skipped', requestedMode: 'deterministic', effectiveMode: 'deterministic', degraded: false,
      recordCount: summary.conclusions.length, warningCount: 0, model: null,
      durationMs: Date.now() - startedAt,
      reason: { code: 'LLM_DISABLED', message: 'LLM summary was disabled; generated the deterministic report' },
      responses: [],
    };
  }

  private successfulSummaryAudit(summary: SummaryResult, startedAt: number): PipelineStageAudit {
    return {
      runtimeVersion: T2C_VERSION,
      configuration: openRouterAuditConfiguration(this.config, this.config.openRouter.summaryModel),
      status: 'succeeded', requestedMode: 'llm', effectiveMode: 'llm', degraded: false,
      recordCount: summary.conclusions.length, warningCount: summary.warnings.length,
      model: this.config.openRouter.summaryModel, durationMs: Date.now() - startedAt,
      reason: null, responses: summary.responses,
    };
  }

  private fallbackSummaryAudit(summary: SummaryResult, startedAt: number): PipelineStageAudit {
    return {
      runtimeVersion: T2C_VERSION,
      configuration: openRouterAuditConfiguration(this.config, this.config.openRouter.summaryModel),
      status: 'fallback', requestedMode: 'llm', effectiveMode: 'deterministic', degraded: true,
      recordCount: summary.conclusions.length, warningCount: summary.warnings.length,
      model: this.config.openRouter.summaryModel, durationMs: Date.now() - startedAt,
      reason: {
        code: hasOpenRouter(this.config) ? 'LLM_UNAVAILABLE' : 'LLM_NOT_CONFIGURED',
        message: summary.warnings[0] ?? 'Deterministic summary fallback was used',
      },
      responses: [],
    };
  }

  private async persist(
    extraction: ExtractionResult,
    analysis: AnalysisResult,
    synthesis: SynthesisResult,
    planning: PlanningResult,
    summary: PipelineSummaryResult,
  ): Promise<PipelineResult> {
    this.activeStage = 'persistence';
    const files: Record<string, string> = {};
    await this.writeIntentFiles(files);
    const paths = this.outputPaths(synthesis, analysis.communicationAnalysis);
    await this.writeRequiredOutputs(paths, analysis, planning, summary, files);
    await this.writeOptionalOutputs(paths, analysis.communicationAnalysis, synthesis, files);
    const manifest = this.createManifest(files, extraction, analysis, synthesis, planning, summary);
    await writeJson(path.join(this.runDirectory, 'manifest.json'), manifest);
    await persistPipelineEventLog({ root: this.root, runDirectory: this.runDirectory, manifest });
    await writeJson(path.join(this.baseOutput, 'latest.json'), {
      runId: this.runId,
      runDirectory: this.relative(this.runDirectory),
      graphFingerprint: analysis.graph.fingerprint,
      summary: files.summary,
      summaryConclusions: files.summaryConclusions,
    });
    return this.pipelineResult(paths, manifest);
  }

  private async writeIntentFiles(files: Record<string, string>): Promise<void> {
    for (const [source, records] of Object.entries(this.bySource)) {
      const filePath = path.join(this.runDirectory, `${source}.intent.jsonl`);
      await writeJsonl(filePath, records);
      files[`${source}Intent`] = this.relative(filePath);
    }
  }

  private outputPaths(
    synthesis: SynthesisResult,
    communicationAnalysis: CommunicationAnalysisResult | null,
  ): OutputPaths {
    const run = this.runDirectory;
    return {
      graphPath: path.join(run, 'intent.graph.json'),
      diagnosticsPath: path.join(run, 'diagnostics.json'),
      summaryPath: path.join(run, 'team-summary.md'),
      summaryConclusionsPath: path.join(run, 'summary-conclusions.json'),
      taskSynthesisPath: synthesis.taskSynthesis ? path.join(run, 'task-synthesis.json') : null,
      todoValidationPath: synthesis.taskSynthesis ? path.join(run, 'todo-validation.json') : null,
      todoPatchPath: synthesis.todoPatch ? path.join(run, 'TODO.patch') : null,
      todoPatchAuditPath: synthesis.todoPatch ? path.join(run, 'TODO.patch.json') : null,
      codeChangePlansPath: path.join(run, 'code-change-plans.json'),
      codeChangeReviewPath: path.join(run, 'CODE_CHANGE.review.md'),
      codeChangeReviewAuditPath: path.join(run, 'CODE_CHANGE.review.json'),
      codeChangeSourcePatchesPath: path.join(run, 'code-change-source-patches.json'),
      communicationAnalysisPath: communicationAnalysis ? path.join(run, 'communication-analysis.json') : null,
      communicationMarkdownPath: communicationAnalysis ? path.join(run, 'communication-analysis.md') : null,
      eventLogPath: path.join(run, 'logs.dsl.txt'),
    };
  }

  private async writeRequiredOutputs(
    paths: OutputPaths,
    analysis: AnalysisResult,
    planning: PlanningResult,
    summary: PipelineSummaryResult,
    files: Record<string, string>,
  ): Promise<void> {
    await writeJson(paths.graphPath, analysis.graph);
    await writeJson(paths.diagnosticsPath, analysis.diagnostics);
    await writeText(paths.summaryPath, summary.summary.markdown);
    await writeJson(paths.summaryConclusionsPath, summary.summary.conclusions);
    await writeJson(paths.codeChangePlansPath, planning.plans);
    await writeText(paths.codeChangeReviewPath, planning.review.markdown);
    await writeJson(paths.codeChangeReviewAuditPath, planning.review.artifact);
    await writeJson(paths.codeChangeSourcePatchesPath, planning.sourcePatches);
    files.codeChangePlans = this.relative(paths.codeChangePlansPath);
    files.codeChangeReview = this.relative(paths.codeChangeReviewPath);
    files.codeChangeReviewAudit = this.relative(paths.codeChangeReviewAuditPath);
    files.codeChangeSourcePatches = this.relative(paths.codeChangeSourcePatchesPath);
    files.graph = this.relative(paths.graphPath);
    files.diagnostics = this.relative(paths.diagnosticsPath);
    files.summary = this.relative(paths.summaryPath);
    files.summaryConclusions = this.relative(paths.summaryConclusionsPath);
    files.eventLog = this.relative(paths.eventLogPath);
  }

  private async writeOptionalOutputs(
    paths: OutputPaths,
    communicationAnalysis: CommunicationAnalysisResult | null,
    synthesis: SynthesisResult,
    files: Record<string, string>,
  ): Promise<void> {
    if (paths.communicationAnalysisPath && paths.communicationMarkdownPath && communicationAnalysis) {
      await Promise.all([
        writeJson(paths.communicationAnalysisPath, communicationAnalysis),
        writeText(paths.communicationMarkdownPath, renderCommunicationMarkdown(communicationAnalysis)),
      ]);
      files.communicationAnalysis = this.relative(paths.communicationAnalysisPath);
      files.communicationAnalysisMarkdown = this.relative(paths.communicationMarkdownPath);
    }
    if (paths.taskSynthesisPath && paths.todoValidationPath && paths.todoPatchPath
      && paths.todoPatchAuditPath && synthesis.taskSynthesis && synthesis.todoPatch) {
      await Promise.all([
        writeJson(paths.taskSynthesisPath, synthesis.taskSynthesis),
        writeJson(paths.todoValidationPath, synthesis.taskSynthesis.validation),
        writeText(paths.todoPatchPath, synthesis.todoPatch.markdown),
        writeJson(paths.todoPatchAuditPath, synthesis.todoPatch.artifact),
      ]);
      files.taskSynthesis = this.relative(paths.taskSynthesisPath);
      files.todoValidation = this.relative(paths.todoValidationPath);
      files.todoPatch = this.relative(paths.todoPatchPath);
      files.todoPatchAudit = this.relative(paths.todoPatchAuditPath);
    }
  }

  private createManifest(
    files: Record<string, string>,
    extraction: ExtractionResult,
    analysis: AnalysisResult,
    synthesis: SynthesisResult,
    planning: PlanningResult,
    summary: PipelineSummaryResult,
  ): PipelineManifest {
    const stages = {
      naturalLanguageExtraction: extraction.naturalLanguageAudit,
      markdownExtraction: extraction.markdownAudit,
      documentationExtraction: extraction.documentationAudit,
      communicationAnalysis: extraction.communicationAudit,
      taskSynthesis: synthesis.audit,
      codeChangePlanning: planning.audit,
      summary: summary.audit,
    };
    return {
      schemaVersion: 't2c.run/v1', runId: this.runId, root: this.root,
      createdAt: analysis.generatedAt, graphFingerprint: analysis.graph.fingerprint,
      files, warnings: [...new Set(this.warnings)].sort(),
      status: Object.values(stages).some((stage) => stage.degraded) ? 'degraded' : 'succeeded',
      failure: null, runtime: { name: 'todo2code', version: T2C_VERSION },
      configuration: manifestConfiguration(this.options, this.config), stages,
      llm: {
        naturalLanguageExtraction: extraction.naturalLanguageAudit.effectiveMode === 'llm',
        markdownExtraction: extraction.markdownAudit.effectiveMode === 'llm',
        documentationExtraction: extraction.documentationAudit.effectiveMode === 'llm',
        communicationEnrichment: extraction.communicationAudit.effectiveMode === 'llm',
        taskSynthesis: synthesis.audit.effectiveMode === 'llm',
        summary: summary.summary.llmUsed,
      },
    };
  }

  private pipelineResult(paths: OutputPaths, manifest: PipelineManifest): PipelineResult {
    return {
      runDirectory: this.runDirectory, manifest,
      graphPath: paths.graphPath, diagnosticsPath: paths.diagnosticsPath,
      summaryPath: paths.summaryPath, summaryConclusionsPath: paths.summaryConclusionsPath,
      taskSynthesisPath: paths.taskSynthesisPath, todoPatchPath: paths.todoPatchPath,
      todoPatchAuditPath: paths.todoPatchAuditPath, codeChangePlansPath: paths.codeChangePlansPath,
      codeChangeReviewPath: paths.codeChangeReviewPath,
      codeChangeReviewAuditPath: paths.codeChangeReviewAuditPath,
      codeChangeSourcePatchesPath: paths.codeChangeSourcePatchesPath,
      communicationAnalysisPath: paths.communicationAnalysisPath,
    };
  }

  private relative(filePath: string): string {
    return path.relative(this.root, filePath).replace(/\\/g, '/');
  }
}

function manifestConfiguration(options: PipelineOptions, config: T2CConfig): PipelineManifest['configuration'] {
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
    || error instanceof CommunicationLlmRequiredError
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
    communicationAnalysis: stageValue('communicationAnalysis', 'communication analysis'),
    taskSynthesis: stageValue('taskSynthesis', 'task synthesis'),
    codeChangePlanning: stageValue('codeChangePlanning', 'code-change planning'),
    summary: stageValue('summary', 'summary generation'),
  };
  const reason = knownAudit?.reason ?? { code: failureCode(failedStage), message };
  const manifest: PipelineManifest = {
    schemaVersion: 't2c.run/v1',
    runId,
    root,
    createdAt: new Date().toISOString(),
    graphFingerprint: null,
    files: {
      eventLog: path.relative(root, path.join(runDirectory, 'logs.dsl.txt')).replace(/\\/g, '/'),
    },
    warnings: [message],
    status: 'failed',
    failure: { stage: failedStage, code: reason.code, message: reason.message },
    runtime: { name: 'todo2code', version: T2C_VERSION },
    configuration: manifestConfiguration(options, config),
    stages,
    llm: {
      naturalLanguageExtraction: stages.naturalLanguageExtraction.effectiveMode === 'llm',
      markdownExtraction: stages.markdownExtraction.effectiveMode === 'llm',
      communicationEnrichment: stages.communicationAnalysis.effectiveMode === 'llm',
      documentationExtraction: false,
      taskSynthesis: false,
      summary: false,
    },
  };
  await writeJson(path.join(runDirectory, 'manifest.json'), manifest);
  await persistPipelineEventLog({ root, runDirectory, manifest, replaceUnfinished: true });
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
