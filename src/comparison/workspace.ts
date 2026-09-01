import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { newRunId } from '../core/id.js';
import { readJson, writeJson, writeText } from '../core/io.js';
import type { DiagnosticReport, IntentGraph } from '../core/types.js';
import { buildRealityView, renderRealityMarkdown, renderRealitySvg } from '../diff/reality.js';
import { diffIntentGraphs, renderGraphDiffSvg } from '../graph/diff.js';
import { runPipeline } from '../pipeline/run.js';
import {
  calculateWorkspaceComparisonDeadline,
  WORKSPACE_COMPARISON_GRAPH_MAX_BYTES,
  workspaceComparisonDeadlineLoad,
} from './workspace-deadline.js';
import {
  commonPipelineOptions,
  coverage,
  defaultBaseRef,
  diagnosticDelta,
  git,
  optionsForRoot,
  parseAheadBehind,
  rounded,
  scopedOutputDirectory,
} from './workspace-helpers.js';
import { artifactPaths, classifyWorkspaceTrend, renderTrendMarkdown } from './workspace-trend.js';
import type { WorkspaceComparison, WorkspaceComparisonOptions } from './workspace-types.js';

export {
  calculateWorkspaceComparisonDeadline,
  WORKSPACE_COMPARISON_DEADLINE_POLICY,
  WORKSPACE_COMPARISON_GRAPH_MAX_BYTES,
} from './workspace-deadline.js';
export { classifyWorkspaceTrend } from './workspace-trend.js';
export type {
  CoverageSnapshot,
  WorkspaceComparison,
  WorkspaceComparisonDeadlineDecision,
  WorkspaceComparisonDeadlineLoad,
  WorkspaceComparisonOptions,
} from './workspace-types.js';

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
  const statusArguments = ['status', '--porcelain=v1', '--untracked-files=all'];
  const outputRelativeToRepository = path.relative(repositoryRoot, path.resolve(root, outputDir));
  if (outputRelativeToRepository && !outputRelativeToRepository.startsWith('..') && !path.isAbsolute(outputRelativeToRepository)) {
    const normalizedOutput = outputRelativeToRepository.replace(/\\/g, '/');
    statusArguments.push('--', '.', `:(exclude,top)${normalizedOutput}`, `:(exclude,top)${normalizedOutput}/**`);
  }
  const status = await git(repositoryRoot, statusArguments);
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
    const baseConfig = {
      ...config,
      root: baseRoot,
      outputDir: baseOptions.outputDir,
      openRouter: boundedOpenRouter,
    };
    const currentConfig = {
      ...config,
      root,
      outputDir: currentOptions.outputDir,
      openRouter: boundedOpenRouter,
    };

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
      readJson<IntentGraph>(baseRun.graphPath, WORKSPACE_COMPARISON_GRAPH_MAX_BYTES),
      readJson<IntentGraph>(currentRun.graphPath, WORKSPACE_COMPARISON_GRAPH_MAX_BYTES),
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
    const diagnosticsDeltaCounts = diagnosticDelta(baseDiagnostics, currentDiagnostics);
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
          diagnosticsDelta: diagnosticsDeltaCounts,
        }),
        alignmentRateDelta,
        implementationCoverageDelta,
        plannedCodeCoverageDelta,
        documentedCodeCoverageDelta,
        alignedDelta: currentCoverage.aligned - baseCoverage.aligned,
        gapsDelta,
        diagnosticsDelta: diagnosticsDeltaCounts,
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
