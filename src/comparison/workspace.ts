import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { T2CConfig } from '../config/env.js';
import { newRunId } from '../core/id.js';
import { pathExists, readJson, writeJson, writeText } from '../core/io.js';
import type { DiagnosticReport, IntentGraph, LlmExtractionMode, PipelineManifest, PipelineOptions } from '../core/types.js';
import { buildRealityView, renderRealityMarkdown, renderRealitySvg, type IntentRealityView } from '../diff/reality.js';
import { diffIntentGraphs, renderGraphDiffSvg } from '../graph/diff.js';
import { runPipeline } from '../pipeline/run.js';

const execFileAsync = promisify(execFile);

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
  const baseRef = options.baseRef?.trim() || defaultBaseRef();
  const baseCommit = (await git(repositoryRoot, ['rev-parse', '--verify', `${baseRef}^{commit}`])).trim();
  const headCommit = (await git(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim();
  const status = await git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  const changedFiles = status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3)).sort();
  const [behind, ahead] = parseAheadBehind(await git(repositoryRoot, ['rev-list', '--left-right', '--count', `${baseCommit}...HEAD`]));

  const temporaryParent = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-workspace-compare-'));
  const baseWorktree = path.join(temporaryParent, 'base');
  try {
    await git(repositoryRoot, ['worktree', 'add', '--detach', baseWorktree, baseCommit]);
    const baseRoot = path.join(baseWorktree, relativeAnalysisRoot);
    const pipelineOptions = commonPipelineOptions(options, config);
    const baseOptions = await optionsForRoot(baseRoot, { ...pipelineOptions, root: baseRoot, outputDir: '.intent-compare-base' });
    const currentOptions = await optionsForRoot(root, { ...pipelineOptions, root, outputDir: options.outputDir ?? config.outputDir });
    const baseConfig = { ...config, root: baseRoot };
    const currentConfig = { ...config, root };

    const baseRun = await runPipeline(baseOptions, baseConfig);
    const currentRun = await runPipeline(currentOptions, currentConfig);
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
    const comparisonId = newRunId();
    const comparisonDirectory = path.join(root, options.outputDir ?? config.outputDir, 'comparisons', comparisonId);
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
        direction: trendDirection({
          alignmentRateDelta,
          implementationCoverageDelta,
          plannedCodeCoverageDelta,
          documentedCodeCoverageDelta,
          gapsDelta,
        }),
        alignmentRateDelta,
        implementationCoverageDelta,
        plannedCodeCoverageDelta,
        documentedCodeCoverageDelta,
        alignedDelta: currentCoverage.aligned - baseCoverage.aligned,
        gapsDelta,
        diagnosticsDelta: diagnosticDelta(baseDiagnostics, currentDiagnostics),
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
    try {
      await git(repositoryRoot, ['worktree', 'remove', '--force', baseWorktree]);
    } catch {
      // The worktree may not have been created; the private temp directory is
      // still removed below and Git can prune a stale registration later.
    }
    await fs.rm(temporaryParent, { recursive: true, force: true });
  }
}

function commonPipelineOptions(options: WorkspaceComparisonOptions, config: T2CConfig): PipelineOptions {
  return {
    root: options.root,
    taskFile: options.taskFile ?? null,
    todoFile: options.todoFile === undefined ? 'TODO.md' : options.todoFile,
    changelogFile: options.changelogFile === undefined ? 'CHANGELOG.md' : options.changelogFile,
    documentPatterns: options.documentPatterns ?? config.documentPatterns,
    documentExcludes: options.documentExcludes ?? config.documentExcludes,
    includeDocumentationLlm: options.includeDocumentationLlm ?? false,
    outputDir: options.outputDir ?? config.outputDir,
    gitCommitCount: options.gitCommitCount ?? config.gitCommitCount,
    allowSummaryFallback: true,
    includeSummaryLlm: false,
    nlMode: config.nlMode,
    markdownMode: options.markdownMode ?? config.markdownMode,
    communicationMode: options.communicationMode ?? config.communicationMode,
  };
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

function trendDirection(deltas: {
  alignmentRateDelta: number;
  implementationCoverageDelta: number;
  plannedCodeCoverageDelta: number;
  documentedCodeCoverageDelta: number;
  gapsDelta: number;
}): WorkspaceComparison['trend']['direction'] {
  const coverageDeltas = [
    deltas.alignmentRateDelta,
    deltas.implementationCoverageDelta,
    deltas.plannedCodeCoverageDelta,
    deltas.documentedCodeCoverageDelta,
  ];
  const improved = coverageDeltas.some((delta) => delta > 0) || deltas.gapsDelta < 0;
  const regressed = coverageDeltas.some((delta) => delta < 0) || deltas.gapsDelta > 0;
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
    + `- Code with documentation: ${percent(result.base.coverage.documentedCodeCoverage)} → ${percent(result.workspace.coverage.documentedCodeCoverage)} (${percent(result.trend.documentedCodeCoverageDelta)})\n`
    + `- Gaps: ${result.base.coverage.gaps} → ${result.workspace.coverage.gaps} (${result.trend.gapsDelta >= 0 ? '+' : ''}${result.trend.gapsDelta})\n`
    + `- Intent records: +${result.diff.summary.recordsAdded} / -${result.diff.summary.recordsRemoved} / ~${result.diff.summary.recordsChanged}\n`;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
}
