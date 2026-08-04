import type { IntentGraph, IntentRealityView, RealityRow, SourceKind } from '../core/types.js';

const DECLARED_KINDS: SourceKind[] = ['nl', 'todo', 'document', 'agent_log'];
const OBSERVED_KINDS: SourceKind[] = ['git', 'ast', 'system'];

export function buildRealityTotals(graph: IntentGraph, rows: RealityRow[]): IntentRealityView['totals'] {
  return {
    topics: rows.length,
    aligned: countAlignedRows(rows),
    gaps: rows.length - countAlignedRows(rows),
    alignedByEvidence: countAlignedByEvidence(rows),
    byStatus: collectByStatus(rows),
    declaredRecords: countRecordsBySource(graph, DECLARED_KINDS),
    observedRecords: countRecordsBySource(graph, OBSERVED_KINDS),
    declaredTopics: countRowsWithSource(rows, DECLARED_KINDS),
    observedTopics: countRowsWithSource(rows, OBSERVED_KINDS),
    implementationAlignedTopics: countImplementationAlignedTopics(rows),
    implementationCoverage: ratio(countImplementationAlignedTopics(rows), countRowsWithSource(rows, DECLARED_KINDS)),
    plannedCodeCoverage: ratio(countImplementationAlignedTopics(rows), countRowsWithSource(rows, OBSERVED_KINDS)),
    documentedCodeCoverage: ratio(countDocumentedObservedTopics(rows), countRowsWithSource(rows, OBSERVED_KINDS)),
    documentationMeasured: graph.records.some((record) => record.source.kind === 'document'),
  };
}

function countRecordsBySource(graph: IntentGraph, kinds: SourceKind[]): number {
  return graph.records.filter((record) => kinds.includes(record.source.kind)).length;
}

function countRowsWithSource(rows: RealityRow[], kinds: SourceKind[]): number {
  return rows.filter((row) => kinds.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
}

function countAlignedRows(rows: RealityRow[]): number {
  return rows.filter((row) => row.status === 'aligned').length;
}

function countAlignedByEvidence(rows: RealityRow[]): Record<string, number> {
  return {
    code: rows.filter((row) => row.status === 'aligned' && row.evidence === 'code').length,
    configuration: rows.filter((row) => row.status === 'aligned' && row.evidence === 'configuration').length,
    none: rows.filter((row) => row.status === 'aligned' && row.evidence === 'none').length,
  };
}

function countImplementationAlignedTopics(rows: RealityRow[]): number {
  return rows.filter((row) => row.status === 'aligned'
    && DECLARED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)
    && OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
}

function countDocumentedObservedTopics(rows: RealityRow[]): number {
  return rows.filter((row) => (row.lanes.document ?? 0) > 0
    && OBSERVED_KINDS.some((kind) => (row.lanes[kind] ?? 0) > 0)).length;
}

function collectByStatus(rows: RealityRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 10_000) / 10_000;
}
