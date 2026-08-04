import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IntentRecord } from './types.js';

// Vendored and virtual-environment trees are never repository intent, and they
// are large: an unexcluded `venv/` on this repository pushed a TypeScript walk
// from 9.5k to 247k AST records — Python wheels ship bundled `.js` assets — and
// exhausted a 4 GiB heap. Ignore files remain the configurable contract; this
// set is the floor that applies even when a repository ships none.
const DEFAULT_IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.intent', '.next', '.cache', '__pycache__',
  'venv', '.venv', 'site-packages', 'vendor', 'target', '.tox', '.mypy_cache', '.pytest_cache',
]);

export async function ensureDir(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export async function readText(filePath: string, maxBytes = 524_288): Promise<string> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error(`Not a file: ${filePath}`);
  if (stat.size > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes: ${filePath}`);
  return fs.readFile(filePath, 'utf8');
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

export async function writeJsonl(filePath: string, records: IntentRecord[]): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const body = [...records]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((record) => JSON.stringify(record))
    .join('\n');
  await fs.writeFile(filePath, body ? `${body}\n` : '', 'utf8');
}

export async function readJsonl(filePath: string): Promise<IntentRecord[]> {
  const body = await readText(filePath, 32 * 1024 * 1024);
  return body
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as IntentRecord;
      } catch (error) {
        throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${String(error)}`);
      }
    });
}

export async function readJson<T>(filePath: string, maxBytes = 128 * 1024 * 1024): Promise<T> {
  // A generated graph can legitimately exceed the per-source-file limit due
  // to relation density (for example a 3.5k-record graph is roughly 50 MiB).
  // Keep an explicit artifact ceiling, but do not make the CLI unable to read
  // the output it just produced.
  return JSON.parse(await readText(filePath, maxBytes)) as T;
}

export interface WalkOptions {
  extensions?: string[];
  ignoredDirs?: string[];
  maxFiles?: number;
  /**
   * Exclusion rules for this tree, normally the merged `.gitignore`,
   * `.dockerignore` and `.intentignore` from `loadIgnoreMatcher`.
   */
  matcher?: { ignores(relativePath: string, isDirectory?: boolean): boolean };
}

export async function walkFiles(root: string, options: WalkOptions = {}): Promise<string[]> {
  const state = createWalkState(root, options);
  if (await pathExists(root)) await walkDirectory(state.base, state);
  return state.output;
}

interface WalkState {
  base: string;
  root: string;
  output: string[];
  maxFiles: number;
  extensions: Set<string> | null;
  ignored: Set<string>;
  matcher: { ignores(relativePath: string, isDirectory?: boolean): boolean };
}

function createWalkState(root: string, options: WalkOptions): WalkState {
  return {
    base: path.resolve(root),
    root,
    output: [],
    maxFiles: options.maxFiles ?? 20_000,
    extensions: options.extensions ? new Set(options.extensions.map((value) => value.toLowerCase())) : null,
    ignored: new Set([...DEFAULT_IGNORED_DIRS, ...(options.ignoredDirs ?? [])]),
    matcher: options.matcher ?? { ignores: () => false },
  };
}

async function walkDirectory(directory: string, state: WalkState): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    await walkEntry(directory, entry, state);
  }
}

async function walkEntry(
  directory: string,
  entry: { isDirectory(): boolean; isFile(): boolean; name: string },
  state: WalkState,
): Promise<void> {
  if (state.output.length >= state.maxFiles) {
    throw new Error(`File limit exceeded (${state.maxFiles}) under ${state.root}`);
  }
  const absolute = path.join(directory, entry.name);
  const relative = relativePosix(state.base, absolute);
  if (state.matcher.ignores(relative, entry.isDirectory())) return;

  if (entry.isDirectory()) {
    if (!state.ignored.has(entry.name)) await walkDirectory(absolute, state);
    return;
  }

  if (entry.isFile() && isTargetFile(entry.name, state.extensions)) {
    state.output.push(absolute);
  }
}

function isTargetFile(name: string, extensions: Set<string> | null): boolean {
  if (!extensions) return true;
  return extensions.has(path.extname(name).toLowerCase());
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, '/').replace(/^\.\//, '');
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] ?? '';
    const next = normalized[index + 1] ?? '';
    if (char === '*' && next === '*') {
      const after = normalized[index + 2] ?? '';
      if (after === '/') {
        pattern += '(?:.*/)?';
        index += 2;
      } else {
        pattern += '.*';
        index += 1;
      }
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if (char === '?') {
      pattern += '[^/]';
    } else {
      pattern += escapeRegex(char);
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesAnyGlob(relativePath: string, patterns: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

export async function resolveGlobs(root: string, includes: string[], excludes: string[] = []): Promise<string[]> {
  const files = await walkFiles(root, { maxFiles: 50_000 });
  const directFiles: string[] = [];
  for (const include of includes) {
    if (/[*?\[{]/.test(include)) continue;
    const absolute = path.resolve(root, include);
    const relative = path.relative(root, absolute).replace(/\\/g, '/');
    const explicitGeneratedSummary = /^\.intent\/runs\/[^/]+\/team-summary\.md$/.test(relative);
    if (!relative || relative.startsWith('../') || path.isAbsolute(relative)
      || (matchesAnyGlob(relative, excludes) && !explicitGeneratedSummary)) continue;
    try {
      if ((await fs.stat(absolute)).isFile()) directFiles.push(absolute);
    } catch {
      // A missing explicit document behaves like an unmatched glob.
    }
  }
  return [...new Set([...files
    .filter((file) => {
      const relative = path.relative(root, file).replace(/\\/g, '/');
      return matchesAnyGlob(relative, includes) && !matchesAnyGlob(relative, excludes);
    }), ...directFiles])].sort();
}

export function relativePosix(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}
