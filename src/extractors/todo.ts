import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import type { T2CConfig } from '../config/env.js';
import { pathExists, readText, relativePosix } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import {
  detectPolarity,
  extractPaths,
  extractSymbols,
  extractTickets,
  extractVersions,
  inferObject,
} from '../core/text.js';
import type { ExtractionResult, IntentRecord } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';
import { readListBlock } from './markdown-block.js';

/** Deterministic TODO.md -> Intent DSL converter. */
export async function extractTodo(root: string, todoPath: string, config: T2CConfig): Promise<ExtractionResult> {
  const absolute = path.resolve(root, todoPath);
  if (!(await pathExists(absolute))) return { records: [], warnings: [`TODO file not found: ${todoPath}`] };
  const body = await readText(absolute, config.maxFileBytes);
  const relative = relativePosix(root, absolute);
  const records: IntentRecord[] = [];
  const headings: string[] = [];
  const lines = body.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const heading = raw.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      headings.splice(level - 1);
      headings[level - 1] = heading[2]?.trim() ?? '';
      continue;
    }
    const task = raw.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (!task) continue;
    const checked = (task[1] ?? '').toLowerCase() === 'x';
    const block = readListBlock(lines, index, task[2] ?? '');
    index = block.endIndex;
    const text = block.text;
    const classified = await classifyAction(text, config);
    const action = classified.action;
    const resolvedPaths = await resolveTodoPaths(root, extractPaths(text), headings);
    records.push(buildRecord({
      kind: 'todo_item',
      actor: inferOwner(text),
      action,
      object: inferObject(text, action),
      target: {
        paths: resolvedPaths,
        symbols: extractSymbols(text),
        tickets: extractTickets(text),
        versions: extractVersions(text),
      },
      modality: 'required',
      polarity: detectPolarity(text),
      text,
      lifecycle: checked ? 'completed' : 'planned',
      sourceKind: 'todo',
      sourcePath: relative,
      sourceLines: { start: block.startLine, end: block.endLine },
      extractor: 't2c/markdown-todo@2',
      rawExcerpt: block.raw.join('\n'),
      epistemicClass: 'plan',
      confidence: Math.min(0.98, classified.confidence + 0.12),
      basis: [classified.basis, 'markdown_checkbox', 'heading_context'],
      metadata: {
        checked,
        headingPath: headings.filter(Boolean),
        explicitId: extractExplicitId(text),
        llmUsed: false,
      },
    }));
  }
  return { records, warnings: records.length ? [] : [`No Markdown checkbox tasks found in ${relative}`] };
}

/**
 * Resolve a bare filename against repository directories named by its Markdown
 * section.  Audit TODOs commonly put the scope in a heading (for example
 * "Problems in run.sh (examples/todo-app-ts)") and keep checklist items short.
 * Losing that scope turns a grounded task into a ticket for a non-existent
 * root file.
 */
async function resolveTodoPaths(
  root: string,
  paths: string[],
  headings: string[],
): Promise<string[]> {
  const headingDirectories = [...new Set(headings.flatMap((heading) =>
    [...heading.matchAll(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+/g)]
      .map((match) => match[0]?.replace(/^\.\//, '').replace(/\/$/, '') ?? '')
      .filter(Boolean)))];
  const output: string[] = [];
  for (const declared of paths) {
    const normalized = declared.replace(/\\/g, '/').replace(/^\.\//, '');
    if (normalized.includes('/') || await pathExists(path.resolve(root, normalized))) {
      output.push(normalized);
      continue;
    }
    const matches: string[] = [];
    for (const directory of headingDirectories) {
      const candidate = path.posix.join(directory, normalized);
      if (await pathExists(path.resolve(root, candidate))) matches.push(candidate);
    }
    if (matches.length === 1) {
      output.push(matches[0]!);
      continue;
    }
    const repositoryMatches = await findByUniqueBasename(root, normalized);
    output.push(repositoryMatches.length === 1 ? repositoryMatches[0]! : normalized);
  }
  return [...new Set(output)];
}

const PATH_SEARCH_EXCLUDES = new Set([
  '.git', '.hg', '.svn', '.intent', 'node_modules', 'dist', 'build',
  'coverage', '.venv', 'venv', '__pycache__',
]);

async function findByUniqueBasename(root: string, basename: string): Promise<string[]> {
  const matches: string[] = [];
  const pending = [path.resolve(root)];
  while (pending.length && matches.length < 2) {
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
      } else if (entry.isFile() && entry.name === basename) {
        matches.push(relativePosix(root, absolute));
        if (matches.length >= 2) break;
      }
    }
  }
  return matches.sort();
}

function inferOwner(text: string): string | null {
  const match = text.match(/(?:@owner|owner|właściciel)\s*[:=]\s*@?([\w.-]+)/i);
  return match?.[1] ?? null;
}

function extractExplicitId(text: string): string | null {
  return text.match(/\b(?:T2C|TASK|TODO)-\d+\b/i)?.[0]?.toUpperCase() ?? null;
}
