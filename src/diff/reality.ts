// Intent-vs-reality view: the "plan ↔ code" diff.
//
// Where `graph/diff.ts` compares two runs over time, this module compares the
// declared side of a single run (NL task, TODO, documentation, changelog)
// against the observed side (Git claims, AST facts). Records are grouped into
// topics using the connected components of the existing relation graph, so the
// view reuses the linker's evidence instead of inventing a second heuristic.

import { sha256, stableStringify } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import { symbolAliases } from '../core/target.js';
import type {
  DiagnosticCode,
  DiagnosticReport,
  DiagnosticSeverity,
  IntentGraph,
  IntentRecord,
  SourceKind,
} from '../core/types.js';
import {
  DARK_THEME,
  escapeXml,
  metricCard,
  svgDocument,
  truncate,
} from './svg.js';

/** Source kinds that state what *should* exist. */
export const DECLARED_KINDS: SourceKind[] = ['nl', 'todo', 'document', 'agent_log'];
/** Source kinds that evidence what *does* exist. */
export const OBSERVED_KINDS: SourceKind[] = ['git', 'ast'];

export const LANE_ORDER: SourceKind[] = ['nl', 'todo', 'document', 'agent_log', 'git', 'ast', 'changelog'];

export type RealityStatus =
  | 'aligned'
  | 'planned_not_implemented'
  | 'implemented_not_planned'
  | 'implemented_not_documented'
  | 'changelog_without_implementation'
  | 'conflicting'
  | 'unlinked';

export interface RealityRow {
  key: string;
  label: string;
  lanes: Record<string, number>;
  status: RealityStatus;
  severity: DiagnosticSeverity;
  recordIds: string[];
  diagnosticCodes: DiagnosticCode[];
}

export interface IntentRealityView {
  schemaVersion: 't2c.reality/v1';
  generatedAt: string;
  graphFingerprint: string;
  fingerprint: string;
  rows: RealityRow[];
  totals: {
    topics: number;
    aligned: number;
    gaps: number;
    byStatus: Record<string, number>;
    declaredRecords: number;
    observedRecords: number;
    declaredTopics: number;
    observedTopics: number;
    implementationAlignedTopics: number;
    implementationCoverage: number;
    plannedCodeCoverage: number;
    documentedCodeCoverage: number;
  };
}

/**
 * Diagnostic codes that mark a topic as divergent, mapped to the row status
 * they imply. Codes absent from this table (LOW_CONFIDENCE, ALIGNED, …) do not
 * by themselves make a topic a gap.
 */
const DIVERGENCE_STATUS: Partial<Record<DiagnosticCode, RealityStatus>> = {
  PLANNED_NOT_IMPLEMENTED: 'planned_not_implemented',
  IMPLEMENTED_NOT_PLANNED: 'implemented_not_planned',
  IMPLEMENTED_NOT_DOCUMENTED: 'implemented_not_documented',
  CHANGELOG_WITHOUT_IMPLEMENTATION: 'changelog_without_implementation',
  CONFLICTING_INTENT: 'conflicting',
  UNLINKED_RECORD: 'unlinked',
};

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  info: 0,
  warning: 1,
  review_required: 2,
  blocking: 3,
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

const STATUS_LABEL: Record<RealityStatus, string> = {
  aligned: 'aligned',
  planned_not_implemented: 'planned, no code',
  implemented_not_planned: 'code, no plan',
  implemented_not_documented: 'code, no docs',
  changelog_without_implementation: 'changelog, no code',
  conflicting: 'conflicting',
  unlinked: 'unlinked',
};

export function buildRealityView(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  generatedAt = new Date().toISOString(),
): IntentRealityView {
  assertIntentGraph(graph);
  const components = groupIntoTopics(graph);
  const diagnosticsByRecord = indexDiagnostics(diagnostics);

  const rows: RealityRow[] = components.map(({ key, records }) => {
    const lanes: Record<string, number> = {};
    for (const kind of LANE_ORDER) lanes[kind] = 0;
    for (const record of records) {
      lanes[record.source.kind] = (lanes[record.source.kind] ?? 0) + 1;
    }

    const codes = new Set<DiagnosticCode>();
    let severity: DiagnosticSeverity = 'info';
    for (const record of records) {
      for (const diagnostic of diagnosticsByRecord.get(record.id) ?? []) {
        codes.add(diagnostic.code);
        if (SEVERITY_RANK[diagnostic.severity] > SEVERITY_RANK[severity]) severity = diagnostic.severity;
      }
    }

    const status = resolveStatus(codes, lanes);
    return {
      key,
      label: topicLabel(key, records),
      lanes,
      status,
      severity: status === 'aligned' ? 'info' : severity,
      recordIds: records.map((record) => record.id).sort(),
      diagnosticCodes: [...codes].sort(),
    };
  });

  // Most severe first, then largest topic, then stable by key.
  rows.sort((left, right) => {
    const bySeverity = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (bySeverity !== 0) return bySeverity;
    const alignment = Number(left.status === 'aligned') - Number(right.status === 'aligned');
    if (alignment !== 0) return alignment;
    const bySize = right.recordIds.length - left.recordIds.length;
    if (bySize !== 0) return bySize;
    return left.key.localeCompare(right.key);
  });

  const byStatus: Record<string, number> = {};
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;

  const declaredRecords = graph.records.filter((record) => DECLARED_KINDS.includes(record.source.kind)).length;
  const observedRecords = graph.records.filter((record) => OBSERVED_KINDS.includes(record.source.kind)).length;
  const aligned = rows.filter((row) => row.status === 'aligned').length;
  const declaredTopics = rows.filter((row) => DECLARED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
  const observedTopics = rows.filter((row) => OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
  const implementationAlignedTopics = rows.filter((row) =>
    DECLARED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)
    && OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
  const documentedObservedTopics = rows.filter((row) =>
    (row.lanes.document ?? 0) > 0
    && OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;

  return {
    schemaVersion: 't2c.reality/v1',
    generatedAt,
    graphFingerprint: graph.fingerprint,
    fingerprint: sha256(stableStringify(rows.map((row) => [row.key, row.status, row.recordIds]))),
    rows,
    totals: {
      topics: rows.length,
      aligned,
      gaps: rows.length - aligned,
      byStatus: Object.fromEntries(Object.entries(byStatus).sort(([a], [b]) => a.localeCompare(b))),
      declaredRecords,
      observedRecords,
      declaredTopics,
      observedTopics,
      implementationAlignedTopics,
      implementationCoverage: ratio(implementationAlignedTopics, declaredTopics),
      plannedCodeCoverage: ratio(implementationAlignedTopics, observedTopics),
      documentedCodeCoverage: ratio(documentedObservedTopics, observedTopics),
    },
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 10_000) / 10_000;
}

/**
 * Groups records by their primary target.
 *
 * Connected components of the relation graph are deliberately *not* used here.
 * The linker emits `shared_path` relations, which tie together every AST symbol
 * declared in the same file; transitively that collapses a real repository into
 * one giant component (measured: 2561 records and 95 549 relations produced a
 * single topic holding 2507 AST facts). Keying on the record's own primary
 * target keeps topics at file/ticket granularity and makes membership
 * explainable without walking the graph.
 */
function groupIntoTopics(graph: IntentGraph): Array<{ key: string; records: IntentRecord[] }> {
  const symbolPaths = indexUnambiguousSymbolPaths(graph.records);
  const groups = new Map<string, IntentRecord[]>();
  for (const record of graph.records) {
    const key = primaryTargetKey(record, symbolPaths);
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .map(([key, records]) => ({ key, records: records.sort((a, b) => a.id.localeCompare(b.id)) }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function indexUnambiguousSymbolPaths(records: IntentRecord[]): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const record of records) {
    const paths = record.statement.target.paths;
    if (paths.length !== 1 || !paths[0]) continue;
    for (const alias of record.statement.target.symbols.flatMap(symbolAliases)) {
      const values = candidates.get(alias) ?? new Set<string>();
      values.add(paths[0]);
      candidates.set(alias, values);
    }
  }
  return new Map([...candidates.entries()]
    .filter(([, paths]) => paths.size === 1)
    .map(([alias, paths]) => [alias, [...paths][0] as string]));
}

/**
 * Deterministic topic key. A ticket is the strongest cross-source identifier,
 * then the file the record is about, then its normalized symbol.
 *
 * `statement.target.paths` outranks symbols and `source.path`: a TODO item is
 * written in TODO.md but targets `src/…`, and keying it by its source file
 * would file every task under TODO.md instead of the code it concerns. When a
 * record has no target path, normalized symbol aliases still align
 * `validateContract`, `Runtime.validateContract` and Rust `::` notation.
 * `source.path` remains the final source-based fallback.
 */
function primaryTargetKey(record: IntentRecord, symbolPaths: Map<string, string>): string {
  const tickets = [...record.statement.target.tickets].sort();
  if (tickets.length === 1 && tickets[0]) return `ticket:${tickets[0]}`;

  if (tickets.length > 1 && tickets[0]) return `ticket:${tickets[0]}`;

  const targetPaths = [...new Set(record.statement.target.paths)].sort();
  if (targetPaths.length && targetPaths[0]) return `path:${targetPaths[0]}`;

  const symbols = [...new Set(record.statement.target.symbols.flatMap(symbolAliases))]
    .sort((left, right) => left.split('.').length - right.split('.').length || left.localeCompare(right));
  const resolvedPaths = [...new Set(symbols.map((symbol) => symbolPaths.get(symbol)).filter((value): value is string => Boolean(value)))];
  if (resolvedPaths.length === 1 && resolvedPaths[0]) return `path:${resolvedPaths[0]}`;
  if (symbols.length && symbols[0]) return `symbol:${symbols[0]}`;

  if (record.source.path) return `path:${record.source.path}`;

  return `record:${record.id}`;
}

function indexDiagnostics(report: DiagnosticReport): Map<string, DiagnosticReport['diagnostics']> {
  const index = new Map<string, DiagnosticReport['diagnostics']>();
  for (const diagnostic of report.diagnostics) {
    for (const recordId of diagnostic.recordIds) {
      const bucket = index.get(recordId) ?? [];
      bucket.push(diagnostic);
      index.set(recordId, bucket);
    }
  }
  return index;
}

/**
 * Status is derived from lane presence first, because that is a structural fact
 * about the topic. Diagnostics only refine the result: a topic that demonstrably
 * holds both declared and observed records is never reported as "planned, no
 * code" just because one of its members carries that diagnostic.
 */
function resolveStatus(codes: Set<DiagnosticCode>, lanes: Record<string, number>): RealityStatus {
  const declared = DECLARED_KINDS.reduce((total, kind) => total + (lanes[kind] ?? 0), 0);
  const observed = OBSERVED_KINDS.reduce((total, kind) => total + (lanes[kind] ?? 0), 0);
  const changelog = lanes.changelog ?? 0;

  // A contradiction outranks every structural reading of the same topic.
  if (codes.has('CONFLICTING_INTENT')) return 'conflicting';

  if (declared === 0 && observed === 0) {
    return changelog > 0 ? 'changelog_without_implementation' : 'unlinked';
  }
  if (declared > 0 && observed === 0) {
    return changelog > 0 && codes.has('CHANGELOG_WITHOUT_IMPLEMENTATION')
      ? 'changelog_without_implementation'
      : 'planned_not_implemented';
  }
  if (observed > 0 && declared === 0) return 'implemented_not_planned';

  // Both sides present. Documentation is the remaining axis worth reporting.
  if ((lanes.document ?? 0) === 0 && codes.has('IMPLEMENTED_NOT_DOCUMENTED')) return 'implemented_not_documented';
  return 'aligned';
}

/**
 * The topic key names the row; a declared statement is appended as context when
 * one exists. Labelling by an arbitrary member record would be misleading, since
 * a file-keyed topic can hold hundreds of unrelated AST facts.
 */
function topicLabel(key: string, records: IntentRecord[]): string {
  const separator = key.indexOf(':');
  const value = separator >= 0 ? key.slice(separator + 1) : key;

  const declared = records
    .filter((record) => DECLARED_KINDS.includes(record.source.kind))
    .sort((left, right) => right.epistemic.confidence - left.epistemic.confidence)[0];
  if (!declared) return value;

  const object = declared.statement.object.trim() || declared.statement.text.trim();
  return object ? `${value} — ${object}` : value;
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

  const width = 1280;
  const laneX = 720;
  const laneStep = 62;
  const rowHeight = 30;
  const headerY = 214;
  let y = headerY + 28;

  const body: string[] = [];

  // Lane column headers.
  body.push(`<text x="40" y="${headerY}" class="label">TOPIC</text>`);
  LANE_ORDER.forEach((kind, index) => {
    const isDeclared = DECLARED_KINDS.includes(kind);
    body.push(
      `<text x="${laneX + index * laneStep}" y="${headerY}" class="label" text-anchor="middle"`
      + ` fill="${isDeclared ? theme.muted : theme.accent}">${escapeXml(kind.toUpperCase())}</text>`,
    );
  });
  body.push(`<text x="${laneX + LANE_ORDER.length * laneStep + 30}" y="${headerY}" class="label">STATUS</text>`);
  body.push(`<line x1="40" y1="${headerY + 10}" x2="${width - 40}" y2="${headerY + 10}" stroke="${theme.panelStroke}"/>`);

  for (const row of visible) {
    const color = STATUS_COLOR[row.status];
    body.push(`<rect x="40" y="${y - 20}" width="${width - 80}" height="${rowHeight - 4}" rx="6" fill="${theme.panel}" opacity="0.55"/>`);
    body.push(`<rect x="40" y="${y - 20}" width="4" height="${rowHeight - 4}" rx="2" fill="${color}"/>`);
    body.push(`<text x="56" y="${y}" class="item">${escapeXml(truncate(row.label, 76))}</text>`);

    LANE_ORDER.forEach((kind, index) => {
      const count = row.lanes[kind] ?? 0;
      const cx = laneX + index * laneStep;
      if (count > 0) {
        body.push(`<circle cx="${cx}" cy="${y - 5}" r="8" fill="${DECLARED_KINDS.includes(kind) ? theme.changed : theme.accent}"/>`);
        body.push(`<text x="${cx}" y="${y - 1}" class="badge" text-anchor="middle" fill="${theme.background}">${count}</text>`);
      } else {
        body.push(`<circle cx="${cx}" cy="${y - 5}" r="7" fill="none" stroke="${theme.neutral}" stroke-width="1.5" stroke-dasharray="2 2"/>`);
      }
    });

    body.push(
      `<text x="${laneX + LANE_ORDER.length * laneStep + 30}" y="${y}" class="badge" fill="${color}">`
      + `${escapeXml(STATUS_LABEL[row.status].toUpperCase())}</text>`,
    );
    y += rowHeight;
  }

  if (rows.length > visible.length) {
    body.push(`<text x="56" y="${y + 6}" class="more">… ${rows.length - visible.length} more topics</text>`);
    y += 30;
  }

  return svgDocument({
    width,
    height: Math.max(400, y + 30),
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
      `  <g>${body.join('')}</g>`,
    ].join('\n'),
  });
}

/** Compact Markdown rendering for pull-request comments and terminals. */
export function renderRealityMarkdown(view: IntentRealityView, maxRows = 40): string {
  const lines: string[] = [
    '# Intent vs Reality',
    '',
    `- Graph: \`${view.graphFingerprint.slice(0, 16)}\``,
    `- Topics: ${view.totals.topics} (aligned ${view.totals.aligned}, divergent ${view.totals.gaps})`,
    `- Declared records: ${view.totals.declaredRecords}, observed records: ${view.totals.observedRecords}`,
    `- Implementation coverage: ${(view.totals.implementationCoverage * 100).toFixed(1)}% of declared topics; planned code: ${(view.totals.plannedCodeCoverage * 100).toFixed(1)}%; documented code: ${(view.totals.documentedCodeCoverage * 100).toFixed(1)}%`,
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
