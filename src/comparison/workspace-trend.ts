import path from 'node:path';
import type { DiagnosticReport } from '../core/types.js';
import type { WorkspaceComparison } from './workspace-types.js';

export function classifyWorkspaceTrend(deltas: {
  implementationCoverageDelta: number;
  documentedCodeCoverageDelta: number;
  documentationComparable: boolean;
  diagnosticsDelta: DiagnosticReport['counts'];
}): WorkspaceComparison['trend']['direction'] {
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

export function artifactPaths(root: string, directory: string): Record<string, string> {
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

export function renderTrendMarkdown(result: WorkspaceComparison): string {
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
