import { normalizeUnifiedDiff } from './implementation-source-patch-diff.js';

/**
 * Apply a single-file unified diff to a text buffer.
 * Supports standard hunks with space/+/− prefixes. Throws on context mismatch.
 */
export function applyUnifiedDiffToText(base: string, diff: string, expectedPath: string): string {
  const baseLines = splitKeep(base);
  const hunks = parseUnifiedDiffIntoHunks(diff, expectedPath);
  const output = applyUnifiedDiffHunks(baseLines, expectedPath, hunks);
  // Reconstruct text. Files without a trailing newline end without an empty last segment.
  return joinAppliedText(base.endsWith('\n'), output);
}

function joinAppliedText(baseEndsWithNewline: boolean, lines: string[]): string {
  if (baseEndsWithNewline || lines.length === 0) return `${lines.join('\n')}${lines.length ? '\n' : ''}`;
  return lines.join('\n');
}

interface ParsedUnifiedDiffHunk {
  oldStart: number;
  oldCount: number;
  newCount: number;
  lines: string[];
}

function parseUnifiedDiffIntoHunks(diff: string, expectedPath: string): ParsedUnifiedDiffHunk[] {
  const normalizedDiff = normalizeUnifiedDiff(diff, expectedPath);
  const context = createEmptyUnifiedDiffContext();
  for (const line of parseUnifiedDiffLines(normalizedDiff)) {
    applyUnifiedDiffLineToContext(context, line, expectedPath);
  }
  return finalizeUnifiedDiffContext(context, expectedPath);
}

interface UnifiedDiffParsingContext {
  current: ParsedUnifiedDiffHunk | null;
  hunks: ParsedUnifiedDiffHunk[];
}

function createEmptyUnifiedDiffContext(): UnifiedDiffParsingContext {
  return { current: null, hunks: [] };
}

function parseUnifiedDiffLines(diff: string): string[] {
  return diff.split('\n');
}

function finalizeUnifiedDiffContext(
  context: UnifiedDiffParsingContext,
  expectedPath: string,
): ParsedUnifiedDiffHunk[] {
  if (context.current) {
    context.hunks.push(context.current);
    context.current = null;
  }
  if (!context.hunks.length) {
    throw new Error(`Unified diff for ${expectedPath} contains no hunks`);
  }
  return context.hunks;
}

function applyUnifiedDiffLineToContext(
  context: UnifiedDiffParsingContext,
  line: string,
  expectedPath: string,
): void {
  const header = parseUnifiedDiffHeader(line);
  if (header) {
    if (context.current) {
      context.hunks.push(context.current);
    }
    context.current = header;
    return;
  }
  if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
    return;
  }
  if (!context.current) {
    if (line === '') return;
    throw new Error(`Unified diff for ${expectedPath} has content outside hunks`);
  }
  // Blank lines without a unified-diff prefix separate hunks in some emitters.
  if (line === '') return;
  context.current.lines.push(line);
}

function parseUnifiedDiffHeader(line: string): ParsedUnifiedDiffHunk | null {
  const match = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
  if (!match) return null;
  return buildParsedUnifiedDiffHunk(match);
}

function buildParsedUnifiedDiffHunk(match: RegExpMatchArray): ParsedUnifiedDiffHunk {
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] === undefined ? 1 : Number(match[2]),
    newCount: match[4] === undefined ? 1 : Number(match[4]),
    lines: [],
  };
}

interface UnifiedDiffCursor {
  position: number;
}

function applyUnifiedDiffHunks(
  baseLines: string[],
  expectedPath: string,
  hunks: ParsedUnifiedDiffHunk[],
): string[] {
  const cursor: UnifiedDiffCursor = { position: 0 };
  const output: string[] = [];
  for (const hunk of hunks) {
    applyUnifiedDiffHunk(baseLines, expectedPath, cursor, output, hunk);
  }
  appendRemainingBaseLines(baseLines, cursor, output);
  return output;
}

function applyUnifiedDiffHunk(
  baseLines: string[],
  expectedPath: string,
  cursor: UnifiedDiffCursor,
  output: string[],
  hunk: ParsedUnifiedDiffHunk,
): void {
  const oldIndex = Math.max(0, hunk.oldStart - 1);
  if (oldIndex < cursor.position) throw new Error(`Unified diff for ${expectedPath} has overlapping or unordered hunks`);
  validateHunkCounts(expectedPath, hunk);
  copyBaseLinesToCursor(baseLines, expectedPath, cursor, output, oldIndex);
  for (const line of hunk.lines) {
    if (line.startsWith('\\')) continue; // "\\ No newline at end of file"
    applyUnifiedDiffLine(expectedPath, line, cursor, baseLines, output);
  }
}

function copyBaseLinesToCursor(
  baseLines: string[],
  expectedPath: string,
  cursor: UnifiedDiffCursor,
  output: string[],
  targetIndex: number,
): void {
  while (cursor.position < targetIndex) {
    if (cursor.position >= baseLines.length) throw new Error(`Unified diff for ${expectedPath} ran past end of file`);
    output.push(baseLines[cursor.position]!);
    cursor.position += 1;
  }
}

function appendRemainingBaseLines(
  baseLines: string[],
  cursor: UnifiedDiffCursor,
  output: string[],
): void {
  while (cursor.position < baseLines.length) {
    output.push(baseLines[cursor.position]!);
    cursor.position += 1;
  }
}

function validateHunkCounts(expectedPath: string, hunk: ParsedUnifiedDiffHunk): void {
  const oldCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('-')).length;
  const newCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('+')).length;
  if (oldCount !== hunk.oldCount || newCount !== hunk.newCount) {
    throw new Error(`Unified diff hunk counts do not match its header for ${expectedPath}`);
  }
}

function applyUnifiedDiffLine(
  expectedPath: string,
  line: string,
  cursor: UnifiedDiffCursor,
  baseLines: string[],
  output: string[],
): void {
  const mark = line[0];
  const body = line.slice(1);
  if (line === '') {
    throw new Error(`Unified diff for ${expectedPath} has an unprefixed hunk line`);
  }
  if (mark === ' ') {
    applyUnifiedDiffContextLine(expectedPath, body, cursor, baseLines, output);
    return;
  }
  if (mark === '-') {
    applyUnifiedDiffDeletionLine(expectedPath, body, cursor, baseLines);
    return;
  }
  if (mark === '+') {
    applyUnifiedDiffAdditionLine(body, output);
    return;
  }
  throw new Error(`Unified diff for ${expectedPath} has unsupported hunk line`);
}

function applyUnifiedDiffContextLine(
  expectedPath: string,
  body: string,
  cursor: UnifiedDiffCursor,
  baseLines: string[],
  output: string[],
): void {
  if (baseLines[cursor.position] !== body) {
    throw new Error(`Unified diff context mismatch for ${expectedPath} at line ${cursor.position + 1}`);
  }
  output.push(baseLines[cursor.position]!);
  cursor.position += 1;
}

function applyUnifiedDiffDeletionLine(
  expectedPath: string,
  body: string,
  cursor: UnifiedDiffCursor,
  baseLines: string[],
): void {
  if (baseLines[cursor.position] !== body) {
    throw new Error(`Unified diff deletion mismatch for ${expectedPath} at line ${cursor.position + 1}`);
  }
  cursor.position += 1;
}

function applyUnifiedDiffAdditionLine(body: string, output: string[]): void {
  output.push(body);
}

function splitKeep(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines;
}
