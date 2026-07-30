import type { DiagnosticReport } from './types.js';

/**
 * Restrict provider-supplied record citations to the records carried by the
 * cited diagnostics. If the provider invents every record ID, use the exact
 * diagnostic evidence instead. Diagnostic IDs themselves are not healed and
 * remain subject to the public grounded-contract validator.
 */
export function groundRecordIdsByDiagnostics(
  diagnosticIds: string[],
  suppliedRecordIds: string[],
  report: DiagnosticReport,
): string[] {
  const diagnosticById = new Map(report.diagnostics.map((diagnostic) => [diagnostic.id, diagnostic]));
  const allowed = new Set(diagnosticIds
    .flatMap((id) => diagnosticById.get(id)?.recordIds ?? []));
  if (allowed.size === 0) return sortedUnique(suppliedRecordIds);
  const suppliedGrounded = sortedUnique(suppliedRecordIds).filter((id) => allowed.has(id));
  return suppliedGrounded.length > 0 ? suppliedGrounded : [...allowed].sort((left, right) => left.localeCompare(right));
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
