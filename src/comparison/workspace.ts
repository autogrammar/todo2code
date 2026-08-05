import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { T2CConfig } from '../config/env.js';
import { newRunId } from '../core/id.js';
import { pathExists, readJson, resolveGlobs, writeJson, writeText } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import type { DiagnosticReport, IntentGraph, LlmExtractionMode, PipelineManifest, PipelineOptions } from '../core/types.js';
import { buildRealityView, renderRealityMarkdown, renderRealitySvg, type IntentRealityView } from '../diff/reality.js';
import { diffIntentGraphs, renderGraphDiffSvg } from '../graph/diff.js';
import { OPENROUTER_TIMEOUT_POLICY } from '../llm/openrouter-timeout.js';
import { runPipeline } from '../pipeline/run.js';

const execFileAsync = promisify(execFile);

export const WORKSPACE_COMPARISON_DEADLINE_POLICY = Object.freeze({
  inputBytesBaseline: 128 * 1024,
  llmWorkUnitsBaseline: 16,
  scaleFactor: 2,
  maximumMultiplier: 4,
  maximumDeadlineMs: 40 * 60 * 1000,
});

export interface WorkspaceComparisonDeadlineLoad {
  inputBytes: number;
  llmWorkUnits: number;
}

export interface WorkspaceComparisonDeadlineDecision extends WorkspaceComparisonDeadlineLoad {
  baseDeadlineMs: number;
  pressure: number;
  multiplier: number;
  effectiveDeadlineMs: number;
  capped: boolean;
}

/** Bound the two-pipeline operation, not only each individual provider call. */
export function calculateWorkspaceComparisonDeadline(
  load: WorkspaceComparisonDeadlineLoad,
): WorkspaceComparisonDeadlineDecision {
  assertNonNegativeInteger(load.inputBytes, 'input bytes');
  assertNonNegativeInteger(load.llmWorkUnits, 'LLM work units');
  const baseDeadlineMs = OPENROUTER_TIMEOUT_POLICY.maximumTimeoutMs;
  const pressure = Math.max(
    1,
    load.inputBytes / WORKSPACE_COMPARISON_DEADLINE_POLICY.inputBytesBaseline,
    load.llmWorkUnits / WORKSPACE_COMPARISON_DEADLINE_POLICY.llmWorkUnitsBaseline,
  );
  const steps = pressure <= 1 ? 0 : Math.ceil(Math.log2(pressure));
  const multiplier = Math.min(
    WORKSPACE_COMPARISON_DEADLINE_POLICY.maximumMultiplier,
    WORKSPACE_COMPARISON_DEADLINE_POLICY.scaleFactor ** steps,
  );
  const scaledDeadlineMs = baseDeadlineMs * multiplier;
  const effectiveDeadlineMs = Math.min(
    WORKSPACE_COMPARISON_DEADLINE_POLICY.maximumDeadlineMs,
    scaledDeadlineMs,
  );
  const capped = effectiveDeadlineMs < scaledDeadlineMs;
  return {
    ...load,
    baseDeadlineMs,
    pressure,
    multiplier,
    effectiveDeadlineMs,
    capped,
  };
}

export interface WorkspaceComparisonOptions {
  root: string;
  baseRef?: string;
  taskFile?: string | null;
  todoFile?: string | null;
  changelogFile?: string | null;
  documentPatterns?: string[];
  documentExcludes?: string[];
  includeDocumentationLlm?: boolean;
  markdownMode?: LlmExtractionMode;
  communicationMode?: LlmExtractionMode;
  outputDir?: string;
  gitCommitCount?: number;
}

export interface CoverageSnapshot {
  topics: number;
  aligned: number;
  gaps: number;
  alignmentRate: number;
  declaredRecords: number;
  observedRecords: number;
  declaredTopics: number;
  observedTopics: number;
  implementationAlignedTopics: number;
  implementationCoverage: number;
  plannedCodeCoverage: number;
  documentedCodeCoverage: number;
  /** False when neither side ran documentation extraction; see `IntentRealityView`. */
  documentationMeasured: boolean;
  byStatus: Record<string, number>;
  diagnostics: DiagnosticReport['counts'];
}

export interface WorkspaceComparison {
  schemaVersion: 't2c.workspace-comparison/v1';
  generatedAt: string;
  base: { ref: string; commit: string; graphFingerprint: string; coverage: CoverageSnapshot };
  workspace: {
    headCommit: string;
    dirty: boolean;
    changedFiles: string[];
    ahead: number;
    behind: number;
    graphFingerprint: string;
    coverage: CoverageSnapshot;
  };
  trend: {
    direction: 'improved' | 'regressed' | 'mixed' | 'unchanged';
    alignmentRateDelta: number;
    implementationCoverageDelta: number;
    plannedCodeCoverageDelta: number;
    documentedCodeCoverageDelta: number;
    alignedDelta: number;
    gapsDelta: number;
    diagnosticsDelta: DiagnosticReport['counts'];
  };
  diff: ReturnType<typeof diffIntentGraphs>;
  artifacts: Record<string, string>;
}

export async function compareWorkspaceIntent(
  options: WorkspaceComparisonOptions,
  config: T2CConfig,
): Promise<WorkspaceComparison> {
  const root = path.resolve(options.root);
  const repositoryRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim();
  const relativeAnalysisRoot = path.relative(repositoryRoot, root);
  if (relativeAnalysisRoot.startsWith('..') || path.isAbsolute(relativeAnalysisRoot)) {
    throw new Error(`Analysis root is outside the Git repository: ${root}`);
  }
  const outputDir = await scopedOutputDirectory(root, options.outputDir ?? config.outputDir, config.allowOutsideRoot);
  const baseRef = options.baseRef?.trim() || defaultBaseRef();
  const baseCommit = (await git(repositoryRoot, ['rev-parse', '--verify', `${baseRef}^{commit}`])).trim();
  const headCommit = (await git(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim();
  const status = await git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  const changedFiles = status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3)).sort();
  const [behind, ahead] = parseAheadBehind(await git(repositoryRoot, ['rev-list', '--left-right', '--count', `${baseCommit}...HEAD`]));
  const deadlineDecision = calculateWorkspaceComparisonDeadline(
    await workspaceComparisonDeadlineLoad(root, options, config),
  );
  const deadlineController = new AbortController();
  const inheritedSignal = config.openRouter.signal;
  const abortFromInheritedSignal = (): void => deadlineController.abort();
  inheritedSignal?.addEventListener('abort', abortFromInheritedSignal, { once: true });
  if (inheritedSignal?.aborted) deadlineController.abort();
  let deadlineExpired = false;
  const deadlineTimer = setTimeout(() => {
    deadlineExpired = true;
    deadlineController.abort();
  }, deadlineDecision.effectiveDeadlineMs);
  const temporaryParent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-compare-'));
  const baseWorktree = path.join(temporaryParent, 'base');
  try {
    await git(repositoryRoot, ['worktree', 'add', '--detach', baseWorktree, baseCommit]);
    const baseRoot = path.join(baseWorktree, relativeAnalysisRoot);
    const pipelineOptions = commonPipelineOptions({ ...options, outputDir }, config);
    const baseOptions = await optionsForRoot(baseRoot, { ...pipelineOptions, root: baseRoot, outputDir: '.intent-compare-base' });
    const currentOptions = await optionsForRoot(root, { ...pipelineOptions, root, outputDir });
    const boundedOpenRouter = { ...config.openRouter, signal: deadlineController.signal };
    const baseConfig = { ...config, root: baseRoot, openRouter: boundedOpenRouter };
    const currentConfig = { ...config, root, openRouter: boundedOpenRouter };

    let baseRun: Awaited<ReturnType<typeof runPipeline>>;
    let currentRun: Awaited<ReturnType<typeof runPipeline>>;
    try {
      baseRun = await runPipeline(baseOptions, baseConfig);
      currentRun = await runPipeline(currentOptions, currentConfig);
    } catch (error) {
      if (deadlineExpired) {
        throw new Error(
          `Workspace comparison LLM deadline exceeded after ${deadlineDecision.effectiveDeadlineMs} ms `
          + `(base ${deadlineDecision.baseDeadlineMs} ms, adaptive ${deadlineDecision.multiplier}x)`,
        );
      }
      throw error;
    }
    const [baseGraph, currentGraph, baseDiagnostics, currentDiagnostics] = await Promise.all([
      readJson<IntentGraph>(baseRun.graphPath),
      readJson<IntentGraph>(currentRun.graphPath),
      readJson<DiagnosticReport>(baseRun.diagnosticsPath),
      readJson<DiagnosticReport>(currentRun.diagnosticsPath),
    ]);
    const baseReality = buildRealityView(baseGraph, baseDiagnostics);
    const currentReality = buildRealityView(currentGraph, currentDiagnostics);
    const diff = diffIntentGraphs(baseGraph, currentGraph);
    const baseCoverage = coverage(baseReality, baseDiagnostics);
    const currentCoverage = coverage(currentReality, currentDiagnostics);
    const alignmentRateDelta = rounded(currentCoverage.alignmentRate - baseCoverage.alignmentRate);
    const implementationCoverageDelta = rounded(currentCoverage.implementationCoverage - baseCoverage.implementationCoverage);
    const plannedCodeCoverageDelta = rounded(currentCoverage.plannedCodeCoverage - baseCoverage.plannedCodeCoverage);
    const documentedCodeCoverageDelta = rounded(currentCoverage.documentedCodeCoverage - baseCoverage.documentedCodeCoverage);
    const gapsDelta = currentCoverage.gaps - baseCoverage.gaps;
    const diagnosticsDelta = diagnosticDelta(baseDiagnostics, currentDiagnostics);
    const comparisonId = newRunId();
    const comparisonDirectory = path.resolve(root, outputDir, 'comparisons', comparisonId);
    await fs.mkdir(comparisonDirectory, { recursive: true });

    const artifacts = artifactPaths(root, comparisonDirectory);
    const result: WorkspaceComparison = {
      schemaVersion: 't2c.workspace-comparison/v1',
      generatedAt: new Date().toISOString(),
      base: { ref: baseRef, commit: baseCommit, graphFingerprint: baseGraph.fingerprint, coverage: baseCoverage },
      workspace: {
        headCommit,
        dirty: changedFiles.length > 0,
        changedFiles,
        ahead,
        behind,
        graphFingerprint: currentGraph.fingerprint,
        coverage: currentCoverage,
      },
      trend: {
        direction: classifyWorkspaceTrend({
          implementationCoverageDelta,
          documentedCodeCoverageDelta,
          documentationComparable: baseCoverage.documentationMeasured || currentCoverage.documentationMeasured,
          diagnosticsDelta,
        }),
        alignmentRateDelta,
        implementationCoverageDelta,
        plannedCodeCoverageDelta,
        documentedCodeCoverageDelta,
        alignedDelta: currentCoverage.aligned - baseCoverage.aligned,
        gapsDelta,
        diagnosticsDelta,
      },
      diff,
      artifacts,
    };

    await Promise.all([
      writeJson(path.join(comparisonDirectory, 'comparison.json'), result),
      writeJson(path.join(comparisonDirectory, 'base.graph.json'), baseGraph),
      writeJson(path.join(comparisonDirectory, 'workspace.graph.json'), currentGraph),
      writeJson(path.join(comparisonDirectory, 'base.manifest.json'), baseRun.manifest),
      writeJson(path.join(comparisonDirectory, 'workspace.manifest.json'), currentRun.manifest),
      writeText(path.join(comparisonDirectory, 'intent-diff.svg'), renderGraphDiffSvg(diff)),
      writeText(path.join(comparisonDirectory, 'base-reality.md'), renderRealityMarkdown(baseReality)),
      writeText(path.join(comparisonDirectory, 'workspace-reality.md'), renderRealityMarkdown(currentReality)),
      writeText(path.join(comparisonDirectory, 'workspace-reality.svg'), renderRealitySvg(currentReality, { gapsOnly: false, maxRows: 100 })),
      writeText(path.join(comparisonDirectory, 'trend.md'), renderTrendMarkdown(result)),
    ]);
    return result;
  } finally {
    clearTimeout(deadlineTimer);
    inheritedSignal?.removeEventListener('abort', abortFromInheritedSignal);
    try {
      await git(repositoryRoot, ['worktree', 'remove', '--force', baseWorktree]);
    } catch {
      // The worktree may not have been created; the private temp directory is
      // still removed below and Git can prune a stale registration later.
    }
    await fs.rm(temporaryParent, { recursive: true, force: true });
  }
}

async function workspaceComparisonDeadlineLoad(
  root: string,
  options: WorkspaceComparisonOptions,
  config: T2CConfig,
): Promise<WorkspaceComparisonDeadlineLoad> {
  const files = new Set<string>();
  const addIfPresent = async (file: string | null | undefined): Promise<void> => {
    if (!file) return;
    const absolute = path.resolve(root, file);
    const relative = path.relative(root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return;
    try {
      if ((await fs.stat(absolute)).isFile()) files.add(absolute);
    } catch {
      // Missing optional inputs are skipped by the pipeline too.
    }
  };
  await Promise.all([
    addIfPresent(options.taskFile),
    addIfPresent(options.todoFile === undefined ? 'TODO.md' : options.todoFile),
    addIfPresent(options.changelogFile === undefined ? 'CHANGELOG.md' : options.changelogFile),
  ]);
  const documentFiles = await resolveGlobs(
    root,
    options.documentPatterns ?? config.documentPatterns,
    options.documentExcludes ?? config.documentExcludes,
  );
  const documentFileSet = new Set(documentFiles);
  for (const file of documentFiles) files.add(file);

  let inputBytes = 0;
  let documentChunks = 0;
  for (const file of files) {
    const size = (await fs.stat(file)).size;
    inputBytes += size;
    if (documentFileSet.has(file)) {
      documentChunks += Math.min(config.documentMaxChunks, Math.max(1, Math.ceil(size / config.documentChunkChars)));
    }
  }
  const markdownMode = options.markdownMode ?? config.markdownMode;
  const communicationMode = options.communicationMode ?? config.communicationMode;
  const semanticUnitsPerPipeline = (options.includeDocumentationLlm ? documentChunks : 0)
    + (markdownMode === 'deterministic' ? 0 : 2)
    + (config.nlMode === 'deterministic' || !options.taskFile ? 0 : 1)
    + (communicationMode === 'deterministic' ? 0 : 1);
  return {
    inputBytes: inputBytes * 2,
    llmWorkUnits: semanticUnitsPerPipeline * 2,
  };
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Workspace comparison ${name} must be a non-negative safe integer`);
  }
}

/**
 * Every other scoping call site honours `T2C_ALLOW_OUTSIDE_ROOT`; this one hard
 * coded the restriction, so comparing a third-party checkout while keeping its
 * artifacts out of the tree failed where the same `--out` works for `pipeline`.
 * The default stays closed.
 */
async function scopedOutputDirectory(
  root: string,
  requested: string,
  allowOutsideRoot: boolean,
): Promise<string> {
  const absolute = await assertPathWithinRoot(root, path.resolve(root, requested), allowOutsideRoot);
  const relative = path.relative(root, absolute);
  if (!relative) return '.';
  // A directory deliberately placed outside the analysed tree keeps its
  // absolute form: a `../..` chain resolves correctly but reads as a defect
  // in the manifest.
  return relative.startsWith('..') ? absolute : relative;
}

function commonPipelineOptions(options: WorkspaceComparisonOptions, config: T2CConfig): PipelineOptions {
  return {
    root: options.root,
    taskFile: defaulted(options.taskFile, null),
    todoFile: options.todoFile === undefined ? 'TODO.md' : options.todoFile,
    changelogFile: options.changelogFile === undefined ? 'CHANGELOG.md' : options.changelogFile,
    documentPatterns: defaulted(options.documentPatterns, config.documentPatterns),
    documentExcludes: defaulted(options.documentExcludes, config.documentExcludes),
    includeDocumentationLlm: defaulted(options.includeDocumentationLlm, false),
    outputDir: defaulted(options.outputDir, config.outputDir),
    gitCommitCount: defaulted(options.gitCommitCount, config.gitCommitCount),
    allowSummaryFallback: true,
    includeSummaryLlm: false,
    nlMode: config.nlMode,
    markdownMode: defaulted(options.markdownMode, config.markdownMode),
    communicationMode: defaulted(options.communicationMode, config.communicationMode),
  };
}

function defaulted<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

async function optionsForRoot(root: string, options: PipelineOptions): Promise<PipelineOptions> {
  return {
    ...options,
    taskFile: await existingFile(root, options.taskFile),
    todoFile: await existingFile(root, options.todoFile),
    changelogFile: await existingFile(root, options.changelogFile),
  };
}

async function existingFile(root: string, file: string | null): Promise<string | null> {
  if (!file) return null;
  const relative = path.isAbsolute(file) ? path.relative(root, file) : file;
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return await pathExists(path.resolve(root, relative)) ? relative : null;
}

function coverage(view: IntentRealityView, diagnostics: DiagnosticReport): CoverageSnapshot {
  return {
    ...view.totals,
    alignmentRate: view.totals.topics ? rounded(view.totals.aligned / view.totals.topics) : 1,
    diagnostics: { ...diagnostics.counts },
  };
}

function diagnosticDelta(before: DiagnosticReport, after: DiagnosticReport): DiagnosticReport['counts'] {
  return {
    info: after.counts.info - before.counts.info,
    warning: after.counts.warning - before.counts.warning,
    review_required: after.counts.review_required - before.counts.review_required,
    blocking: after.counts.blocking - before.counts.blocking,
  };
}

export function classifyWorkspaceTrend(deltas: {
  implementationCoverageDelta: number;
  documentedCodeCoverageDelta: number;
  documentationComparable: boolean;
  diagnosticsDelta: DiagnosticReport['counts'];
}): WorkspaceComparison['trend']['direction'] {
  // Only declared/business-topic implementation and comparable documentation
  // decide the headline direction. AST-only module growth, source-line churn,
  // raw gap counts and planned-code denominators remain visible metrics but do
  // not turn an otherwise unchanged workspace into a regression.
  const coverageDeltas = [
    deltas.implementationCoverageDelta,
    ...(deltas.documentationComparable ? [deltas.documentedCodeCoverageDelta] : []),
  ];
  const severeDelta = deltas.diagnosticsDelta.blocking + deltas.diagnosticsDelta.review_required;
  const improved = coverageDeltas.some((delta) => delta > 0) || severeDelta < 0;
  const regressed = coverageDeltas.some((delta) => delta < 0) || severeDelta > 0;
  if (improved && regressed) return 'mixed';
  if (improved) return 'improved';
  if (regressed) return 'regressed';
  return 'unchanged';
}

function parseAheadBehind(value: string): [number, number] {
  const [behind = '0', ahead = '0'] = value.trim().split(/\s+/);
  return [Number(behind) || 0, Number(ahead) || 0];
}

function defaultBaseRef(): string {
  return 'origin/main';
}

function rounded(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function artifactPaths(root: string, directory: string): Record<string, string> {
  const relative = (name: string): string => path.relative(root, path.join(directory, name)).replace(/\\/g, '/');
  return {
    comparison: relative('comparison.json'),
    baseGraph: relative('base.graph.json'),
    workspaceGraph: relative('workspace.graph.json'),
    baseManifest: relative('base.manifest.json'),
    workspaceManifest: relative('workspace.manifest.json'),
    diffSvg: relative('intent-diff.svg'),
    baseRealityMarkdown: relative('base-reality.md'),
    workspaceRealityMarkdown: relative('workspace-reality.md'),
    workspaceRealitySvg: relative('workspace-reality.svg'),
    trendMarkdown: relative('trend.md'),
  };
}

function renderTrendMarkdown(result: WorkspaceComparison): string {
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  return `# Origin vs workspace intent\n\n`
    + `- Base: \`${result.base.ref}\` at \`${result.base.commit}\`\n`
    + `- Workspace HEAD: \`${result.workspace.headCommit}\`; dirty: **${result.workspace.dirty ? 'yes' : 'no'}**; ahead/behind: ${result.workspace.ahead}/${result.workspace.behind}\n`
    + `- Changed files before analysis: ${result.workspace.changedFiles.length}\n`
    + `- Trend: **${result.trend.direction}**\n`
    + `- Alignment: ${percent(result.base.coverage.alignmentRate)} → ${percent(result.workspace.coverage.alignmentRate)} (${percent(result.trend.alignmentRateDelta)})\n`
    + `- Declared intent implemented: ${percent(result.base.coverage.implementationCoverage)} → ${percent(result.workspace.coverage.implementationCoverage)} (${percent(result.trend.implementationCoverageDelta)})\n`
    + `- Code with a plan: ${percent(result.base.coverage.plannedCodeCoverage)} → ${percent(result.workspace.coverage.plannedCodeCoverage)} (${percent(result.trend.plannedCodeCoverageDelta)})\n`
    + `- Code with documentation: ${documentationLine(result, percent)}\n`
    + `- Gaps: ${result.base.coverage.gaps} → ${result.workspace.coverage.gaps} (${result.trend.gapsDelta >= 0 ? '+' : ''}${result.trend.gapsDelta})\n`
    + `- Intent records: +${result.diff.summary.recordsAdded} / -${result.diff.summary.recordsRemoved} / ~${result.diff.summary.recordsChanged}\n`;
}

/**
 * Documentation coverage is only comparable when at least one side actually
 * extracted documentation. Both sides run the same configuration, so an
 * offline comparison would otherwise report a confident "0.0% → 0.0%".
 */
function documentationLine(result: WorkspaceComparison, percent: (value: number) => string): string {
  if (!result.base.coverage.documentationMeasured && !result.workspace.coverage.documentationMeasured) {
    return 'not measured (documentation extraction did not run on either side)';
  }
  return `${percent(result.base.coverage.documentedCodeCoverage)} → ${percent(result.workspace.coverage.documentedCodeCoverage)}`
    + ` (${percent(result.trend.documentedCodeCoverageDelta)})`;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
}
