import type { Diagnostic, DiagnosticReport } from '../../core/types.js';

export const IMPLEMENTATION_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  'PLANNED_NOT_IMPLEMENTED',
  'CHANGELOG_WITHOUT_IMPLEMENTATION',
]);

export function collectImplementationDiagnostics(report: DiagnosticReport): Diagnostic[] {
  return report.diagnostics
    .filter((diagnostic) => IMPLEMENTATION_DIAGNOSTIC_CODES.has(diagnostic.code))
    .sort((left, right) => implementationDiagnosticRank(left)
      - implementationDiagnosticRank(right) || left.id.localeCompare(right.id));
}

function implementationDiagnosticRank(diagnostic: Diagnostic): number {
  return diagnostic.code === 'PLANNED_NOT_IMPLEMENTED' ? 0 : 1;
}
