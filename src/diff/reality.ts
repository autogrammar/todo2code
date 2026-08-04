// Intent-vs-reality renderers.
//
// This module delegates model construction to `reality-build.ts` and focuses
// exclusively on rendering (`renderRealitySvg` / `renderRealityMarkdown`).

import { DARK_THEME, escapeXml, metricCard, svgDocument, truncate } from './svg.js';
import type { SourceKind } from '../core/types.js';

import {
  DECLARED_KINDS,
  OBSERVED_KINDS,
  LANE_ORDER,
  STATUS_LABEL,
  buildRealityView,
  documentedCoverageLabel,
  type IntentRealityView,
  type RealityEvidence,
  type RealityRow,
  type RealityStatus,
} from './reality-build.js';

export {
  buildRealityView,
  documentedCoverageLabel,
  DECLARED_KINDS,
  OBSERVED_KINDS,
  LANE_ORDER,
  STATUS_LABEL,
  type IntentRealityView,
  type RealityEvidence,
  type RealityRow,
  type RealityStatus,
};

const STATUS_COLOR: Record<RealityStatus, string> = {
  aligned: '#22c55e',
  planned_not_implemented: '#f59e0b',
  implemented_not_planned: '#38bdf8',
  implemented_not_documented: '#a78bfa',
  changelog_without_implementation: '#fb7185',
  conflicting: '#ef4444',
  unlinked: '#64748b',
};

/** Approximate advance width per character for the `.label` and `.badge` styles. */
const LABEL_CHAR = 7.2;
const BADGE_CHAR = 7.4;

/** Longest label in the set, in characters. */
function widestLabel(labels: string[]): number {
  return labels.reduce((widest, label) => Math.max(widest, label.length), 0);
}

export interface RealitySvgOptions {
  title?: string;
  maxRows?: number;
  /** Hide aligned topics so the view focuses on divergence. */
  gapsOnly?: boolean;
}

export function renderRealitySvg(view: IntentRealityView, options: RealitySvgOptions = {}): string {
  const theme = DARK_THEME;
  const maxRows = Math.max(1, Math.min(500, Math.trunc(options.maxRows ?? 30)));
  const title = options.title?.trim() || 'todo2code Intent vs Reality';
  const rows = (options.gapsOnly ? view.rows.filter((row) => row.status !== 'aligned') : view.rows);
  const visible = rows.slice(0, maxRows);
  const layout = buildRealityLayout();
  const header = renderRealityLaneHeaders(theme, layout);
  const body = visible.map((row, index) => renderRealityRow(row, index, layout, theme)).join('');
  const overflow = rows.length > visible.length
    ? renderMoreTopicsLabel(rows.length - visible.length, visible.length, layout)
    : '';
  const height = Math.max(400, renderRealityHeight(visible.length, rows.length, layout));

  return svgDocument({
    width: layout.width,
    height,
    title,
    description: `Intent versus reality across ${view.totals.topics} topics: `
      + `${view.totals.aligned} aligned, ${view.totals.gaps} divergent.`,
    body: [
      `  <text x="40" y="46" class="title">${escapeXml(title)}</text>`,
      `  <text x="40" y="72" class="meta">graph ${escapeXml(view.graphFingerprint.slice(0, 16))} · `
      + `declared ${view.totals.declaredRecords} · observed ${view.totals.observedRecords}</text>`,
      `  ${metricCard(40, 92, 'Topics', view.totals.topics, theme.accent)}`,
      `  ${metricCard(230, 92, 'Aligned', view.totals.aligned, theme.added)}`,
      `  ${metricCard(420, 92, 'Divergent', view.totals.gaps, theme.removed)}`,
      `  ${metricCard(610, 92, 'Planned, no code', view.totals.byStatus.planned_not_implemented ?? 0, STATUS_COLOR.planned_not_implemented, 200)}`,
      `  ${metricCard(830, 92, 'Code, no plan', view.totals.byStatus.implemented_not_planned ?? 0, STATUS_COLOR.implemented_not_planned, 200)}`,
      `  ${metricCard(1050, 92, 'Conflicting', view.totals.byStatus.conflicting ?? 0, STATUS_COLOR.conflicting, 190)}`,
      `  <g>${header}${body}${overflow}</g>`,
    ].join('\n'),
  });
}

interface RealitySvgLayout {
  laneX: number;
  laneStep: number;
  statusX: number;
  width: number;
  rowHeight: number;
  headerY: number;
  yStart: number;
}

function buildRealityLayout(): RealitySvgLayout {
  const laneX = 720;
  const laneStep = Math.max(62, Math.ceil(widestLabel(LANE_ORDER.map((kind) => kind.toUpperCase())) * LABEL_CHAR + 14));
  const statusX = laneX + LANE_ORDER.length * laneStep + 30;
  const statusWidth = Math.ceil(widestLabel(Object.values(STATUS_LABEL).map((label) => label.toUpperCase())) * BADGE_CHAR);
  return {
    laneX,
    laneStep,
    statusX,
    width: statusX + statusWidth + 40,
    rowHeight: 30,
    headerY: 214,
    yStart: 242,
  };
}

function renderRealityLaneHeaders(theme: typeof DARK_THEME, layout: RealitySvgLayout): string {
  return [
    `<text x="40" y="${layout.headerY}" class="label">TOPIC</text>`,
    ...LANE_ORDER.map((kind, index) => {
      const isDeclared = DECLARED_KINDS.includes(kind);
      return `<text x="${layout.laneX + index * layout.laneStep}" y="${layout.headerY}" class="label" text-anchor="middle"`
        + ` fill="${isDeclared ? theme.muted : theme.accent}">${escapeXml(kind.toUpperCase())}</text>`;
    }),
    `<text x="${layout.statusX}" y="${layout.headerY}" class="label">STATUS</text>`,
    `<line x1="40" y1="${layout.headerY + 10}" x2="${layout.width - 40}" y2="${layout.headerY + 10}" stroke="${theme.panelStroke}"/>`,
  ].join('');
}

function renderRealityRow(
  row: RealityRow,
  index: number,
  layout: RealitySvgLayout,
  theme: typeof DARK_THEME,
): string {
  const y = layout.yStart + index * layout.rowHeight;
  const color = STATUS_COLOR[row.status];
  return [
    `<rect x="40" y="${y - 20}" width="${layout.width - 80}" height="${layout.rowHeight - 4}" rx="6" fill="${theme.panel}" opacity="0.55"/>`,
    `<rect x="40" y="${y - 20}" width="4" height="${layout.rowHeight - 4}" rx="2" fill="${color}"/>`,
    `<text x="56" y="${y}" class="item">${escapeXml(truncate(row.label, 76))}</text>`,
    renderRealityLanes(row, y, layout, theme),
    `<text x="${layout.statusX}" y="${y}" class="badge" fill="${color}">`
      + `${escapeXml(STATUS_LABEL[row.status].toUpperCase())}</text>`,
  ].join('');
}

function renderRealityLanes(
  row: RealityRow,
  y: number,
  layout: RealitySvgLayout,
  theme: typeof DARK_THEME,
): string {
  return LANE_ORDER.map((kind, index) => {
    const count = row.lanes[kind] ?? 0;
    const cx = layout.laneX + index * layout.laneStep;
    return renderRealityLaneCell(kind, count, cx, y, theme);
  }).join('');
}

function renderRealityLaneCell(
  kind: SourceKind,
  count: number,
  cx: number,
  y: number,
  theme: typeof DARK_THEME,
): string {
  if (count > 0) {
    // A 16px circle fits two digits; a file with 161 AST facts overflowed
    // it, so wider counts get a pill sized to their own text.
    const fill = DECLARED_KINDS.includes(kind) ? theme.changed : theme.accent;
    const label = String(count);
    const pillWidth = Math.max(16, Math.ceil(label.length * BADGE_CHAR) + 8);
    return [
      `<rect x="${cx - pillWidth / 2}" y="${y - 13}" width="${pillWidth}" height="16" rx="8" fill="${fill}"/>`,
      `<text x="${cx}" y="${y - 1}" class="badge" text-anchor="middle" fill="${theme.background}">${label}</text>`,
    ].join('');
  }
  return `<circle cx="${cx}" cy="${y - 5}" r="7" fill="none" stroke="${theme.neutral}" stroke-width="1.5" stroke-dasharray="2 2"/>`;
}

function renderMoreTopicsLabel(remaining: number, visibleRows: number, layout: RealitySvgLayout): string {
  if (remaining <= 0) return '';
  const y = layout.yStart + visibleRows * layout.rowHeight + 6;
  return `<text x="56" y="${y}" class="more">… ${remaining} more topics</text>`;
}

function renderRealityHeight(visibleCount: number, totalCount: number, layout: RealitySvgLayout): number {
  const footer = totalCount > visibleCount ? 30 : 0;
  const y = layout.yStart + visibleCount * layout.rowHeight;
  return y + footer + 30;
}

/** Compact Markdown rendering for pull-request comments and terminals. */
export function renderRealityMarkdown(view: IntentRealityView, maxRows = 40): string {
  const lines: string[] = [
    '# Intent vs Reality',
    '',
    `- Graph: \`${view.graphFingerprint.slice(0, 16)}\``,
    `- Topics: ${view.totals.topics} (aligned ${view.totals.aligned}, divergent ${view.totals.gaps})`,
    `- Declared records: ${view.totals.declaredRecords}, observed records: ${view.totals.observedRecords}`,
    `- Implementation coverage: ${(view.totals.implementationCoverage * 100).toFixed(1)}% of declared topics; planned code: ${(view.totals.plannedCodeCoverage * 100).toFixed(1)}%; documented code: ${documentedCoverageLabel(view.totals)}`,
    `- Aligned evidence: ${view.totals.alignedByEvidence.code} backed by code or commits, ${view.totals.alignedByEvidence.configuration} by configuration alone`,
    '',
    `| Topic | ${LANE_ORDER.map((kind) => kind.toUpperCase()).join(' | ')} | Status |`,
    `|---|${LANE_ORDER.map(() => '--:').join('|')}|---|`,
  ];
  for (const row of view.rows.slice(0, maxRows)) {
    const lanes = LANE_ORDER.map((kind) => (row.lanes[kind] ? String(row.lanes[kind]) : '·')).join(' | ');
    lines.push(`| ${escapeMarkdown(truncate(row.label, 70))} | ${lanes} | ${STATUS_LABEL[row.status]} |`);
  }
  if (view.rows.length > maxRows) lines.push('', `… ${view.rows.length - maxRows} more topics omitted.`);
  return `${lines.join('\n')}\n`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
