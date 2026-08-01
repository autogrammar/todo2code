import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import { pathExists, relativePosix } from '../core/io.js';

/**
 * Markdown prose names files the way humans talk about them: a bare basename
 * whose directory lives in the surrounding section heading, or nowhere at all.
 * Keeping that shorthand in the DSL turns a grounded statement into a target
 * for a file that does not exist, and — worse — makes TODO and CHANGELOG
 * describe the same file under two different identities, so the claim never
 * links to the plan.  Both Markdown converters therefore share one resolver.
 *
 * A repository is walked at most once per resolver, and only when a bare
 * basename actually needs it.
 */
export interface MarkdownPathResolver {
  /**
   * @param paths     Raw path-like tokens extracted from one statement.
   * @param headings  Active Markdown heading trail, used as directory scope.
   */
  resolve(paths: string[], headings?: string[]): Promise<string[]>;
}

const PATH_SEARCH_EXCLUDES = new Set([
  '.git', '.hg', '.svn', '.intent', 'node_modules', 'dist', 'build',
  'coverage', '.venv', 'venv', '__pycache__',
]);

/** Bound the walk so a pathological tree cannot stall extraction. */
const MAX_INDEXED_FILES = 20_000;

export function createMarkdownPathResolver(root: string): MarkdownPathResolver {
  let index: Promise<Map<string, string[]>> | null = null;
  const basenames = (): Promise<Map<string, string[]>> => (index ??= buildBasenameIndex(root));

  return {
    async resolve(paths: string[], headings: string[] = []): Promise<string[]> {
      const headingDirectories = headingScopes(headings);
      const output: string[] = [];
      for (const declared of paths) {
        const normalized = declared.replace(/\\/g, '/').replace(/^\.\//, '');
        if (normalized.includes('/') || await pathExists(path.resolve(root, normalized))) {
          output.push(normalized);
          continue;
        }
        const scoped: string[] = [];
        for (const directory of headingDirectories) {
          const candidate = path.posix.join(directory, normalized);
          if (await pathExists(path.resolve(root, candidate))) scoped.push(candidate);
        }
        if (scoped.length === 1) {
          output.push(scoped[0]!);
          continue;
        }
        // A basename that occurs twice is ambiguous evidence, so the shorthand
        // is preserved rather than resolved to an arbitrary side.
        const matches = (await basenames()).get(normalized) ?? [];
        output.push(matches.length === 1 ? matches[0]! : normalized);
      }
      return [...new Set(output)];
    },
  };
}

/** Directory-looking tokens in the heading trail, for example `examples/todo-app-ts`. */
function headingScopes(headings: string[]): string[] {
  return [...new Set(headings.flatMap((heading) =>
    [...heading.matchAll(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+/g)]
      .map((match) => match[0]?.replace(/^\.\//, '').replace(/\/$/, '') ?? '')
      .filter(Boolean)))];
}

async function buildBasenameIndex(root: string): Promise<Map<string, string[]>> {
  const index = new Map<string, string[]>();
  const pending = [path.resolve(root)];
  let seen = 0;
  while (pending.length && seen < MAX_INDEXED_FILES) {
    const directory = pending.pop()!;
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!PATH_SEARCH_EXCLUDES.has(entry.name) && !entry.name.startsWith('.intent-')) {
          pending.push(absolute);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      seen += 1;
      if (seen > MAX_INDEXED_FILES) break;
      const matches = index.get(entry.name);
      // Two hits already prove ambiguity; more of them change no decision.
      if (!matches) index.set(entry.name, [relativePosix(root, absolute)]);
      else if (matches.length < 2) matches.push(relativePosix(root, absolute));
    }
  }
  for (const matches of index.values()) matches.sort();
  return index;
}
