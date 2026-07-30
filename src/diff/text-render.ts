import type { DiffHunk, DiffLine, FileDiff } from './text-types.js';
import {
  DARK_THEME,
  escapeXml,
  metricCard,
  sanitizeSourceLine,
  svgDocument,
  truncate,
} from './svg.js';

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

export interface SideBySideRow {
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
  const totals = summarizeDiffs(diffs);
  const body: string[] = [];
  let y = 190;
  let rendered = 0;
  let skipped = 0;

  for (const diff of diffs) {
    if (rendered >= maxRows) {
      skipped += diff.hunks.reduce((total, hunk) => total + toSideBySideRows(hunk).length, 0);
      continue;
    }
    body.push(diffHeading(diff, y, theme.accent));
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
    body: svgBody(title, diffs, totals, body, theme),
  });
}

function summarizeDiffs(diffs: FileDiff[]): { added: number; removed: number; files: number } {
  return diffs.reduce(
    (total, diff) => ({
      added: total.added + diff.summary.added,
      removed: total.removed + diff.summary.removed,
      files: total.files + 1,
    }),
    { added: 0, removed: 0, files: 0 },
  );
}

function diffHeading(diff: FileDiff, y: number, accent: string): string {
  return `<text x="40" y="${y}" class="section" fill="${accent}">${escapeXml(truncate(diff.path, 120))}`
    + ` <tspan class="label">+${diff.summary.added} −${diff.summary.removed}`
    + `${diff.truncated ? ' (truncated)' : ''}</tspan></text>`;
}

function svgBody(
  title: string,
  diffs: FileDiff[],
  totals: { added: number; removed: number; files: number },
  body: string[],
  theme = DARK_THEME,
): string {
  return [
    `  <text x="40" y="46" class="title">${escapeXml(title)}</text>`,
    `  <text x="40" y="72" class="meta">${escapeXml(diffs.map((diff) => diff.path).slice(0, 4).join(', '))}`
      + `${diffs.length > 4 ? ` +${diffs.length - 4} more` : ''}</text>`,
    `  ${metricCard(40, 92, 'Files', totals.files, theme.accent)}`,
    `  ${metricCard(230, 92, 'Lines +', totals.added, theme.added)}`,
    `  ${metricCard(420, 92, 'Lines −', totals.removed, theme.removed)}`,
    `  <g>${body.join('')}</g>`,
  ].join('\n');
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
    const fill = !changed ? null : side === 'left' ? theme.removedFill : theme.addedFill;
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

/** HTML companion for long lines that would be clipped in SVG. */
export function renderTextDiffHtml(diffs: FileDiff[], options: TextDiffSvgOptions = {}): string {
  const title = options.title?.trim() || 'todo2code File Diff';
  const sections = diffs.map(renderHtmlSection).join('\n');
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

function renderHtmlSection(diff: FileDiff): string {
  const hunks = diff.hunks.map((hunk) => {
    const rows = toSideBySideRows(hunk).map((row) => (
      `<tr>${htmlCell(row.left, 'left')}${htmlCell(row.right, 'right')}</tr>`
    )).join('\n');
    return `<tbody><tr class="hunk"><td colspan="4">@@ -${hunk.beforeStart},${hunk.beforeCount} `
      + `+${hunk.afterStart},${hunk.afterCount} @@</td></tr>\n${rows}</tbody>`;
  }).join('\n');
  return `<section><h2>${escapeXml(diff.path)} `
    + `<small>+${diff.summary.added} −${diff.summary.removed}</small></h2>`
    + `<table>${hunks}</table></section>`;
}

function htmlCell(line: DiffLine | null, side: 'left' | 'right'): string {
  if (!line) return '<td class="num"></td><td class="empty"></td>';
  const cssClass = line.type === 'equal' ? 'eq' : side === 'left' ? 'del' : 'ins';
  const number = side === 'left' ? line.beforeLine : line.afterLine;
  return `<td class="num">${number ?? ''}</td><td class="${cssClass}">${escapeXml(line.text)}</td>`;
}
