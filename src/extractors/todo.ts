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

function inferOwner(text: string): string | null {
  const match = text.match(/(?:@owner|owner|właściciel)\s*[:=]\s*@?([\w.-]+)/i);
  return match?.[1] ?? null;
}

function extractExplicitId(text: string): string | null {
  return text.match(/\b(?:T2C|TASK|TODO)-\d+\b/i)?.[0]?.toUpperCase() ?? null;
}
