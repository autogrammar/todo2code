import type { DiagnosticReport, IntentGraph, IntentRecord } from '../core/types.js';

export function compactSummaryPayload(graph: IntentGraph, diagnostics: DiagnosticReport): Record<string, unknown> {
  const referenced = new Set(diagnostics.diagnostics.flatMap((item) => item.recordIds));
  const nonAst = graph.records.filter((record) => record.source.kind !== 'ast');
  const moduleAst = graph.records.filter((record) => record.source.kind === 'ast' && record.statement.kind === 'module_fact');
  const relevantAst = graph.records.filter((record) => record.source.kind === 'ast'
    && record.statement.kind !== 'module_fact'
    && (referenced.has(record.id)
      || record.statement.kind === 'symbol_fact'
      || record.statement.kind === 'python_symbol_fact'));
  const selected = [...nonAst, ...moduleAst, ...relevantAst].slice(0, 400);
  const ids = new Set(selected.map((record) => record.id));
  const selectedRelations = graph.relations
    .filter((relation) => ids.has(relation.from) && ids.has(relation.to))
    .slice(0, 800);
  const severityRank: Record<string, number> = { blocking: 0, review_required: 1, warning: 2, info: 3 };
  const selectedDiagnostics = [...diagnostics.diagnostics]
    .sort((left, right) => (severityRank[left.severity] ?? 4) - (severityRank[right.severity] ?? 4)
      || left.code.localeCompare(right.code)
      || left.id.localeCompare(right.id))
    .slice(0, 250);
  return {
    graph: {
      schemaVersion: graph.schemaVersion,
      fingerprint: graph.fingerprint,
      stats: graph.stats,
      records: selected.map(compactRecord),
      relations: selectedRelations,
    },
    diagnostics: { ...diagnostics, diagnostics: selectedDiagnostics },
    truncation: {
      originalRecords: graph.records.length,
      includedRecords: selected.length,
      originalRelations: graph.relations.length,
      includedRelations: selectedRelations.length,
      originalDiagnostics: diagnostics.diagnostics.length,
      includedDiagnostics: selectedDiagnostics.length,
      includedBySource: Object.fromEntries(Object.entries(
        selected.reduce<Record<string, number>>((counts, record) => {
          counts[record.source.kind] = (counts[record.source.kind] ?? 0) + 1;
          return counts;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right))),
    },
  };
}

function compactRecord(record: IntentRecord): Record<string, unknown> {
  return {
    id: record.id,
    statement: record.statement,
    lifecycle: record.lifecycle,
    source: {
      kind: record.source.kind,
      path: record.source.path,
      lines: record.source.lines,
      revision: record.source.revision,
      symbol: record.source.symbol,
      commitIndex: record.source.commitIndex,
    },
    epistemic: record.epistemic,
    observedAt: record.observedAt,
  };
}
