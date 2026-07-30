import type { Conclusion, DiagnosticSeverity, IntentGraph, IntentRecord } from '../core/types.js';

export function renderSummaryMarkdown(
  graph: IntentGraph,
  conclusions: Conclusion[],
  provenance = 'Wygenerowano deterministycznie, ponieważ podsumowanie OpenRouter nie było dostępne.',
): string {
  const plans = graph.records.filter((record) => ['nl', 'todo', 'document'].includes(record.source.kind));
  const git = graph.records.filter((record) => record.source.kind === 'git');
  const moduleFacts = graph.records.filter((record) => record.source.kind === 'ast' && record.statement.kind === 'module_fact');
  const facts = moduleFacts.length > 0 ? moduleFacts : graph.records.filter((record) => (
    record.source.kind === 'ast' && ['symbol_fact', 'python_symbol_fact'].includes(record.statement.kind)
  ));
  const releases = graph.records.filter((record) => record.source.kind === 'changelog');
  const communication = graph.records.filter((record) => record.source.kind === 'agent_log');
  const lines: string[] = [
    '# Podsumowanie todo2code', '',
    `> ${provenance} Raport jest projekcją ${conclusions.length} zwalidowanych wniosków; rekordy LLM z dokumentacji pozostają oznaczone jako \`llm_inference\`.`,
    '', '## Cel', '',
    ...renderRecords(plans.filter((record) => record.source.kind === 'nl' || record.source.kind === 'document'), 12, 'Brak wyodrębnionej deklaracji celu.'),
    '', '## Plan', '', ...renderRecords(plans.filter((record) => record.source.kind === 'todo'), 20, 'Brak pozycji TODO.'),
    '', '## Zmiany deklarowane w Git', '', ...renderRecords(git, 10, 'Brak dostępnej historii Git.'),
    '', '## Stan rzeczywisty kodu', '', ...renderRecords(facts, 25, 'Brak publicznych faktów AST.'),
    '', '## Dokumentacja i wydania', '', ...renderRecords(releases, 20, 'Brak wpisów changelogu.'),
    '', '## Komunikacja ludzi i agentów', '', ...renderRecords(communication, 30, 'Brak wersjonowanych rekordów komunikacji.'),
    '', '## Rozbieżności', '',
  ];
  const ordered = [...conclusions].sort(compareConclusions);
  if (ordered.length === 0) lines.push('- Nie wykryto rozbieżności blokujących. Nie oznacza to automatycznego zatwierdzenia `DONE`.');
  else for (const conclusion of ordered.slice(0, 30)) lines.push(renderConclusion(conclusion));
  lines.push('', '## Następne działania', '');
  const actions = ordered.filter((item) => item.kind === 'recommendation' || item.severity !== 'info').slice(0, 20);
  if (actions.length === 0) lines.push('- Przeprowadzić przegląd człowieka i zatwierdzić albo odrzucić wynik.');
  for (const conclusion of actions) {
    lines.push(`- Zweryfikować: **${conclusion.title}** — ${conclusion.detail} ${recordCitations(conclusion.recordIds)}`);
  }
  lines.push('', `Graf: \`${graph.fingerprint}\`.`);
  return `${lines.join('\n')}\n`;
}

export function compareConclusions(left: Conclusion, right: Conclusion): number {
  const severity: Record<DiagnosticSeverity, number> = { blocking: 0, review_required: 1, warning: 2, info: 3 };
  return severity[left.severity] - severity[right.severity] || left.id.localeCompare(right.id);
}

function renderRecords(records: IntentRecord[], limit: number, empty: string): string[] {
  if (records.length === 0) return [`- ${empty}`];
  return records.slice(0, limit).map((record) => {
    const confidence = Math.round(record.epistemic.confidence * 100);
    return `- ${record.statement.text} — ${record.source.kind}/${record.epistemic.class}, ${confidence}% [${record.id}]`;
  });
}

function renderConclusion(conclusion: Conclusion): string {
  const confidence = Math.round(conclusion.confidence * 100);
  return `- **${conclusion.title}** (${conclusion.kind}/${conclusion.severity}, ${confidence}%) — ${conclusion.detail} ${recordCitations(conclusion.recordIds)} _[${conclusion.diagnosticIds.join('] [')}]_`;
}

function recordCitations(recordIds: string[]): string {
  return `[${recordIds.join('] [')}]`;
}
