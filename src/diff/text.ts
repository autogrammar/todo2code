// Deterministic line diff plus SVG/HTML/unified renderers.
//
// The engine is a self-contained Myers O(ND) implementation. It never shells
// out and never calls an LLM, so `t2c diff --mode files` stays inside the
// deterministic half of the runtime documented in README.md.

import {
  DARK_THEME,
  escapeXml,
  metricCard,
  sanitizeSourceLine,
  svgDocument,
  truncate,
} from './svg.js';

export type LineChangeType = 'equal' | 'insert' | 'delete';

export interface DiffLine {
  type: LineChangeType;
  /** 1-based line number in the "before" text, or null for inserted lines. */
  beforeLine: number | null;
  /** 1-based line number in the "after" text, or null for deleted lines. */
  afterLine: number | null;
  text: string;
}

export interface DiffHunk {
  beforeStart: number;
  beforeCount: number;
  afterStart: number;
  afterCount: number;
  lines: DiffLine[];
}

export interface FileDiff {
  schemaVersion: 't2c.filediff/v1';
  path: string;
  beforePath: string;
  afterPath: string;
  hunks: DiffHunk[];
  summary: {
    added: number;
    removed: number;
    unchanged: number;
  };
  /** True when the pair exceeded `maxCompareLines` and was reduced to a block replace. */
  truncated: boolean;
}

export interface DiffTextOptions {
  path?: string;
  beforePath?: string;
  afterPath?: string;
  /** Lines of unchanged context kept around each change. */
  context?: number;
  /**
   * Myers keeps one trace row per edit-script step, so worst-case memory grows
   * with (before + after)^2. Beyond this budget the pair is reported as a single
   * replace hunk instead, which keeps the command bounded on generated files.
   */
  maxCompareLines?: number;
}

const DEFAULT_CONTEXT = 3;
const DEFAULT_MAX_COMPARE_LINES = 4000;

export function splitLines(value: string): string[] {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  // A trailing newline denotes "file ends with newline", not an extra blank line.
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
  const summary = { added: 0, removed: 0, unchanged: 0 };
  for (const line of lines) {
    if (line.type === 'insert') summary.added += 1;
    else if (line.type === 'delete') summary.removed += 1;
    else summary.unchanged += 1;
  }

  return {
    schemaVersion: 't2c.filediff/v1',
    path: options.path ?? afterPath,
    beforePath,
    afterPath,
    hunks: buildHunks(lines, context),
    summary,
    truncated,
  };
}

function computeLineDiff(
  before: string[],
  after: string[],
  maxCompareLines: number,
): { lines: DiffLine[]; truncated: boolean } {
  const lines: DiffLine[] = [];

  // Trimming the shared prefix and suffix first turns the common "one edit in a
  // large file" case into a tiny Myers problem.
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix
    && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1;

  for (let index = 0; index < prefix; index += 1) {
    lines.push({ type: 'equal', beforeLine: index + 1, afterLine: index + 1, text: before[index] ?? '' });
  }

  const middleBefore = before.slice(prefix, before.length - suffix);
  const middleAfter = after.slice(prefix, after.length - suffix);
  const truncated = middleBefore.length + middleAfter.length > maxCompareLines;

  const middleOps = truncated
    ? blockReplace(middleBefore, middleAfter)
    : myers(middleBefore, middleAfter);

  for (const op of middleOps) {
    lines.push({
      type: op.type,
      beforeLine: op.beforeIndex === null ? null : prefix + op.beforeIndex + 1,
      afterLine: op.afterIndex === null ? null : prefix + op.afterIndex + 1,
      text: op.text,
    });
  }

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

  return { lines, truncated };
}

interface RawOp {
  type: LineChangeType;
  beforeIndex: number | null;
  afterIndex: number | null;
  text: string;
}

function blockReplace(before: string[], after: string[]): RawOp[] {
  return [
    ...before.map((text, index) => ({ type: 'delete' as const, beforeIndex: index, afterIndex: null, text })),
    ...after.map((text, index) => ({ type: 'insert' as const, beforeIndex: null, afterIndex: index, text })),
  ];
}

/** Myers' greedy O(ND) diff with a stored trace for backtracking. */
function myers(before: string[], after: string[]): RawOp[] {
  const n = before.length;
  const m = after.length;
  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0) return blockReplace(before, after);

  const max = n + m;
  const offset = max;
  const trace: Int32Array[] = [];
  let v = new Int32Array(2 * max + 1);

  for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0))) {
        x = v[offset + k + 1] ?? 0;
      } else {
        x = (v[offset + k - 1] ?? 0) + 1;
      }
      let y = x - k;
      while (x < n && y < m && before[x] === after[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, before, after, d, offset);
    }
  }
  /* c8 ignore next -- unreachable: d === n + m always terminates above */
  return blockReplace(before, after);
}

function backtrack(
  trace: Int32Array[],
  before: string[],
  after: string[],
  d: number,
  offset: number,
): RawOp[] {
  const ops: RawOp[] = [];
  let x = before.length;
  let y = after.length;

  for (let step = d; step > 0; step -= 1) {
    const v = trace[step];
    if (!v) break;
    const k = x - y;
    const previousK = k === -step || (k !== step && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0))
      ? k + 1
      : k - 1;
    const previousX = v[offset + previousK] ?? 0;
    const previousY = previousX - previousK;

    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      ops.push({ type: 'equal', beforeIndex: x, afterIndex: y, text: before[x] ?? '' });
    }
    if (x === previousX) {
      y -= 1;
      ops.push({ type: 'insert', beforeIndex: null, afterIndex: y, text: after[y] ?? '' });
    } else {
      x -= 1;
      ops.push({ type: 'delete', beforeIndex: x, afterIndex: null, text: before[x] ?? '' });
    }
  }

  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    ops.push({ type: 'equal', beforeIndex: x, afterIndex: y, text: before[x] ?? '' });
  }

  return ops.reverse();
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
    // Merge overlapping or touching context windows into one hunk.
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }

  return ranges.map(([start, end]) => {
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
  });
}

/** Renders a `diff -u` compatible patch body. */
export function renderUnifiedDiff(diff: FileDiff): string {
  const output: string[] = [`--- a/${diff.beforePath}`, `+++ b/${diff.afterPath}`];
  for (const hunk of diff.hunks) {
    output.push(`@@ -${hunk.beforeStart},${hunk.beforeCount} +${hunk.afterStart},${hunk.afterCount} @@`);
    for (const line of hunk.lines) {
      const marker = line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' ';
      output.push(`${marker}${line.text}`);
    }
  }
  return `${output.join('\n')}\n`;
}

export interface TextDiffSvgOptions {
  title?: string;
  /** Maximum rendered rows across every hunk, protecting against huge output. */
  maxRows?: number;
  /** Characters shown per side before truncation. */
  maxColumns?: number;
}

interface SideBySideRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/**
 * Pairs deletions with insertions so a modified line shows old and new content
 * on the same visual row.
 */
export function toSideBySideRows(hunk: DiffHunk): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let index = 0;
  while (index < hunk.lines.length) {
    const line = hunk.lines[index];
    if (!line) break;
    if (line.type === 'equal') {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }
    const deletions: DiffLine[] = [];
    const insertions: DiffLine[] = [];
    while (index < hunk.lines.length && hunk.lines[index]?.type === 'delete') {
      deletions.push(hunk.lines[index] as DiffLine);
      index += 1;
    }
    while (index < hunk.lines.length && hunk.lines[index]?.type === 'insert') {
      insertions.push(hunk.lines[index] as DiffLine);
      index += 1;
    }
    const pairs = Math.max(deletions.length, insertions.length);
    for (let pair = 0; pair < pairs; pair += 1) {
      rows.push({ left: deletions[pair] ?? null, right: insertions[pair] ?? null });
    }
  }
  return rows;
}

export function renderTextDiffSvg(diffs: FileDiff[], options: TextDiffSvgOptions = {}): string {
  const theme = DARK_THEME;
  const maxRows = Math.max(1, Math.min(4000, Math.trunc(options.maxRows ?? 400)));
  const maxColumns = Math.max(20, Math.min(300, Math.trunc(options.maxColumns ?? 88)));
  const title = options.title?.trim() || 'todo2code File Diff';

  const charWidth = 7.2;
  const rowHeight = 18;
  const gutterWidth = 52;
  const columnWidth = gutterWidth + maxColumns * charWidth + 16;
  const width = Math.round(40 + columnWidth * 2 + 24 + 40);
  const totals = diffs.reduce(
    (accumulator, diff) => ({
      added: accumulator.added + diff.summary.added,
      removed: accumulator.removed + diff.summary.removed,
      files: accumulator.files + 1,
    }),
    { added: 0, removed: 0, files: 0 },
  );

  const body: string[] = [];
  let y = 190;
  let rendered = 0;
  let skipped = 0;

  for (const diff of diffs) {
    if (rendered >= maxRows) {
      skipped += diff.hunks.reduce((total, hunk) => total + toSideBySideRows(hunk).length, 0);
      continue;
    }
    body.push(
      `<text x="40" y="${y}" class="section" fill="${theme.accent}">${escapeXml(truncate(diff.path, 120))}`
      + ` <tspan class="label">+${diff.summary.added} −${diff.summary.removed}`
      + `${diff.truncated ? ' (truncated)' : ''}</tspan></text>`,
    );
    y += 26;

    for (const hunk of diff.hunks) {
      body.push(
        `<text x="40" y="${y}" class="gutter">@@ -${hunk.beforeStart},${hunk.beforeCount}`
        + ` +${hunk.afterStart},${hunk.afterCount} @@</text>`,
      );
      y += 20;

      for (const row of toSideBySideRows(hunk)) {
        if (rendered >= maxRows) {
          skipped += 1;
          continue;
        }
        body.push(sideBySideRowMarkup(row, 40, y, columnWidth, gutterWidth, rowHeight, maxColumns, theme));
        y += rowHeight;
        rendered += 1;
      }
      y += 8;
    }
    y += 14;
  }

  if (skipped > 0) {
    body.push(`<text x="40" y="${y}" class="more">… ${skipped} more rows not rendered</text>`);
    y += 24;
  }

  return svgDocument({
    width,
    height: Math.max(320, y + 24),
    title,
    description: `File diff across ${totals.files} file(s) with ${totals.added} added and ${totals.removed} removed lines.`,
    body: [
      `  <text x="40" y="46" class="title">${escapeXml(title)}</text>`,
      `  <text x="40" y="72" class="meta">${escapeXml(diffs.map((diff) => diff.path).slice(0, 4).join(', '))}`
      + `${diffs.length > 4 ? ` +${diffs.length - 4} more` : ''}</text>`,
      `  ${metricCard(40, 92, 'Files', totals.files, theme.accent)}`,
      `  ${metricCard(230, 92, 'Lines +', totals.added, theme.added)}`,
      `  ${metricCard(420, 92, 'Lines −', totals.removed, theme.removed)}`,
      `  <g>${body.join('')}</g>`,
    ].join('\n'),
  });
}

function sideBySideRowMarkup(
  row: SideBySideRow,
  x: number,
  y: number,
  columnWidth: number,
  gutterWidth: number,
  rowHeight: number,
  maxColumns: number,
  theme = DARK_THEME,
): string {
  const cells: string[] = [];
  const sides: Array<{ line: DiffLine | null; offsetX: number; side: 'left' | 'right' }> = [
    { line: row.left, offsetX: x, side: 'left' },
    { line: row.right, offsetX: x + columnWidth + 24, side: 'right' },
  ];

  for (const { line, offsetX, side } of sides) {
    if (!line) {
      cells.push(`<rect x="${offsetX}" y="${y - rowHeight + 5}" width="${columnWidth}" height="${rowHeight}" fill="${theme.panel}" opacity="0.35"/>`);
      continue;
    }
    const changed = line.type !== 'equal';
    const fill = !changed
      ? null
      : side === 'left' ? theme.removedFill : theme.addedFill;
    if (fill) {
      cells.push(`<rect x="${offsetX}" y="${y - rowHeight + 5}" width="${columnWidth}" height="${rowHeight}" fill="${fill}"/>`);
    }
    const marker = !changed ? ' ' : side === 'left' ? '-' : '+';
    const number = side === 'left' ? line.beforeLine : line.afterLine;
    cells.push(`<text x="${offsetX + 8}" y="${y}" class="gutter">${number ?? ''}</text>`);
    cells.push(
      `<text x="${offsetX + gutterWidth}" y="${y}" class="code"`
      + `${changed ? ` fill="${side === 'left' ? theme.removed : theme.added}"` : ''}>`
      + `${escapeXml(truncate(`${marker}${sanitizeSourceLine(line.text)}`, maxColumns))}</text>`,
    );
  }
  return cells.join('');
}

/**
 * HTML rendering keeps long lines readable where SVG would clip them, so it is
 * offered alongside `--format svg` rather than replacing it.
 */
export function renderTextDiffHtml(diffs: FileDiff[], options: TextDiffSvgOptions = {}): string {
  const title = options.title?.trim() || 'todo2code File Diff';
  const sections = diffs.map((diff) => {
    const hunks = diff.hunks.map((hunk) => {
      const rows = toSideBySideRows(hunk).map((row) => {
        const cell = (line: DiffLine | null, side: 'left' | 'right'): string => {
          if (!line) return '<td class="num"></td><td class="empty"></td>';
          const cssClass = line.type === 'equal' ? 'eq' : side === 'left' ? 'del' : 'ins';
          const number = side === 'left' ? line.beforeLine : line.afterLine;
          return `<td class="num">${number ?? ''}</td><td class="${cssClass}">${escapeXml(line.text)}</td>`;
        };
        return `<tr>${cell(row.left, 'left')}${cell(row.right, 'right')}</tr>`;
      }).join('\n');
      return `<tbody><tr class="hunk"><td colspan="4">@@ -${hunk.beforeStart},${hunk.beforeCount} `
        + `+${hunk.afterStart},${hunk.afterCount} @@</td></tr>\n${rows}</tbody>`;
    }).join('\n');
    return `<section><h2>${escapeXml(diff.path)} `
      + `<small>+${diff.summary.added} −${diff.summary.removed}</small></h2>`
      + `<table>${hunks}</table></section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(title)}</title>
<style>
:root{color-scheme:dark light}
body{margin:0;padding:24px;background:#0f172a;color:#f8fafc;font:14px ui-sans-serif,system-ui}
h1{font-size:22px;margin:0 0 18px}
h2{font-size:15px;margin:26px 0 8px;color:#38bdf8;font-family:ui-monospace,monospace}
small{color:#94a3b8;font-weight:400}
table{border-collapse:collapse;width:100%;table-layout:fixed;font:12.5px ui-monospace,monospace}
td{padding:1px 8px;vertical-align:top;white-space:pre-wrap;word-break:break-word}
td.num{width:52px;text-align:right;color:#64748b;user-select:none}
td.del{background:#450a0a;color:#fca5a5}
td.ins{background:#052e16;color:#86efac}
td.eq{color:#cbd5e1}
td.empty{background:#111827;opacity:.35}
tr.hunk td{background:#1e293b;color:#94a3b8;padding:4px 8px}
@media (prefers-color-scheme: light){
  body{background:#f8fafc;color:#0f172a}
  td.eq{color:#334155}td.del{background:#fee2e2;color:#991b1b}td.ins{background:#dcfce7;color:#166534}
  td.empty{background:#e2e8f0}tr.hunk td{background:#e2e8f0;color:#475569}
}
</style></head>
<body><h1>${escapeXml(title)}</h1>
${sections}
</body></html>`;
}
