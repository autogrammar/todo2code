import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { T2CConfig } from '../config/env.js';
import { pathExists } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import type { DiagnosticReport, PipelineOptions } from '../core/types.js';
import type { IntentRealityView } from '../diff/reality.js';
import type { CoverageSnapshot, WorkspaceComparisonOptions } from './workspace-types.js';

const execFileAsync = promisify(execFile);

export function assertNonNegativeInteger(value: number, name: string): void {
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
export async function scopedOutputDirectory(
  root: string,
  requested: string,
  allowOutsideRoot: boolean,
): Promise<string> {
  const absolute = await assertPathWithinRoot(root, path.resolve(root, requested), allowOutsideRoot);
  const relative = path.relative(root, absolute);
  if (!relative) return '.';
  return relative.startsWith('..') ? absolute : relative;
}

export function commonPipelineOptions(options: WorkspaceComparisonOptions, config: T2CConfig): PipelineOptions {
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

export async function optionsForRoot(root: string, options: PipelineOptions): Promise<PipelineOptions> {
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

export function coverage(view: IntentRealityView, diagnostics: DiagnosticReport): CoverageSnapshot {
  return {
    ...view.totals,
    alignmentRate: view.totals.topics ? rounded(view.totals.aligned / view.totals.topics) : 1,
    diagnostics: { ...diagnostics.counts },
  };
}

export function diagnosticDelta(before: DiagnosticReport, after: DiagnosticReport): DiagnosticReport['counts'] {
  return {
    info: after.counts.info - before.counts.info,
    warning: after.counts.warning - before.counts.warning,
    review_required: after.counts.review_required - before.counts.review_required,
    blocking: after.counts.blocking - before.counts.blocking,
  };
}

export function parseAheadBehind(value: string): [number, number] {
  const [behind = '0', ahead = '0'] = value.trim().split(/\s+/);
  return [Number(behind) || 0, Number(ahead) || 0];
}

export function defaultBaseRef(): string {
  return 'origin/main';
}

export function rounded(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
}
