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
/**
 * Source kinds that evidence what *does* exist.
 *
 * Configuration counts: a `system` record is an observed fact with lifecycle
 * `implemented`, and for infrastructure repositories the implementation largely
 * *is* the configuration. Leaving it out made Intent-vs-Reality structurally
 * blind there — a platform repository with 1 263 configuration records reported
 * 2.4% implementation coverage while documenting exactly what those files do.
 */
export const OBSERVED_KINDS: SourceKind[] = ['git', 'ast', 'system'];

export const LANE_ORDER: SourceKind[] = ['nl', 'todo', 'document', 'agent_log', 'git', 'ast', 'system', 'changelog'];

export type RealityStatus =
  | 'aligned'
  | 'planned_not_implemented'
  | 'implemented_not_planned'
  | 'implemented_not_documented'
  | 'changelog_without_implementation'
  | 'conflicting'
  | 'unlinked';

/**
 * What kind of observed record proves a topic.
 *
 * `configuration` means the only evidence is a declared key in a committed
 * file. That is real — a behaviour whose implementation *is* configuration is
 * implemented — but it is weaker than a function the parser found, and until
 * now both produced an identical `aligned` with nothing to tell them apart.
 * Measured: 16 of 46 aligned topics on `subactor/platform` rest on
 * configuration alone, against 4 of 89 here.
 */
export type RealityEvidence = 'code' | 'configuration' | 'none';

export interface RealityRow {
  key: string;
  label: string;
  lanes: Record<string, number>;
  status: RealityStatus;
  severity: DiagnosticSeverity;
  recordIds: string[];
  diagnosticCodes: DiagnosticCode[];
  /** Evidence grade for a topic that survived semantic implementation gating. */
  evidence: RealityEvidence;
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
    /**
     * False when the graph holds no `document` record at all, which makes
     * `documentedCodeCoverage` structurally 0 rather than measured. Reporting
     * a bare 0.0% in that case reads as "nothing is documented" when the truth
     * is "documentation extraction did not run" — it is LLM-only, so every
     * offline run produced that number.
     */
    documentationMeasured: boolean;
    /**
     * Aligned topics split by how strong their evidence is. Reported so a
     * headline that rests mostly on configuration cannot read the same as one
     * backed by parsed code; neither number changes what counts as aligned.
     */
    alignedByEvidence: Record<RealityEvidence, number>;
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
  const rows = buildRealityRows(components, diagnosticsByRecord);
  return {
    schemaVersion: 't2c.reality/v1',
    generatedAt,
    graphFingerprint: graph.fingerprint,
    fingerprint: sha256(stableStringify(rows.map((row) => [row.key, row.status, row.recordIds]))),
    rows,
    totals: buildRealityTotals(graph, rows),
  };
}

function buildRealityRows(
  components: Array<{ key: string; records: IntentRecord[] }>,
  diagnosticsByRecord: Map<string, DiagnosticReport['diagnostics']>,
): RealityRow[] {
  const rows = components.map(({ key, records }) => buildRealityRow(key, records, diagnosticsByRecord));
  rows.sort(compareRealityRows);
  return rows;
}

function buildRealityRow(
  key: string,
  records: IntentRecord[],
  diagnosticsByRecord: Map<string, DiagnosticReport['diagnostics']>,
): RealityRow {
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
    evidence: resolveEvidence(lanes),
  };
}

function compareRealityRows(left: RealityRow, right: RealityRow): number {
  const bySeverity = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
  if (bySeverity !== 0) return bySeverity;
  const alignment = Number(left.status === 'aligned') - Number(right.status === 'aligned');
  if (alignment !== 0) return alignment;
  const bySize = right.recordIds.length - left.recordIds.length;
  if (bySize !== 0) return bySize;
  return left.key.localeCompare(right.key);
}

function buildRealityTotals(graph: IntentGraph, rows: RealityRow[]): IntentRealityView['totals'] {
  const byStatus: Record<string, number> = {};
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;

  const declaredRecords = graph.records.filter((record) => DECLARED_KINDS.includes(record.source.kind)).length;
  const observedRecords = graph.records.filter((record) => OBSERVED_KINDS.includes(record.source.kind)).length;
  const aligned = rows.filter((row) => row.status === 'aligned').length;
  const declaredTopics = rows.filter((row) => DECLARED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
  const observedTopics = rows.filter((row) => OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
  const implementationAlignedTopics = rows.filter((row) => row.status === 'aligned'
    && DECLARED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)
    && OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
  const documentedObservedTopics = rows.filter((row) =>
    (row.lanes.document ?? 0) > 0
    && OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;

  return {
    topics: rows.length,
    aligned,
    gaps: rows.length - aligned,
    alignedByEvidence: {
      code: rows.filter((row) => row.status === 'aligned' && row.evidence === 'code').length,
      configuration: rows.filter((row) => row.status === 'aligned' && row.evidence === 'configuration').length,
      none: rows.filter((row) => row.status === 'aligned' && row.evidence === 'none').length,
    },
    byStatus: Object.fromEntries(Object.entries(byStatus).sort(([a], [b]) => a.localeCompare(b))),
    declaredRecords,
    observedRecords,
    declaredTopics,
    observedTopics,
    implementationAlignedTopics,
    implementationCoverage: ratio(implementationAlignedTopics, declaredTopics),
    plannedCodeCoverage: ratio(implementationAlignedTopics, observedTopics),
    documentedCodeCoverage: ratio(documentedObservedTopics, observedTopics),
    documentationMeasured: graph.records.some((record) => record.source.kind === 'document'),
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 10_000) / 10_000;
}

/** Renders documentation coverage, or says it was not measured at all. */
function documentedCoverageLabel(totals: IntentRealityView['totals']): string {
  if (!totals.documentationMeasured) return 'not measured (no documentation records in this run)';
  return `${(totals.documentedCodeCoverage * 100).toFixed(1)}%`;
}

/** Approximate advance width per character for the `.label` and `.badge` styles. */
const LABEL_CHAR = 7.2;
const BADGE_CHAR = 7.4;

/** Longest label in the set, in characters. */
function widestLabel(labels: string[]): number {
  return labels.reduce((widest, label) => Math.max(widest, label.length), 0);
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
  const anchors = indexModuleAnchors(graph, symbolPaths);
  const groups = new Map<string, IntentRecord[]>();
  for (const record of graph.records) {
    const key = primaryTargetKey(record, symbolPaths, anchors);
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .map(([key, records]) => ({ key, records: records.sort((a, b) => a.id.localeCompare(b.id)) }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

/**
 * The one module a targetless declaration is directly linked to.
 *
 * Without this, a sentence the linker *did* connect to code still counted as
 * "planned, no code": topics are keyed by each record's own ticket, path or
 * symbol, so prose that names none of them was filed under the documentation
 * file it was written in, never under the module it describes. On
 * `subactor/platform`, where documentation is Polish prose and identifiers are
 * English, that is most of the corpus.
 *
 * The narrowness is the point, and it is why connected components are still
 * refused above: one hop, only from a declaration whose own target resolves to
 * no file, and only when every module aggregate it touches names the same one.
 * An ambiguous declaration keeps its old key rather than picking a winner —
 * measured on `subactor/platform`, 69 declarations touch several modules and
 * are deliberately left alone.
 */
function indexModuleAnchors(graph: IntentGraph, symbolPaths: Map<string, string>): Map<string, string> {
  const modulePaths = new Map<string, string>();
  for (const record of graph.records) {
    if (record.statement.kind !== 'module_fact' && record.statement.kind !== 'configuration_file_fact') continue;
    const paths = [...new Set(record.statement.target.paths)];
    if (paths.length === 1 && paths[0]) modulePaths.set(record.id, paths[0]);
  }

  const targetless = new Set(graph.records
    .filter((record) => DECLARED_KINDS.includes(record.source.kind) && !resolvesToFile(record, symbolPaths))
    .map((record) => record.id));
  const candidates = new Map<string, Set<string>>();
  for (const relation of graph.relations) {
    for (const [left, right] of [[relation.from, relation.to], [relation.to, relation.from]] as const) {
      const path = modulePaths.get(right);
      if (!path || !targetless.has(left)) continue;
      const values = candidates.get(left) ?? new Set<string>();
      values.add(path);
      candidates.set(left, values);
    }
  }
  return new Map([...candidates.entries()]
    .filter(([, paths]) => paths.size === 1)
    .map(([recordId, paths]) => [recordId, [...paths][0] as string]));
}

/**
 * True when the record already names something a reader can open.
 *
 * A bare prose symbol does not count. `extractSymbols` returns acronyms such as
 * `API` or `DSL`, and a topic keyed `symbol:api` groups sentences that share
 * nothing but a word — a worse anchor than the module the linker proved.
 */
function resolvesToFile(record: IntentRecord, symbolPaths: Map<string, string>): boolean {
  const { tickets, paths, symbols } = record.statement.target;
  if (tickets.length > 0 || paths.length > 0) return true;
  const resolved = new Set(symbols
    .flatMap(symbolAliases)
    .map((symbol) => symbolPaths.get(symbol))
    .filter((value): value is string => Boolean(value)));
  return resolved.size === 1;
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
 * A declaration with no target of its own falls back to the single module it
 * is linked to, and only then to its own document under a separate `source:`
 * namespace. "Written in X" is not "about X": sharing the `path:` namespace
 * merged every unattributable release note into the topic for the changelog
 * file itself — 283 of them beside the 20 that name it on `if-uri/urirun`,
 * and 447 beside 40 on `semcod/goal` — so a document appeared to be a heavily
 * declared topic with no implementation. Observed evidence is unaffected: AST,
 * Git and configuration records always carry a target of their own and never
 * reach this fallback.
 */
function primaryTargetKey(
  record: IntentRecord,
  symbolPaths: Map<string, string>,
  anchors: Map<string, string> = new Map(),
): string {
  const tickets = [...record.statement.target.tickets].sort();
  if (tickets.length === 1 && tickets[0]) return `ticket:${tickets[0]}`;

  if (tickets.length > 1 && tickets[0]) return `ticket:${tickets[0]}`;

  const targetPaths = [...new Set(record.statement.target.paths)].sort();
  if (targetPaths.length && targetPaths[0]) return `path:${targetPaths[0]}`;

  const symbols = [...new Set(record.statement.target.symbols.flatMap(symbolAliases))]
    .sort((left, right) => left.split('.').length - right.split('.').length || left.localeCompare(right));
  const resolvedPaths = [...new Set(symbols.map((symbol) => symbolPaths.get(symbol)).filter((value): value is string => Boolean(value)))];
  if (resolvedPaths.length === 1 && resolvedPaths[0]) return `path:${resolvedPaths[0]}`;

  const anchor = anchors.get(record.id);
  if (anchor) return `path:${anchor}`;

  if (symbols.length && symbols[0]) return `symbol:${symbols[0]}`;

  if (record.source.path) return `source:${record.source.path}`;

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
/**
 * Grades observed evidence without regrading the topic.
 *
 * AST or Git evidence outranks configuration: a parser found the symbol, or a
 * commit touched the file. Configuration alone still proves the behaviour
 * exists, so it stays `aligned` — the caller decides what to do with a
 * headline where most of the alignment is configuration.
 */
function resolveEvidence(lanes: Record<string, number>): RealityEvidence {
  if ((lanes.ast ?? 0) > 0 || (lanes.git ?? 0) > 0) return 'code';
  if ((lanes.system ?? 0) > 0) return 'configuration';
  return 'none';
}

function resolveStatus(codes: Set<DiagnosticCode>, lanes: Record<string, number>): RealityStatus {
  const { declared, observed, changelog } = summarizeLaneTotals(lanes);

  // A contradiction outranks every structural reading of the same topic.
  if (codes.has('CONFLICTING_INTENT')) return 'conflicting';

  // Co-location is not semantic implementation. Diagnostics has inspected the
  // relation basis and keeps this gap open when both lanes share only a path.
  if (codes.has('PLANNED_NOT_IMPLEMENTED')) return 'planned_not_implemented';

  if (declared === 0 && observed === 0) {
    return changelog > 0 ? 'changelog_without_implementation' : 'unlinked';
  }
  if (declared > 0 && observed === 0) {
    return changelog > 0 && codes.has('CHANGELOG_WITHOUT_IMPLEMENTATION')
      ? 'changelog_without_implementation'
      : 'planned_not_implemented';
  }
  if (observed > 0 && declared === 0) return 'implemented_not_planned';

  // Both sides are present, so plan-to-code alignment is proven. Documentation
  // coverage is an independent metric and its diagnostic remains attached to
  // the row; requiring a document lane here made `aligned` impossible in a
  // fully offline run because semantic document records are LLM-only.
  return 'aligned';
}

function summarizeLaneTotals(lanes: Record<string, number>): {
  declared: number;
  observed: number;
  changelog: number;
} {
  const declared = DECLARED_KINDS.reduce((total, kind) => total + (lanes[kind] ?? 0), 0);
  const observed = OBSERVED_KINDS.reduce((total, kind) => total + (lanes[kind] ?? 0), 0);
  const changelog = lanes.changelog ?? 0;
  return { declared, observed, changelog };
}

/**
 * The topic key names the row; a declared statement is appended as context when
 * one exists. Labelling by an arbitrary member record would be misleading, since
 * a file-keyed topic can hold hundreds of unrelated AST facts.
 */
function topicLabel(key: string, records: IntentRecord[]): string {
  const separator = key.indexOf(':');
  const raw = separator >= 0 ? key.slice(separator + 1) : key;
  // The reader must be able to tell a topic about a file from the bucket of
  // statements that merely live in it and name nothing.
  const value = key.startsWith('source:') ? `${raw} (unattributed)` : raw;

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
