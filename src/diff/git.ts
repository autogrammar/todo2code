// Git-backed input for the file diff view.
//
// Rather than parsing `git diff` output, this module fetches both sides of each
// changed file and re-diffs them with the local Myers engine. That keeps a
// single diff implementation in the codebase, so `--mode files` and
// `--mode git` always produce byte-identical hunks for identical inputs.

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { diffText, type DiffTextOptions, type FileDiff } from './text.js';
import { isProbablyBinary } from './git-binary.js';

const execFileAsync = promisify(execFile);

export interface GitDiffOptions extends DiffTextOptions {
  root: string;
  /** Base revision to compare against; defaults to HEAD. */
  revision?: string;
  /** Compare the index against the base revision instead of the work tree. */
  staged?: boolean;
  /** Limit to these repository-relative paths. */
  paths?: string[];
  /** Upper bound on files rendered in one run. */
  maxFiles?: number;
}

export interface GitDiffResult {
  revision: string;
  staged: boolean;
  diffs: FileDiff[];
  warnings: string[];
}

interface ChangedEntry {
  status: string;
  path: string;
  previousPath: string | null;
}

interface ResolvedGitDiffOptions {
  root: string;
  revision: string;
  staged: boolean;
  maxFiles: number;
}

export async function collectGitDiff(options: GitDiffOptions): Promise<GitDiffResult> {
  const normalized = resolveGitDiffOptions(options);
  const warnings: string[] = [];

  const worktree = await getWorktreeStatus(normalized.root);
  if (!worktree.available) {
    return { ...normalized, diffs: [], warnings: [`Git repository not available at ${normalized.root}`] };
  }
  if (!worktree.inside) {
    return { ...normalized, diffs: [], warnings: [`${normalized.root} is not a Git work tree`] };
  }

  const args = buildNameStatusArgs(normalized, options.paths);
  let entries: ChangedEntry[];
  try {
    entries = parseNameStatus(await runGit(normalized.root, args));
  } catch (error) {
    return {
      ...normalized,
      diffs: [],
      warnings: [`git diff failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const selected = capEntries(entries, normalized.maxFiles, warnings);
  const diffs = await collectFileDiffs(selected, normalized, options, warnings);
  return { ...normalized, diffs, warnings };
}

function resolveGitDiffOptions(options: GitDiffOptions): ResolvedGitDiffOptions {
  return {
    root: path.resolve(options.root),
    revision: options.revision?.trim() || 'HEAD',
    staged: options.staged ?? false,
    maxFiles: Math.max(1, Math.min(500, Math.trunc(options.maxFiles ?? 50))),
  };
}

function getWorktreeStatus(root: string): Promise<{ available: boolean; inside: boolean }> {
  return runGit(root, ['rev-parse', '--is-inside-work-tree'])
    .then((inside) => ({ available: true, inside: inside.trim() === 'true' }))
    .catch(() => ({ available: false, inside: false }));
}

function buildNameStatusArgs(options: ResolvedGitDiffOptions, paths?: string[]): string[] {
  const args = ['diff', '--name-status', '-M', '--no-ext-diff'];
  if (options.staged) args.push('--cached');
  args.push(options.revision);
  if (paths?.length) args.push('--', ...paths);
  return args;
}

function capEntries(entries: ChangedEntry[], maxFiles: number, warnings: string[]): ChangedEntry[] {
  if (entries.length <= maxFiles) return entries;
  warnings.push(`Showing ${maxFiles} of ${entries.length} changed files; raise --max-files to widen the view`);
  return entries.slice(0, maxFiles);
}

async function collectFileDiffs(
  entries: ChangedEntry[],
  options: ResolvedGitDiffOptions,
  requestOptions: GitDiffOptions,
  warnings: string[],
): Promise<FileDiff[]> {
  const diffs: FileDiff[] = [];
  for (const entry of entries) {
    const diff = await buildFileDiff(entry, options, requestOptions, warnings);
    if (diff) diffs.push(diff);
  }
  return diffs;
}

async function buildFileDiff(
  entry: ChangedEntry,
  options: ResolvedGitDiffOptions,
  requestOptions: GitDiffOptions,
  warnings: string[],
): Promise<FileDiff | null> {
  if (isProbablyBinary(entry.path)) {
    warnings.push(`Skipped binary file ${entry.path}`);
    return null;
  }

  const beforePath = entry.previousPath ?? entry.path;
  const before = await loadBeforeSnapshot(options.root, options.revision, entry);
  const after = await loadAfterSnapshot(options.root, entry, options.staged, warnings);

  const diff = diffText(before, after, {
    path: entry.path,
    beforePath,
    afterPath: entry.path,
    ...(requestOptions.context !== undefined ? { context: requestOptions.context } : {}),
    ...(requestOptions.maxCompareLines !== undefined ? { maxCompareLines: requestOptions.maxCompareLines } : {}),
  });
  return diff.hunks.length > 0 ? diff : null;
}

async function loadBeforeSnapshot(root: string, revision: string, entry: ChangedEntry): Promise<string> {
  if (entry.status.startsWith('A')) return '';
  return readBlob(root, revision, entry.previousPath ?? entry.path);
}

async function loadAfterSnapshot(
  root: string,
  entry: ChangedEntry,
  staged: boolean,
  warnings: string[],
): Promise<string> {
  if (entry.status.startsWith('D')) return '';
  if (staged) return readStagedBlob(root, entry.path, warnings);
  return readWorkingFile(root, entry.path, warnings);
}

function parseNameStatus(output: string): ChangedEntry[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0] ?? 'M';
      if (status.startsWith('R') || status.startsWith('C')) {
        return { status, previousPath: parts[1] ?? null, path: parts[2] ?? parts[1] ?? '' };
      }
      return { status, previousPath: null, path: parts[1] ?? '' };
    })
    .filter((entry) => Boolean(entry.path))
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function readBlob(root: string, revision: string, filePath: string): Promise<string> {
  try {
    return await runGit(root, ['show', `${revision}:${filePath}`], 16 * 1024 * 1024);
  } catch {
    // A file added in the working tree has no blob at the base revision.
    return '';
  }
}

async function readStagedBlob(root: string, filePath: string, warnings: string[]): Promise<string> {
  try {
    return await runGit(root, ['show', `:${filePath}`], 16 * 1024 * 1024);
  } catch (error) {
    warnings.push(`Could not read staged ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

async function readWorkingFile(root: string, filePath: string, warnings: string[]): Promise<string> {
  try {
    return await fs.readFile(path.join(root, filePath), 'utf8');
  } catch (error) {
    warnings.push(`Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

async function runGit(root: string, args: string[], maxBuffer = 4 * 1024 * 1024): Promise<string> {
  const result = await execFileAsync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer });
  return result.stdout;
}
