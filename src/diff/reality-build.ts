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
     * is "documentation extraction did not run".
     */
    documentationMeasured: boolean;
    /**
     * Aligned topics split by how strong their evidence is.
     */
    alignedByEvidence: Record<RealityEvidence, number>;
  };
}

export const STATUS_LABEL: Record<RealityStatus, string> = {
  aligned: 'aligned',
  planned_not_implemented: 'planned, no code',
  implemented_not_planned: 'code, no plan',
  implemented_not_documented: 'code, no docs',
  changelog_without_implementation: 'changelog, no code',
  conflicting: 'conflicting',
  unlinked: 'unlinked',
};

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  info: 0,
  warning: 1,
  review_required: 2,
  blocking: 3,
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
export function documentedCoverageLabel(totals: IntentRealityView['totals']): string {
  if (!totals.documentationMeasured) return 'not measured (no documentation records in this run)';
  return `${(totals.documentedCodeCoverage * 100).toFixed(1)}%`;
}

/**
 * Groups records by their primary target.
 *
 * Connected components of the relation graph are deliberately *not* used here.
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

function resolveEvidence(lanes: Record<string, number>): RealityEvidence {
  if ((lanes.ast ?? 0) > 0 || (lanes.git ?? 0) > 0) return 'code';
  if ((lanes.system ?? 0) > 0) return 'configuration';
  return 'none';
}

function resolveStatus(codes: Set<DiagnosticCode>, lanes: Record<string, number>): RealityStatus {
  const { declared, observed, changelog } = summarizeLaneTotals(lanes);

  if (codes.has('CONFLICTING_INTENT')) return 'conflicting';

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

function topicLabel(key: string, records: IntentRecord[]): string {
  const separator = key.indexOf(':');
  const raw = separator >= 0 ? key.slice(separator + 1) : key;
  const value = key.startsWith('source:') ? `${raw} (unattributed)` : raw;

  const declared = records
    .filter((record) => DECLARED_KINDS.includes(record.source.kind))
    .sort((left, right) => right.epistemic.confidence - left.epistemic.confidence)[0];
  if (!declared) return value;

  const object = declared.statement.object.trim() || declared.statement.text.trim();
  return object ? `${value} — ${object}` : value;
}
