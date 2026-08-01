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
import type { ExtractionResult, IntentRecord } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';
import { readListBlock } from './markdown-block.js';
import { createMarkdownPathResolver, type MarkdownPathResolver } from './markdown-paths.js';

/** Deterministic TODO.md -> Intent DSL converter. */
export async function extractTodo(
  root: string,
  todoPath: string,
  config: T2CConfig,
  /** Shared with the CHANGELOG converter so one repository walk serves both. */
  pathResolver: MarkdownPathResolver = createMarkdownPathResolver(root),
): Promise<ExtractionResult> {
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
    const resolvedPaths = await pathResolver.resolve(extractPaths(text), headings);
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

function inferOwner(text: string): string | null {
  const match = text.match(/(?:@owner|owner|właściciel)\s*[:=]\s*@?([\w.-]+)/i);
  return match?.[1] ?? null;
}

function extractExplicitId(text: string): string | null {
  return text.match(/\b(?:T2C|TASK|TODO)-\d+\b/i)?.[0]?.toUpperCase() ?? null;
}
