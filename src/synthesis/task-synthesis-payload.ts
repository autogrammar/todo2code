import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  IntentGraph,
  IntentRecord,
} from '../core/types.js';

export function compactSynthesisPayload(graph: IntentGraph, report: DiagnosticReport): Record<string, unknown> {
  const diagnostics = [...report.diagnostics]
    .filter((diagnostic) => diagnostic.code !== 'ALIGNED' && diagnostic.recordIds.length > 0)
    .sort(compareDiagnostics)
    .slice(0, 200);
  const recordIds = new Set(diagnostics.flatMap((diagnostic) => diagnostic.recordIds));
  const todoRecords = graph.records.filter((record) => record.source.kind === 'todo').slice(0, 100);
  todoRecords.forEach((record) => recordIds.add(record.id));
  // Truncating records after collecting their IDs from diagnostics can ship a
  // diagnostic that cites a record the model never sees, which invites exactly
  // the fabricated citation the corrective retry then has to absorb. Drop the
  // diagnostics whose evidence did not survive the record budget instead.
  const records = graph.records.filter((record) => recordIds.has(record.id)).slice(0, 500);
  const includedIds = new Set(records.map((record) => record.id));
  const groundedDiagnostics = diagnostics.filter((diagnostic) =>
    diagnostic.recordIds.some((id) => includedIds.has(id)));
  return {
    graph: {
      schemaVersion: graph.schemaVersion,
      fingerprint: graph.fingerprint,
      stats: graph.stats,
      records: records.map(compactRecord),
      relations: graph.relations
        .filter((relation) => includedIds.has(relation.from) && includedIds.has(relation.to))
        .slice(0, 800),
    },
    diagnostics: {
      schemaVersion: report.schemaVersion,
      graphFingerprint: report.graphFingerprint,
      diagnostics: groundedDiagnostics,
    },
    limits: {
      maxConclusions: 100,
      maxProposals: 100,
      originalDiagnostics: report.diagnostics.length,
      includedDiagnostics: groundedDiagnostics.length,
      originalRecords: graph.records.length,
      includedRecords: records.length,
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
    },
    epistemic: record.epistemic,
  };
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const rank: Record<DiagnosticSeverity, number> = { blocking: 0, review_required: 1, warning: 2, info: 3 };
  return rank[left.severity] - rank[right.severity] || left.id.localeCompare(right.id);
}
