import type { CodeChangeFile, CodeChangePlan, Conclusion, Diagnostic, IntentRecord, IntentTarget, TodoPriority, TodoProposal } from '../../core/types.js';

export interface CodeChangePlanSemanticDraft {
  title: string;
  description: string;
  priority: TodoPriority;
  target: IntentTarget;
  acceptanceCriteria: string[];
  changes: CodeChangeFile[];
  risk: CodeChangePlan['risk'];
  rollback: string;
  evidence: {
    graphFingerprint: string;
    recordIds: string[];
    diagnosticIds: string[];
    conclusionIds: string[];
    proposalIds: string[];
  };
}

export function buildPlanEvidence(
  graphFingerprint: string,
  diagnosticId: string,
  relatedRecords: IntentRecord[],
  matchingConclusions: Conclusion[],
  matchingProposals: TodoProposal[],
): CodeChangePlanSemanticDraft['evidence'] {
  return {
    graphFingerprint,
    recordIds: uniqueSorted(relatedRecords.map((record) => record.id)),
    diagnosticIds: [diagnosticId],
    conclusionIds: uniqueSorted(matchingConclusions.map((item) => item.id)),
    proposalIds: uniqueSorted(matchingProposals.map((item) => item.id)),
  };
}

export function buildPlanSemantic(
  diagnostic: Diagnostic,
  relatedRecords: IntentRecord[],
  target: IntentTarget,
  changes: CodeChangeFile[],
  evidence: CodeChangePlanSemanticDraft['evidence'],
): CodeChangePlanSemanticDraft {
  return {
    title: titleFor(diagnostic, relatedRecords),
    description: descriptionFor(diagnostic, relatedRecords, target),
    priority: priorityFor(diagnostic),
    target,
    acceptanceCriteria: acceptanceCriteriaFor(diagnostic, target),
    changes,
    risk: riskFor(diagnostic, changes),
    rollback: rollbackFor(changes),
    evidence,
  };
}

function titleFor(diagnostic: Diagnostic, records: IntentRecord[]): string {
  const record = records[0];
  const object = record?.statement.object?.trim();
  if (object && startsWithImperative(object) && record?.statement.text.trim()) {
    return record.statement.text.trim().replace(/[.!?]+$/, '');
  }
  if (object) return `Implement ${object}`;
  return diagnostic.title.trim() || `Resolve ${diagnostic.code}`;
}

function startsWithImperative(value: string): boolean {
  return /^(?:add|build|change|configure|create|delete|document|fix|implement|preserve|refactor|remove|test|update|validate|verify)\b/i.test(value)
    || /^(?:dodać|dodac|naprawić|naprawic|przetestować|przetestowac|usunąć|usunac|utworzyć|utworzyc|wdrożyć|wdrozyc|zmienić|zmienic|zweryfikować|zweryfikowac)\b/i.test(value);
}

function descriptionFor(
  diagnostic: Diagnostic,
  records: IntentRecord[],
  target: IntentTarget,
): string {
  const parts = [
    diagnostic.detail.trim(),
    records[0] ? `Source intent: ${records[0].statement.text.trim()}` : '',
    target.paths.length ? `Paths: ${target.paths.join(', ')}.` : '',
    target.symbols.length ? `Symbols: ${target.symbols.join(', ')}.` : '',
    target.tickets.length ? `Tickets: ${target.tickets.join(', ')}.` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

function acceptanceCriteriaFor(diagnostic: Diagnostic, target: IntentTarget): string[] {
  const criteria = [
    `Re-run todo2code link+diagnose and clear diagnostic ${diagnostic.id} (${diagnostic.code}).`,
    'Do not introduce new blocking diagnostics.',
  ];
  if (target.paths.length) {
    criteria.push(`Touch only the declared paths: ${uniqueSorted(target.paths).join(', ')}.`);
  }
  if (target.symbols.length) {
    criteria.push(`Provide AST evidence for symbols: ${uniqueSorted(target.symbols).join(', ')}.`);
  }
  return uniqueSorted(criteria);
}

function priorityFor(diagnostic: Diagnostic): TodoPriority {
  if (diagnostic.severity === 'blocking') return 'P0';
  if (diagnostic.severity === 'review_required') return 'P1';
  if (diagnostic.severity === 'warning') return 'P2';
  return 'P3';
}

function riskFor(diagnostic: Diagnostic, changes: CodeChangeFile[]): CodeChangePlan['risk'] {
  const level = diagnostic.severity === 'blocking' ? 'high'
    : diagnostic.severity === 'review_required' ? 'medium'
      : 'low';
  const reasons = [
    `Derived from ${diagnostic.severity} diagnostic ${diagnostic.id}.`,
    `Touches ${changes.length} declared ${changes.length === 1 ? 'path' : 'paths'}.`,
  ];
  return { level, reasons: uniqueSorted(reasons) };
}

function rollbackFor(changes: CodeChangeFile[]): string {
  return `Revert the proposed changes to ${uniqueSorted(changes.map((item) => item.path)).join(', ')} and re-run todo2code diagnostics.`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort();
}
