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

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tar',
  '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.wasm', '.so', '.dylib', '.dll',
]);

export async function collectGitDiff(options: GitDiffOptions): Promise<GitDiffResult> {
  const root = path.resolve(options.root);
  const revision = options.revision?.trim() || 'HEAD';
  const staged = options.staged ?? false;
  const maxFiles = Math.max(1, Math.min(500, Math.trunc(options.maxFiles ?? 50)));
  const warnings: string[] = [];

  try {
    const inside = (await runGit(root, ['rev-parse', '--is-inside-work-tree'])).trim();
    if (inside !== 'true') return { revision, staged, diffs: [], warnings: [`${root} is not a Git work tree`] };
  } catch {
    return { revision, staged, diffs: [], warnings: [`Git repository not available at ${root}`] };
  }

  const args = ['diff', '--name-status', '-M', '--no-ext-diff'];
  if (staged) args.push('--cached');
  args.push(revision);
  if (options.paths?.length) args.push('--', ...options.paths);

  let entries: ChangedEntry[];
  try {
    entries = parseNameStatus(await runGit(root, args));
  } catch (error) {
    return {
      revision,
      staged,
      diffs: [],
      warnings: [`git diff failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  if (entries.length > maxFiles) {
    warnings.push(`Showing ${maxFiles} of ${entries.length} changed files; raise --max-files to widen the view`);
    entries = entries.slice(0, maxFiles);
  }

  const diffs: FileDiff[] = [];
  for (const entry of entries) {
    if (isProbablyBinary(entry.path)) {
      warnings.push(`Skipped binary file ${entry.path}`);
      continue;
    }
    const beforePath = entry.previousPath ?? entry.path;
    const before = entry.status.startsWith('A')
      ? ''
      : await readBlob(root, revision, beforePath);
    const after = entry.status.startsWith('D')
      ? ''
      : staged
        ? await readStagedBlob(root, entry.path, warnings)
        : await readWorkingFile(root, entry.path, warnings);

    const diff = diffText(before, after, {
      path: entry.path,
      beforePath,
      afterPath: entry.path,
      ...(options.context !== undefined ? { context: options.context } : {}),
      ...(options.maxCompareLines !== undefined ? { maxCompareLines: options.maxCompareLines } : {}),
    });
    if (diff.hunks.length > 0) diffs.push(diff);
  }

  return { revision, staged, diffs, warnings };
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

function isProbablyBinary(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
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
