import { normalizeUnifiedDiff, splitKeep } from './code-change-plan-helpers.js';

interface UnifiedDiffHunk {
  oldStart: number;
  oldCount: number;
  newCount: number;
  lines: string[];
}

function startUnifiedDiffHunk(header: RegExpExecArray): UnifiedDiffHunk {
  return {
    oldStart: Number(header[1]),
    oldCount: header[2] === undefined ? 1 : Number(header[2]),
    newCount: header[4] === undefined ? 1 : Number(header[4]),
    lines: [],
  };
}

function isUnifiedDiffMetaLine(line: string): boolean {
  return line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ');
}

function parseUnifiedDiffHunks(diffLines: string[], expectedPath: string): UnifiedDiffHunk[] {
  const hunks: UnifiedDiffHunk[] = [];
  let current: UnifiedDiffHunk | null = null;
  for (const line of diffLines) {
    if (isUnifiedDiffMetaLine(line)) continue;
    const header = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
    if (header) {
      if (current) hunks.push(current);
      current = startUnifiedDiffHunk(header);
      continue;
    }
    if (!current) {
      if (line === '') continue;
      throw new Error(`Unified diff for ${expectedPath} has content outside hunks`);
    }
    if (line !== '') current.lines.push(line);
  }
  if (current) hunks.push(current);
  if (!hunks.length) throw new Error(`Unified diff for ${expectedPath} contains no hunks`);
  return hunks;
}

function applyUnifiedDiffHunk(
  hunk: UnifiedDiffHunk,
  baseLines: string[],
  output: string[],
  cursor: { value: number },
  expectedPath: string,
): void {
  const oldIndex = Math.max(0, hunk.oldStart - 1);
  if (oldIndex < cursor.value) throw new Error(`Unified diff for ${expectedPath} has overlapping or unordered hunks`);
  const oldCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('-')).length;
  const newCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('+')).length;
  if (oldCount !== hunk.oldCount || newCount !== hunk.newCount) {
    throw new Error(`Unified diff hunk counts do not match its header for ${expectedPath}`);
  }
  while (cursor.value < oldIndex) {
    if (cursor.value >= baseLines.length) throw new Error(`Unified diff for ${expectedPath} ran past end of file`);
    output.push(baseLines[cursor.value]!);
    cursor.value += 1;
  }
  for (const line of hunk.lines) {
    if (line.startsWith('\\')) continue;
    const mark = line[0];
    const body = line.slice(1);
    if (mark === ' ') {
      if (baseLines[cursor.value] !== body) {
        throw new Error(`Unified diff context mismatch for ${expectedPath} at line ${cursor.value + 1}`);
      }
      output.push(baseLines[cursor.value]!);
      cursor.value += 1;
    } else if (mark === '-') {
      if (baseLines[cursor.value] !== body) {
        throw new Error(`Unified diff deletion mismatch for ${expectedPath} at line ${cursor.value + 1}`);
      }
      cursor.value += 1;
    } else if (mark === '+') {
      output.push(body);
    } else if (line === '') {
      throw new Error(`Unified diff for ${expectedPath} has an unprefixed hunk line`);
    } else {
      throw new Error(`Unified diff for ${expectedPath} has unsupported hunk line`);
    }
  }
}

export function applyUnifiedDiffToText(base: string, diff: string, expectedPath: string): string {
  const normalizedDiff = normalizeUnifiedDiff(diff, expectedPath);
  const baseLines = splitKeep(base);
  const hunks = parseUnifiedDiffHunks(normalizedDiff.split('\n'), expectedPath);
  const cursor = { value: 0 };
  const output: string[] = [];
  for (const hunk of hunks) {
    applyUnifiedDiffHunk(hunk, baseLines, output, cursor, expectedPath);
  }
  while (cursor.value < baseLines.length) {
    output.push(baseLines[cursor.value]!);
    cursor.value += 1;
  }
  if (base.endsWith('\n') || output.length === 0) return `${output.join('\n')}${output.length ? '\n' : ''}`;
  return output.join('\n');
}
