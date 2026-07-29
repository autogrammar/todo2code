// Ignore-file support for todo2code.
//
// Reads `.gitignore`, `.dockerignore` and `.intentignore` and answers whether a
// repository-relative path is excluded. Patterns follow gitignore semantics,
// which are applied uniformly to all three files: `.dockerignore` anchors every
// pattern to the context root, so a bare `node_modules` there is treated here as
// "at any depth". That is deliberately the stricter reading — the files exist to
// name build output and vendored trees, and excluding a nested copy is the
// intent in every case we ship.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const DEFAULT_IGNORE_FILES = ['.gitignore', '.dockerignore', '.intentignore'] as const;

export interface IgnoreRule {
  /** `!pattern` re-includes a path excluded by an earlier rule. */
  negated: boolean;
  /** `pattern/` matches directories only. */
  directoryOnly: boolean;
  pattern: string;
  regex: RegExp;
  /** Ignore file the rule came from, for diagnostics. */
  origin: string;
}

export interface IgnoreMatcher {
  rules: IgnoreRule[];
  /** Ignore files that were actually found and read. */
  sources: string[];
  /** True when the path, or any ancestor directory, is excluded. */
  ignores(relativePath: string, isDirectory?: boolean): boolean;
}

/**
 * Translates one gitignore pattern into an anchored regular expression.
 *
 * Returns null for blank lines and comments.
 */
export function compileIgnorePattern(line: string, origin = ''): IgnoreRule | null {
  // Trailing whitespace is insignificant unless escaped with a backslash.
  let pattern = line.replace(/(?<!\\)\s+$/, '');
  if (!pattern || pattern.startsWith('#')) return null;

  let negated = false;
  if (pattern.startsWith('!')) {
    negated = true;
    pattern = pattern.slice(1);
  }
  // `\#` and `\!` escape a literal leading character.
  if (pattern.startsWith('\\#') || pattern.startsWith('\\!')) pattern = pattern.slice(1);
  if (!pattern) return null;

  let directoryOnly = false;
  if (pattern.endsWith('/')) {
    directoryOnly = true;
    pattern = pattern.slice(0, -1);
  }
  if (!pattern) return null;

  // A pattern containing a slash anywhere but the end is anchored to the root;
  // otherwise it matches the basename at any depth.
  const anchored = pattern.includes('/');
  if (pattern.startsWith('/')) pattern = pattern.slice(1);

  const body = translateGlob(pattern);
  const prefix = anchored ? '' : '(?:.*/)?';
  return {
    negated,
    directoryOnly,
    pattern: line.trim(),
    regex: new RegExp(`^${prefix}${body}$`),
    origin,
  };
}

function translateGlob(pattern: string): string {
  let output = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? '';
    if (char === '\\') {
      const next = pattern[index + 1];
      if (next !== undefined) {
        output += escapeLiteral(next);
        index += 1;
        continue;
      }
      output += '\\\\';
      continue;
    }
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        // `**/` spans zero or more directories; a trailing `**` spans anything.
        if (pattern[index + 2] === '/') {
          output += '(?:.*/)?';
          index += 2;
        } else {
          output += '.*';
          index += 1;
        }
        continue;
      }
      output += '[^/]*';
      continue;
    }
    if (char === '?') {
      output += '[^/]';
      continue;
    }
    if (char === '[') {
      const close = pattern.indexOf(']', index + 1);
      if (close > index) {
        const body = pattern.slice(index + 1, close).replace(/\\/g, '\\\\');
        output += `[${body.startsWith('!') ? `^${body.slice(1)}` : body}]`;
        index = close;
        continue;
      }
      output += '\\[';
      continue;
    }
    output += escapeLiteral(char);
  }
  return output;
}

function escapeLiteral(char: string): string {
  return /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

export function parseIgnoreFile(content: string, origin = ''): IgnoreRule[] {
  return content
    .split(/\r?\n/)
    .map((line) => compileIgnorePattern(line, origin))
    .filter((rule): rule is IgnoreRule => rule !== null);
}

export function createIgnoreMatcher(rules: IgnoreRule[], sources: string[] = []): IgnoreMatcher {
  const normalize = (value: string): string => value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');

  /** Applies the rule list to a single path component chain; last match wins. */
  const decide = (candidate: string, isDirectory: boolean): boolean | null => {
    let result: boolean | null = null;
    for (const rule of rules) {
      if (rule.directoryOnly && !isDirectory) continue;
      if (rule.regex.test(candidate)) result = !rule.negated;
    }
    return result;
  };

  return {
    rules,
    sources,
    ignores(relativePath: string, isDirectory = false): boolean {
      const target = normalize(relativePath);
      if (!target) return false;
      const segments = target.split('/');

      // Git cannot re-include a file whose parent directory is excluded, so an
      // ignored ancestor short-circuits before any negation on the leaf.
      for (let depth = 1; depth < segments.length; depth += 1) {
        const ancestor = segments.slice(0, depth).join('/');
        if (decide(ancestor, true) === true) return true;
      }
      return decide(target, isDirectory) === true;
    },
  };
}

export interface LoadIgnoreOptions {
  /** Ignore files to read, in precedence order (later files win). */
  files?: readonly string[];
  /** Extra patterns appended after every file, always winning. */
  extraPatterns?: string[];
}

/** Reads the ignore files present under `root`; missing files are skipped. */
export async function loadIgnoreMatcher(root: string, options: LoadIgnoreOptions = {}): Promise<IgnoreMatcher> {
  const files = options.files ?? DEFAULT_IGNORE_FILES;
  const rules: IgnoreRule[] = [];
  const sources: string[] = [];

  for (const file of files) {
    const absolute = path.resolve(root, file);
    let content: string;
    try {
      content = await fs.readFile(absolute, 'utf8');
    } catch {
      continue;
    }
    rules.push(...parseIgnoreFile(content, file));
    sources.push(file);
  }

  for (const pattern of options.extraPatterns ?? []) {
    const rule = compileIgnorePattern(pattern, '<inline>');
    if (rule) rules.push(rule);
  }

  return createIgnoreMatcher(rules, sources);
}
