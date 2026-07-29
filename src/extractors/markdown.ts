import path from 'node:path';
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
import type { ExtractionResult, IntentAction, IntentRecord } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';

export interface MarkdownExtractionOptions {
  root: string;
  todoPath?: string | null;
  changelogPath?: string | null;
}

export async function extractMarkdownIntent(options: MarkdownExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  if (options.todoPath) {
    const todo = await extractTodo(options.root, options.todoPath, config);
    records.push(...todo.records);
    warnings.push(...todo.warnings);
  }
  if (options.changelogPath) {
    const changelog = await extractChangelog(options.root, options.changelogPath, config);
    records.push(...changelog.records);
    warnings.push(...changelog.warnings);
  }
  return { records, warnings };
}

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
    const text = task[2]?.trim() ?? '';
    const classified = await classifyAction(text, config);
    const action = classified.action;
    records.push(buildRecord({
      kind: 'todo_item',
      actor: inferOwner(text),
      action,
      object: inferObject(text, action),
      target: {
        paths: extractPaths(text),
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
      sourceLines: { start: index + 1, end: index + 1 },
      extractor: 't2c/markdown-todo@1',
      rawExcerpt: raw,
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

export async function extractChangelog(root: string, changelogPath: string, config: T2CConfig): Promise<ExtractionResult> {
  const absolute = path.resolve(root, changelogPath);
  if (!(await pathExists(absolute))) return { records: [], warnings: [`CHANGELOG file not found: ${changelogPath}`] };
  const body = await readText(absolute, config.maxFileBytes);
  const relative = relativePosix(root, absolute);
  const records: IntentRecord[] = [];
  const lines = body.split(/\r?\n/);
  let version: string | null = null;
  let releaseDate: string | null = null;
  let category = 'Changed';

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const versionHeading = raw.match(/^\s*##\s+\[?([^\]\s]+)\]?\s*(?:[-–—]\s*(\d{4}-\d{2}-\d{2}))?/);
    if (versionHeading) {
      version = versionHeading[1] ?? null;
      releaseDate = versionHeading[2] ?? null;
      continue;
    }
    const categoryHeading = raw.match(/^\s*###\s+(.+?)\s*#*\s*$/);
    if (categoryHeading) {
      category = categoryHeading[1]?.trim() ?? 'Changed';
      continue;
    }
    const bullet = raw.match(/^\s*[-*+]\s+(.+?)\s*$/);
    if (!bullet || !version) continue;
    const text = bullet[1]?.trim() ?? '';
    const action = changelogAction(category, text);
    records.push(buildRecord({
      kind: 'changelog_entry',
      action,
      subject: `release:${version}`,
      object: inferObject(text, action),
      target: {
        paths: extractPaths(text),
        symbols: extractSymbols(text),
        tickets: extractTickets(text),
        versions: [version, ...extractVersions(text)],
      },
      modality: 'claimed',
      polarity: detectPolarity(text),
      text,
      lifecycle: version.toLowerCase() === 'unreleased' ? 'proposed' : 'released',
      sourceKind: 'changelog',
      sourcePath: relative,
      sourceLines: { start: index + 1, end: index + 1 },
      extractor: 't2c/markdown-changelog@1',
      rawExcerpt: raw,
      epistemicClass: 'claim',
      confidence: 0.92,
      basis: ['markdown_release_heading', 'keep_a_changelog_category'],
      observedAt: releaseDate ? `${releaseDate}T00:00:00.000Z` : null,
      metadata: {
        version,
        releaseDate,
        category,
        llmUsed: false,
      },
    }));
  }
  return { records, warnings: records.length ? [] : [`No versioned changelog entries found in ${relative}`] };
}

function changelogAction(category: string, text: string): IntentAction {
  const normalized = category.toLowerCase();
  if (normalized.includes('add')) return 'add';
  if (normalized.includes('fix') || normalized.includes('secur')) return 'fix';
  if (normalized.includes('remov') || normalized.includes('deprecat')) return 'remove';
  if (normalized.includes('document')) return 'document';
  if (normalized.includes('test')) return 'test';
  if (normalized.includes('change')) return 'change';
  const lower = text.toLowerCase();
  if (/\badd|new|doda/.test(lower)) return 'add';
  if (/\bfix|napraw|popraw/.test(lower)) return 'fix';
  return 'release';
}

function inferOwner(text: string): string | null {
  const match = text.match(/(?:@owner|owner|właściciel)\s*[:=]\s*@?([\w.-]+)/i);
  return match?.[1] ?? null;
}

function extractExplicitId(text: string): string | null {
  return text.match(/\b(?:T2C|TASK|TODO)-\d+\b/i)?.[0]?.toUpperCase() ?? null;
}
