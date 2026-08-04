// Deterministic line diff engine. Renderers are re-exported from text-render
// to preserve the original public module API.

export * from './text-render.js';
export type {
  DiffHunk,
  DiffLine,
  DiffTextOptions,
  FileDiff,
  LineChangeType,
} from './text-types.js';

import type { DiffHunk, DiffLine, DiffTextOptions, FileDiff, LineChangeType } from './text-types.js';
import { blockReplace, myers } from './text-myers.js';

const DEFAULT_CONTEXT = 3;
const DEFAULT_MAX_COMPARE_LINES = 4000;

export function splitLines(value: string): string[] {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function diffText(before: string, after: string, options: DiffTextOptions = {}): FileDiff {
  return diffLineArrays(splitLines(before), splitLines(after), options);
}

export function diffLineArrays(
  before: string[],
  after: string[],
  options: DiffTextOptions = {},
): FileDiff {
  const context = Math.max(0, Math.trunc(options.context ?? DEFAULT_CONTEXT));
  const maxCompareLines = Math.max(64, Math.trunc(options.maxCompareLines ?? DEFAULT_MAX_COMPARE_LINES));
  const beforePath = options.beforePath ?? options.path ?? 'a';
  const afterPath = options.afterPath ?? options.path ?? 'b';
  const { lines, truncated } = computeLineDiff(before, after, maxCompareLines);
  return {
    schemaVersion: 't2c.filediff/v1',
    path: options.path ?? afterPath,
    beforePath,
    afterPath,
    hunks: buildHunks(lines, context),
    summary: summarizeLines(lines),
    truncated,
  };
}

function summarizeLines(lines: DiffLine[]): FileDiff['summary'] {
  const summary = { added: 0, removed: 0, unchanged: 0 };
  for (const line of lines) {
    if (line.type === 'insert') summary.added += 1;
    else if (line.type === 'delete') summary.removed += 1;
    else summary.unchanged += 1;
  }
  return summary;
}

function computeLineDiff(
  before: string[],
  after: string[],
  maxCompareLines: number,
): { lines: DiffLine[]; truncated: boolean } {
  const prefix = sharedPrefixLength(before, after);
  const suffix = sharedSuffixLength(before, after, prefix);
  const lines = prefixLines(before, prefix);
  const middleBefore = before.slice(prefix, before.length - suffix);
  const middleAfter = after.slice(prefix, after.length - suffix);
  const truncated = middleBefore.length + middleAfter.length > maxCompareLines;
  const middleOps = truncated ? blockReplace(middleBefore, middleAfter) : myers(middleBefore, middleAfter);

  for (const op of middleOps) {
    lines.push({
      type: op.type,
      beforeLine: op.beforeIndex === null ? null : prefix + op.beforeIndex + 1,
      afterLine: op.afterIndex === null ? null : prefix + op.afterIndex + 1,
      text: op.text,
    });
  }
  lines.push(...suffixLines(before, after, suffix));
  return { lines, truncated };
}

function sharedPrefixLength(before: string[], after: string[]): number {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  return prefix;
}

function sharedSuffixLength(before: string[], after: string[], prefix: number): number {
  let suffix = 0;
  while (
    suffix < before.length - prefix
    && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1;
  return suffix;
}

function prefixLines(before: string[], prefix: number): DiffLine[] {
  return before.slice(0, prefix).map((text, index) => ({
    type: 'equal',
    beforeLine: index + 1,
    afterLine: index + 1,
    text,
  }));
}

function suffixLines(before: string[], after: string[], suffix: number): DiffLine[] {
  const lines: DiffLine[] = [];
  for (let index = 0; index < suffix; index += 1) {
    const beforeIndex = before.length - suffix + index;
    const afterIndex = after.length - suffix + index;
    lines.push({
      type: 'equal',
      beforeLine: beforeIndex + 1,
      afterLine: afterIndex + 1,
      text: before[beforeIndex] ?? '',
    });
  }
  return lines;
}

function buildHunks(lines: DiffLine[], context: number): DiffHunk[] {
  const changeIndexes = lines
    .map((line, index) => (line.type === 'equal' ? -1 : index))
    .filter((index) => index >= 0);
  if (changeIndexes.length === 0) return [];
  const ranges: Array<[number, number]> = [];
  for (const index of changeIndexes) {
    const start = Math.max(0, index - context);
    const end = Math.min(lines.length - 1, index + context);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  return ranges.map(([start, end]) => hunkFromRange(lines, start, end));
}

function hunkFromRange(lines: DiffLine[], start: number, end: number): DiffHunk {
  const slice = lines.slice(start, end + 1);
  const beforeNumbers = slice.map((line) => line.beforeLine).filter((value): value is number => value !== null);
  const afterNumbers = slice.map((line) => line.afterLine).filter((value): value is number => value !== null);
  return {
    beforeStart: beforeNumbers[0] ?? 0,
    beforeCount: beforeNumbers.length,
    afterStart: afterNumbers[0] ?? 0,
    afterCount: afterNumbers.length,
    lines: slice,
  };
}
