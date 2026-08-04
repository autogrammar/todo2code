import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { buildRecord } from '../core/record.js';
import { extractSymbols, extractTickets, extractVersions, inferObject } from '../core/text.js';
import type { ExtractionResult, IntentRecord, JsonValue } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';

const execFileAsync = promisify(execFile);
const MAX_DISCOVERED_REPOSITORIES = 100;
const MAX_DISCOVERY_DIRECTORIES = 10_000;
const REPOSITORY_READ_CONCURRENCY = 4;
const DISCOVERY_EXCLUDED_DIRECTORIES = new Set([
  '.cache', '.intent', '.venv', 'backups', 'build', 'coverage', 'dist',
  'node_modules', 'tmp', 'vendor', 'work',
]);

interface GitCommit {
  sha: string;
  author: string;
  authoredAt: string;
  subject: string;
  body: string;
}

interface ChangedFile {
  status: string;
  path: string;
  previousPath?: string;
}

export interface GitExtractionOptions {
  root: string;
  count?: number;
}

export async function extractGitIntent(options: GitExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  const root = path.resolve(options.root);
  const count = options.count ?? config.gitCommitCount;
  if (await isGitWorkTree(root)) {
    return extractRepositoryGitIntent(root, count, config, '');
  }

  const discovery = await discoverGitRepositories(root);
  if (!discovery.repositories.length) {
    return { records: [], warnings: [`Git repository not available at ${root}`] };
  }

  const results = await mapWithConcurrency(
    discovery.repositories,
    REPOSITORY_READ_CONCURRENCY,
    async (repository): Promise<ExtractionResult> => {
      try {
        return await extractRepositoryGitIntent(repository.root, count, config, repository.prefix);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          records: [],
          warnings: [`Git history unavailable at ${repository.root}: ${message}`],
        };
      }
    },
  );

  return {
    records: results.flatMap((result) => result.records),
    warnings: [...discovery.warnings, ...results.flatMap((result) => result.warnings)],
  };
}

async function extractRepositoryGitIntent(
  root: string,
  count: number,
  config: T2CConfig,
  repositoryPrefix: string,
): Promise<ExtractionResult> {
  const warnings: string[] = [];

  // A repository with no commits yet — the state `t2c init` leaves behind, and
  // the one `t2c watch` hits first — makes `git log` exit non-zero. That is an
  // absent source, not a failed run, so it degrades to a warning.
  let commits: GitCommit[];
  try {
    commits = await readCommits(root, count);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/does not have any commits yet|unknown revision|bad default revision/i.test(message)) {
      return { records: [], warnings: [`${root} has no commits yet; Git -> Intent DSL was skipped`] };
    }
    return { records: [], warnings: [`Git history unavailable at ${root}: ${message}`] };
  }

  const records: IntentRecord[] = [];
  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    if (!commit) continue;
    const changedFiles = await readChangedFiles(root, commit.sha);
    const stats = await readStats(root, commit.sha);
    const diff = await runGit(root, ['show', '--format=', '--unified=0', '--no-ext-diff', commit.sha], 8 * 1024 * 1024);
    const text = `${commit.subject}\n${commit.body}`.trim();
    const classified = await classifyAction(text, config);
    const inferredSymbols = extractChangedSymbols(diff);
    const scopedFiles = changedFiles.map((item) => scopeChangedFile(item, repositoryPrefix));
    const targetPaths = [...new Set(scopedFiles.map((item) => item.path))].sort();
    const docOnly = targetPaths.length > 0 && targetPaths.every(isDocumentationPath);
    records.push(buildRecord({
      kind: 'commit_intent_claim',
      actor: commit.author,
      action: classified.action,
      subject: `commit:${commit.sha}`,
      object: inferObject(commit.subject, classified.action),
      target: {
        paths: targetPaths,
        symbols: [...new Set([...extractSymbols(text), ...inferredSymbols])].sort(),
        tickets: extractTickets(text),
        versions: extractVersions(text),
      },
      modality: 'claimed',
      text: commit.subject,
      lifecycle: 'implemented',
      sourceKind: 'git',
      revision: commit.sha,
      commitIndex: index + 1,
      extractor: 't2c/git@2',
      rawExcerpt: text,
      epistemicClass: 'claim',
      confidence: Math.min(0.94, classified.confidence + (targetPaths.length > 0 ? 0.08 : 0)),
      basis: [classified.basis, 'commit_message', 'changed_files', ...(inferredSymbols.length ? ['diff_symbol_heuristics'] : [])],
      observedAt: commit.authoredAt,
      metadata: {
        author: commit.author,
        body: commit.body,
        docOnly,
        repositoryRoot: repositoryPrefix || '.',
        changedFiles: scopedFiles as unknown as JsonValue,
        additions: stats.additions,
        deletions: stats.deletions,
        filesChanged: targetPaths.length,
        llmUsed: false,
      },
    }));
  }
  if (commits.length < count) {
    warnings.push(`${root}: requested ${count} commits, repository contains ${commits.length}`);
  }
  return { records, warnings };
}

interface DiscoveredRepository {
  root: string;
  prefix: string;
}

interface RepositoryDiscoveryResult {
  repositories: DiscoveredRepository[];
  warnings: string[];
}

interface DiscoveryState {
  root: string;
  cursor: number;
  directoriesVisited: number;
  queue: DiscoveredRepository[];
  repositories: DiscoveredRepository[];
  warnings: string[];
}

async function discoverGitRepositories(root: string): Promise<RepositoryDiscoveryResult> {
  const state = createDiscoveryState(root);
  while (hasMoreDiscoveryWork(state)) {
    const current = takeNextDiscoveryDirectory(state);
    if (!current) continue;
    const entries = await readDiscoveryEntries(current.root, state.warnings);
    if (!entries) continue;
    await processDiscoveryDirectory(current, filterDiscoveryChildren(entries), state);
  }

  return finishDiscovery(root, state);
}

function createDiscoveryState(root: string): DiscoveryState {
  return {
    root,
    cursor: 0,
    directoriesVisited: 0,
    queue: [{ root, prefix: '' }],
    repositories: [],
    warnings: [],
  };
}

function hasMoreDiscoveryWork(state: DiscoveryState): boolean {
  return state.cursor < state.queue.length
    && state.repositories.length < MAX_DISCOVERED_REPOSITORIES
    && state.directoriesVisited < MAX_DISCOVERY_DIRECTORIES;
}

function takeNextDiscoveryDirectory(state: DiscoveryState): DiscoveredRepository | null {
  const current = state.queue[state.cursor];
  state.cursor += 1;
  if (!current) return null;
  state.directoriesVisited += 1;
  return current;
}

async function readDiscoveryEntries(
  directory: string,
  warnings: string[],
): Promise<Dirent<string>[] | null> {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    warnings.push(`Git repository discovery unavailable at ${directory}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function filterDiscoveryChildren(entries: Dirent<string>[]): Dirent<string>[] {
  return entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .filter((entry) => !entry.name.startsWith('.') && !DISCOVERY_EXCLUDED_DIRECTORIES.has(entry.name))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
}

async function processDiscoveryDirectory(
  current: DiscoveredRepository,
  directories: Dirent<string>[],
  state: DiscoveryState,
): Promise<void> {
  for (const entry of directories) {
    const child = path.join(current.root, entry.name);
    const prefix = resolveDiscoveryPrefix(current.prefix, entry.name);
    const marker = await gitMarkerState(child);
    if (marker === 'unsafe') {
      state.warnings.push(`Git repository marker is a symlink at ${child}`);
      continue;
    }
    if (marker === 'candidate') {
      await registerDiscoveredRepository(child, prefix, state);
      if (state.repositories.length >= MAX_DISCOVERED_REPOSITORIES) break;
      // A checkout owns everything below it, including submodules, vendored
      // repositories and temporary coding-agent worktrees.
      continue;
    }
    state.queue.push({ root: child, prefix });
  }
}

async function registerDiscoveredRepository(
  directory: string,
  prefix: string,
  state: DiscoveryState,
): Promise<void> {
  if (await isGitWorkTree(directory)) {
    state.repositories.push({ root: directory, prefix });
    return;
  }
  state.warnings.push(`Git repository marker is invalid at ${directory}`);
}

function resolveDiscoveryPrefix(base: string, childName: string): string {
  return base ? path.posix.join(base, childName) : childName;
}

function finishDiscovery(root: string, state: DiscoveryState): RepositoryDiscoveryResult {
  if (state.repositories.length >= MAX_DISCOVERED_REPOSITORIES) {
    state.warnings.push(`Git repository discovery stopped at ${MAX_DISCOVERED_REPOSITORIES} repositories under ${root}`);
  } else if (state.directoriesVisited >= MAX_DISCOVERY_DIRECTORIES && state.cursor < state.queue.length) {
    state.warnings.push(`Git repository discovery stopped after ${MAX_DISCOVERY_DIRECTORIES} directories under ${root}`);
  }
  return { repositories: state.repositories, warnings: state.warnings };
}

async function gitMarkerState(root: string): Promise<'none' | 'candidate' | 'unsafe'> {
  try {
    const marker = await fs.lstat(path.join(root, '.git'));
    if (marker.isSymbolicLink()) return 'unsafe';
    return marker.isDirectory() || marker.isFile() ? 'candidate' : 'none';
  } catch {
    return 'none';
  }
}

async function isGitWorkTree(root: string): Promise<boolean> {
  try {
    return (await runGit(root, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

function scopeChangedFile(file: ChangedFile, repositoryPrefix: string): ChangedFile {
  if (!repositoryPrefix) return file;
  return {
    ...file,
    path: path.posix.join(repositoryPrefix, file.path.replace(/\\/g, '/')),
    ...(file.previousPath
      ? { previousPath: path.posix.join(repositoryPrefix, file.previousPath.replace(/\\/g, '/')) }
      : {}),
  };
}

async function mapWithConcurrency<T, Result>(
  values: T[],
  concurrency: number,
  action: (value: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await action(value);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runGit(root: string, args: string[], maxBuffer = 4 * 1024 * 1024): Promise<string> {
  const result = await execFileAsync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer,
    env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
  });
  return result.stdout;
}

async function readCommits(root: string, count: number): Promise<GitCommit[]> {
  const output = await runGit(root, [
    'log',
    `-n${count}`,
    '--date=iso-strict',
    '--format=%H%x1f%an%x1f%aI%x1f%s%x1f%b%x1e',
  ]);
  return output
    .split('\x1e')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [sha = '', author = '', authoredAt = '', subject = '', ...body] = chunk.split('\x1f');
      return { sha, author, authoredAt, subject, body: body.join('\x1f').trim() };
    })
    .filter((commit) => Boolean(commit.sha));
}

async function readChangedFiles(root: string, sha: string): Promise<ChangedFile[]> {
  const output = await runGit(root, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-M', sha]);
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const parts = line.split('\t');
    const status = parts[0] ?? 'M';
    if (status.startsWith('R') || status.startsWith('C')) {
      return { status, previousPath: parts[1] ?? '', path: parts[2] ?? parts[1] ?? '' };
    }
    return { status, path: parts[1] ?? '' };
  }).filter((item) => item.path);
}

async function readStats(root: string, sha: string): Promise<{ additions: number; deletions: number }> {
  const output = await runGit(root, ['show', '--format=', '--numstat', sha]);
  let additions = 0;
  let deletions = 0;
  for (const line of output.split(/\r?\n/)) {
    const [added, removed] = line.split('\t');
    if (/^\d+$/.test(added ?? '')) additions += Number(added);
    if (/^\d+$/.test(removed ?? '')) deletions += Number(removed);
  }
  return { additions, deletions };
}

function extractChangedSymbols(diff: string): string[] {
  const output = new Set<string>();
  const patterns = [
    /^[+-]\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm,
    /^[+-]\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^[+-]\s*def\s+([A-Za-z_][\w]*)\s*\(/gm,
    /^[+-]\s*class\s+([A-Za-z_][\w]*)\b/gm,
  ];
  for (const pattern of patterns) {
    for (const match of diff.matchAll(pattern)) {
      const symbol = match[1];
      if (symbol) output.add(symbol);
    }
  }
  return [...output].sort();
}

function isDocumentationPath(filePath: string): boolean {
  return /(^|\/)(docs?|documentation)(\/|$)/i.test(filePath)
    || /(^|\/)(README|CHANGELOG|TODO|CONTRIBUTING|POLICY|MODULE|ADR)[^/]*\.md$/i.test(filePath)
    || /\.mdx?$/i.test(filePath);
}
