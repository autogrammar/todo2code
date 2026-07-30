import { createIntentId } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import { normalizeToken, similarity } from '../core/text.js';
import type { Diagnostic, DiagnosticReport, IntentGraph, IntentRecord } from '../core/types.js';
import type { CommunicationRole } from '../extractors/communication.js';
import type { ParticipantCommunicationSynthesis } from './llm.js';

export type CommunicationIssueSeverity = 'info' | 'warning' | 'review_required' | 'blocking';

export interface CommunicationIssue {
  id: string;
  code:
    | 'PARTICIPANT_IDENTITY_UNRESOLVED'
    | 'HUMAN_COMMUNICATION_CONFLICT'
    | 'AGENT_COMMUNICATION_CONFLICT'
    | 'HUMAN_AGENT_CONFLICT'
    | 'REQUEST_WITHOUT_AGENT_RESPONSE'
    | 'AGENT_CLAIM_WITHOUT_EVIDENCE'
    | 'AGENT_WORK_OUTSIDE_REQUEST';
  severity: CommunicationIssueSeverity;
  ticket: string;
  participantIds: string[];
  recordIds: string[];
  detail: string;
  suggestedAction: string;
}

export interface ParticipantCommunicationAnalysis {
  participant: string;
  role: CommunicationRole;
  tickets: string[];
  communicationRecords: number;
  declarations: number;
  plans: number;
  claims: number;
  matchedGitCommits: number;
  linkedEvidenceRecords: number;
  issueIds: string[];
}

export interface CommunicationAnalysis {
  schemaVersion: 't2c.communication-analysis/v1';
  generatedAt: string;
  graphFingerprint: string;
  tickets: string[];
  participants: ParticipantCommunicationAnalysis[];
  syntheses: ParticipantCommunicationSynthesis[];
  issues: CommunicationIssue[];
  counts: Record<CommunicationIssueSeverity, number>;
}

export function analyzeCommunication(
  graph: IntentGraph,
  generatedAt = new Date().toISOString(),
  syntheses: ParticipantCommunicationSynthesis[] = [],
): CommunicationAnalysis {
  assertIntentGraph(graph);
  const communication = graph.records.filter((record) => record.source.kind === 'agent_log');
  validateSyntheses(syntheses, communication);
  const evidenceByRecord = evidenceNeighbors(graph);
  const issues: CommunicationIssue[] = [];
  const participants = new Map<string, IntentRecord[]>();

  for (const record of communication) {
    const participant = participantOf(record);
    const values = participants.get(participant);
    if (values) values.push(record);
    else participants.set(participant, [record]);
    if (roleOf(record) === 'unknown' || participant.startsWith('unknown:')) {
      issues.push(issue(
        'PARTICIPANT_IDENTITY_UNRESOLVED', 'review_required', ticketOf(record), [participant], [record.id],
        `Nie można wiarygodnie przypisać komunikatu do człowieka albo agenta: ${record.source.path ?? record.id}.`,
        'Uzupełnić front matter o participant oraz role: human|agent.',
      ));
    }
  }

  for (let leftIndex = 0; leftIndex < communication.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < communication.length; rightIndex += 1) {
      const left = communication[leftIndex];
      const right = communication[rightIndex];
      if (!left || !right || participantOf(left) === participantOf(right)) continue;
      if (ticketOf(left) !== ticketOf(right) || left.statement.polarity === right.statement.polarity) continue;
      if (!semanticMatch(left, right)) continue;
      const roles = [roleOf(left), roleOf(right)].sort().join(':');
      const code = roles === 'human:human'
        ? 'HUMAN_COMMUNICATION_CONFLICT'
        : roles === 'agent:agent'
          ? 'AGENT_COMMUNICATION_CONFLICT'
          : 'HUMAN_AGENT_CONFLICT';
      issues.push(issue(
        code, 'blocking', ticketOf(left), [participantOf(left), participantOf(right)], [left.id, right.id],
        `Przeciwne deklaracje dotyczą podobnego zakresu: „${left.statement.text}” / „${right.statement.text}”.`,
        'Rozstrzygnąć konflikt w decyzji człowieka i wskazać rekord, który superseduje poprzedni.',
      ));
    }
  }

  const humanRequests = communication.filter((record) => roleOf(record) === 'human' && ['request', 'message'].includes(typeOf(record)));
  const agentMessages = communication.filter((record) => roleOf(record) === 'agent');
  for (const request of humanRequests) {
    const response = agentMessages.some((record) => ticketOf(record) === ticketOf(request) && semanticMatch(record, request));
    if (!response) {
      issues.push(issue(
        'REQUEST_WITHOUT_AGENT_RESPONSE', 'warning', ticketOf(request), [participantOf(request)], [request.id],
        `Polecenie człowieka nie ma semantycznie powiązanej odpowiedzi agenta: ${request.statement.text}`,
        'Agent powinien dodać plik planu albo jawnie odrzucić/zablokować polecenie z uzasadnieniem.',
      ));
    }
  }

  for (const record of agentMessages) {
    const type = typeOf(record);
    if (['report', 'result', 'claim'].includes(type)) {
      const participantGit = matchedGitRecords(record, graph.records);
      const linked = evidenceByRecord.get(record.id) ?? [];
      if (participantGit.length === 0 && linked.length === 0) {
        issues.push(issue(
          'AGENT_CLAIM_WITHOUT_EVIDENCE', 'review_required', ticketOf(record), [participantOf(record)], [record.id],
          `Agent raportuje wykonanie bez powiązanego commita lub faktu AST: ${record.statement.text}`,
          'Dodać ticket do commita albo wskazać paths/symbols i ponownie uruchomić analizę.',
        ));
      }
    }
    if (['plan', 'report', 'result', 'claim'].includes(type)) {
      const matchedRequest = humanRequests.some((request) => ticketOf(request) === ticketOf(record) && semanticMatch(request, record));
      if (!matchedRequest) {
        issues.push(issue(
          'AGENT_WORK_OUTSIDE_REQUEST', 'warning', ticketOf(record), [participantOf(record)], [record.id],
          `Plan lub działanie agenta nie ma powiązanej intencji człowieka: ${record.statement.text}`,
          'Powiązać działanie z poleceniem człowieka albo uzyskać decyzję rozszerzającą zakres ticketu.',
        ));
      }
    }
  }

  const uniqueIssues = [...new Map(issues.map((item) => [item.id, item])).values()]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.id.localeCompare(b.id));
  const participantRows = [...participants.entries()].map(([participant, records]) => {
    const aliases = new Set(records.flatMap(gitAliases));
    aliases.add(normalizeIdentity(participant));
    const matchedGit = graph.records.filter((record) => record.source.kind === 'git' && aliases.has(normalizeIdentity(record.statement.actor ?? '')));
    const evidence = new Set(records.flatMap((record) => evidenceByRecord.get(record.id) ?? []));
    return {
      participant,
      role: roleOf(records[0]),
      tickets: [...new Set(records.map(ticketOf))].sort(),
      communicationRecords: records.length,
      declarations: records.filter((record) => record.epistemic.class === 'declaration').length,
      plans: records.filter((record) => record.epistemic.class === 'plan').length,
      claims: records.filter((record) => record.epistemic.class === 'claim').length,
      matchedGitCommits: matchedGit.length,
      linkedEvidenceRecords: evidence.size,
      issueIds: uniqueIssues.filter((item) => item.participantIds.includes(participant)).map((item) => item.id),
    } satisfies ParticipantCommunicationAnalysis;
  }).sort((a, b) => a.role.localeCompare(b.role) || a.participant.localeCompare(b.participant));
  const counts: Record<CommunicationIssueSeverity, number> = { info: 0, warning: 0, review_required: 0, blocking: 0 };
  for (const item of uniqueIssues) counts[item.severity] += 1;
  return {
    schemaVersion: 't2c.communication-analysis/v1',
    generatedAt,
    graphFingerprint: graph.fingerprint,
    tickets: [...new Set(communication.map(ticketOf))].sort(),
    participants: participantRows,
    syntheses: [...syntheses].sort((left, right) => left.role.localeCompare(right.role) || left.participant.localeCompare(right.participant)),
    issues: uniqueIssues,
    counts,
  };
}

function validateSyntheses(syntheses: ParticipantCommunicationSynthesis[], communication: IntentRecord[]): void {
  const byId = new Map(communication.map((record) => [record.id, record]));
  const ids = new Set<string>();
  for (const synthesis of syntheses) {
    if (synthesis.schemaVersion !== 't2c.participant-synthesis/v1') {
      throw new Error('Unsupported participant synthesis schemaVersion');
    }
    if (ids.has(synthesis.id)) throw new Error(`Duplicate participant synthesis id: ${synthesis.id}`);
    ids.add(synthesis.id);
    if (!synthesis.recordIds.length) throw new Error(`Participant synthesis ${synthesis.id} has no record citations`);
    for (const recordId of synthesis.recordIds) {
      const record = byId.get(recordId);
      if (!record) throw new Error(`Participant synthesis ${synthesis.id} cites unknown communication record ${recordId}`);
      if (participantOf(record) !== synthesis.participant || roleOf(record) !== synthesis.role) {
        throw new Error(`Participant synthesis ${synthesis.id} cites a record owned by another participant`);
      }
      if (!record.statement.target.tickets.some((ticket) => synthesis.tickets.includes(ticket))) {
        throw new Error(`Participant synthesis ${synthesis.id} cites a record outside its tickets`);
      }
    }
  }
}

export function renderCommunicationMarkdown(analysis: CommunicationAnalysis): string {
  const lines = [
    '# Analiza komunikacji ludzi i agentów', '',
    `Graf: \`${analysis.graphFingerprint}\`. Tickety: ${analysis.tickets.map((ticket) => `\`${ticket}\``).join(', ') || 'brak'}.`, '',
    '## Uczestnicy', '',
    '| Uczestnik | Rola | Wiadomości | Plany | Claimy | Commity | Dowody | Problemy |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
    ...analysis.participants.map((item) => `| ${escapeCell(item.participant)} | ${item.role} | ${item.communicationRecords} | ${item.plans} | ${item.claims} | ${item.matchedGitCommits} | ${item.linkedEvidenceRecords} | ${item.issueIds.length} |`),
    '', '## Synteza per uczestnik', '',
  ];
  if (analysis.syntheses.length === 0) lines.push('- Brak uziemionych syntez uczestników.');
  for (const item of analysis.syntheses) {
    lines.push(`- **${escapeCell(item.participant)} / ${item.role}** — ${item.summary} ${item.recordIds.map((id) => `[${id}]`).join(' ')}`);
    if (item.commitments.length) lines.push(`  - Zobowiązania: ${item.commitments.join('; ')}`);
    if (item.risks.length) lines.push(`  - Ryzyka: ${item.risks.join('; ')}`);
  }
  lines.push('', '## Rozbieżności', '');
  if (analysis.issues.length === 0) lines.push('- Nie wykryto rozbieżności w dostępnych źródłach. Nie oznacza to automatycznego zatwierdzenia wykonania.');
  for (const item of analysis.issues) {
    lines.push(`- **${item.severity} / ${item.code} / ${item.ticket}** — ${item.detail} ${item.recordIds.map((id) => `[${id}]`).join(' ')}`);
    lines.push(`  - Następny krok: ${item.suggestedAction}`);
  }
  return `${lines.join('\n')}\n`;
}

export function addCommunicationIssuesToDiagnostics(
  report: DiagnosticReport,
  analysis: CommunicationAnalysis,
): DiagnosticReport {
  if (report.graphFingerprint !== analysis.graphFingerprint) {
    throw new Error('Communication analysis does not describe the diagnostic graph');
  }
  const communicationDiagnostics: Diagnostic[] = analysis.issues.map((item) => ({
    id: createIntentId({ communicationIssueId: item.id, graphFingerprint: report.graphFingerprint }, 'DIAG'),
    code: item.code,
    severity: item.severity,
    title: communicationIssueTitle(item.code),
    detail: `${item.detail} Communication issue: ${item.id}. Ticket: ${item.ticket}. Participants: ${item.participantIds.join(', ')}.`,
    recordIds: [...item.recordIds],
    suggestedAction: item.suggestedAction,
  }));
  const combined = [...report.diagnostics, ...communicationDiagnostics];
  const hasSerious = combined.some((item) => item.severity === 'blocking' || item.severity === 'review_required');
  const diagnostics = [...new Map(combined
    .filter((item) => !(hasSerious && item.code === 'ALIGNED'))
    .map((item) => [item.id, item])).values()]
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.id.localeCompare(right.id));
  const counts: DiagnosticReport['counts'] = { info: 0, warning: 0, review_required: 0, blocking: 0 };
  for (const diagnostic of diagnostics) counts[diagnostic.severity] += 1;
  return { ...report, diagnostics, counts };
}

function communicationIssueTitle(code: CommunicationIssue['code']): string {
  return ({
    PARTICIPANT_IDENTITY_UNRESOLVED: 'Nierozstrzygnięta tożsamość uczestnika',
    HUMAN_COMMUNICATION_CONFLICT: 'Sprzeczne deklaracje ludzi',
    AGENT_COMMUNICATION_CONFLICT: 'Sprzeczne deklaracje agentów',
    HUMAN_AGENT_CONFLICT: 'Sprzeczność człowiek–agent',
    REQUEST_WITHOUT_AGENT_RESPONSE: 'Polecenie bez odpowiedzi agenta',
    AGENT_CLAIM_WITHOUT_EVIDENCE: 'Claim agenta bez dowodu',
    AGENT_WORK_OUTSIDE_REQUEST: 'Praca agenta poza intencją człowieka',
  } satisfies Record<CommunicationIssue['code'], string>)[code];
}

function evidenceNeighbors(graph: IntentGraph): Map<string, string[]> {
  const records = new Map(graph.records.map((record) => [record.id, record]));
  const output = new Map<string, string[]>();
  for (const relation of graph.relations) {
    const left = records.get(relation.from);
    const right = records.get(relation.to);
    if (!left || !right) continue;
    if (left.source.kind === 'agent_log' && isEvidenceRecord(right) && semanticMatch(left, right)) {
      append(output, left.id, right.id);
    }
    if (right.source.kind === 'agent_log' && isEvidenceRecord(left) && semanticMatch(right, left)) {
      append(output, right.id, left.id);
    }
  }
  return output;
}

function isEvidenceRecord(record: IntentRecord): boolean {
  if (record.source.kind === 'git' || record.source.kind === 'test') return true;
  return record.source.kind === 'ast' && ['symbol_fact', 'python_symbol_fact'].includes(record.statement.kind);
}

function matchedGitRecords(record: IntentRecord, records: IntentRecord[]): IntentRecord[] {
  const aliases = new Set(gitAliases(record));
  aliases.add(normalizeIdentity(participantOf(record)));
  return records.filter((candidate) => candidate.source.kind === 'git'
    && aliases.has(normalizeIdentity(candidate.statement.actor ?? ''))
    && (ticketOf(candidate) === ticketOf(record) || semanticMatch(candidate, record)));
}

function semanticMatch(left: IntentRecord, right: IntentRecord): boolean {
  if (intersects(left.statement.target.paths, right.statement.target.paths)) return true;
  if (intersects(left.statement.target.symbols, right.statement.target.symbols)) return true;
  // A shared ticket only establishes scope. It must not make two unrelated
  // statements semantically equivalent (for example validation vs licensing).
  return similarity(withoutTickets(left), withoutTickets(right)) >= 0.2;
}

function withoutTickets(record: IntentRecord): string {
  let value = record.statement.text;
  for (const ticket of record.statement.target.tickets) {
    value = value.replace(new RegExp(escapeRegex(ticket), 'gi'), ' ');
  }
  return value;
}

function intersects(left: string[], right: string[]): boolean {
  const values = new Set(left.map((item) => normalizeToken(item)));
  return right.some((item) => values.has(normalizeToken(item)));
}

function participantOf(record: IntentRecord): string {
  return typeof record.metadata.participant === 'string'
    ? record.metadata.participant
    : record.statement.actor ?? `unknown:${record.id}`;
}

function roleOf(record: IntentRecord | undefined): CommunicationRole {
  return record?.metadata.participantRole === 'human' || record?.metadata.participantRole === 'agent'
    ? record.metadata.participantRole
    : 'unknown';
}

function typeOf(record: IntentRecord): string {
  return typeof record.metadata.messageType === 'string' ? record.metadata.messageType : 'message';
}

function ticketOf(record: IntentRecord): string {
  if (typeof record.metadata.ticket === 'string') return record.metadata.ticket.toUpperCase();
  return record.statement.target.tickets[0]?.toUpperCase() ?? 'UNSCOPED';
}

function gitAliases(record: IntentRecord): string[] {
  return Array.isArray(record.metadata.gitAuthors)
    ? record.metadata.gitAuthors.filter((item): item is string => typeof item === 'string').map(normalizeIdentity)
    : [];
}

function normalizeIdentity(value: string): string {
  return normalizeToken(value).replace(/[^a-z0-9]+/g, '');
}

function append(map: Map<string, string[]>, key: string, value: string): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function issue(
  code: CommunicationIssue['code'], severity: CommunicationIssueSeverity, ticket: string,
  participantIds: string[], recordIds: string[], detail: string, suggestedAction: string,
): CommunicationIssue {
  const sortedParticipants = [...new Set(participantIds)].sort();
  const sortedRecords = [...new Set(recordIds)].sort();
  return {
    id: createIntentId({ code, ticket, participantIds: sortedParticipants, recordIds: sortedRecords }, 'COMM'),
    code, severity, ticket, participantIds: sortedParticipants, recordIds: sortedRecords, detail, suggestedAction,
  };
}

function severityRank(value: CommunicationIssueSeverity): number {
  return { info: 0, warning: 1, review_required: 2, blocking: 3 }[value];
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
}
