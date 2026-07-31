import { createIntentId } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import { pathAliases } from '../core/target.js';
import { isActionableChangelogRecord } from './changelog-signal.js';
import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  IntentGraph,
  IntentRecord,
  IntentRelation,
} from '../core/types.js';
import { buildSymbolResolutionIndex, type NlSymbolResolution } from './symbol-resolution.js';
import { hasCapabilityClaim, isFileAggregate } from './capability-evidence.js';

export function diagnoseGraph(graph: IntentGraph, generatedAt = new Date().toISOString()): DiagnosticReport {
  assertIntentGraph(graph);
  const diagnostics: Diagnostic[] = [];
  const neighbors = buildNeighbors(graph);
  const recordsById = new Map(graph.records.map((record) => [record.id, record]));
  const groundedImplementation = indexGroundedImplementationEvidence(graph, recordsById);
  const implementedPaths = indexImplementedPaths(graph);
  const documentedPaths = indexDocumentedPaths(graph);
  const symbolResolutionIndex = buildSymbolResolutionIndex(graph.records);

  for (const record of graph.records) {
    const related = (neighbors.get(record.id) ?? [])
      .map((id) => recordsById.get(id))
      .filter((item): item is IntentRecord => Boolean(item));
    const evidenced = groundedImplementation.has(record.id)
      || !hasCapabilityClaim(record) && hasImplementedTarget(record, implementedPaths)
      || record.source.kind === 'changelog' && hasDocumentedTarget(record, documentedPaths);
    if (isPlan(record) && !evidenced) {
      const hasLocationOnlyEvidence = related.some(isImplementationEvidence);
      diagnostics.push(makeDiagnostic(
        record.lifecycle.status === 'completed' ? 'blocking' : 'warning',
        'PLANNED_NOT_IMPLEMENTED',
        record.lifecycle.status === 'completed' ? 'Zadanie oznaczone jako ukończone bez dowodu implementacji' : 'Zaplanowane zadanie bez dowodu implementacji',
        hasLocationOnlyEvidence
          ? `Powiązany rekord Git/AST wskazuje lokalizację, ale nie potwierdza wymaganej funkcji: ${record.statement.text}`
          : `Nie znaleziono powiązanego rekordu Git ani faktu AST dla: ${record.statement.text}`,
        [record.id],
        hasLocationOnlyEvidence
          ? 'Wykonawca techniczny powinien dostarczyć brakującą funkcję lub wskazać jej symbol; następnie ponownie uruchomić linker.'
          : 'Dodać identyfikator ticketu/symbolu albo dostarczyć implementację i ponownie uruchomić linker.',
      ));
    }

    if (isPublicImplementation(record) && !related.some(isPlan)) {
      diagnostics.push(makeDiagnostic(
        'warning',
        'IMPLEMENTED_NOT_PLANNED',
        'Implementacja bez powiązanego planu',
        `Fakt implementacyjny nie ma relacji do NL, TODO ani dokumentacji intencji: ${record.statement.object}`,
        [record.id],
        'Powiązać symbol z ticketem/TODO lub udokumentować, dlaczego implementacja jest poza planem.',
      ));
    }

    if (isReleaseCandidate(record) && !related.some((item) => item.source.kind === 'changelog' || item.source.kind === 'document')) {
      diagnostics.push(makeDiagnostic(
        'info',
        'IMPLEMENTED_NOT_DOCUMENTED',
        'Zmiana bez dokumentacji wydania',
        `Zmiana ${record.statement.object} nie ma powiązanego wpisu dokumentacyjnego lub changelogu.`,
        [record.id],
        'Dodać albo powiązać wpis CHANGELOG/dokumentacji, jeśli zmiana jest publiczna.',
      ));
    }

    if (record.source.kind === 'changelog' && isActionableChangelogRecord(record) && !evidenced) {
      diagnostics.push(makeDiagnostic(
        'review_required',
        'CHANGELOG_WITHOUT_IMPLEMENTATION',
        'Wpis changelogu bez dowodu implementacji',
        `Wpis wydania nie ma powiązanego commita ani faktu AST: ${record.statement.text}`,
        [record.id],
        'Zweryfikować wpis lub dodać jednoznaczne odwołanie do ticketu, commita, pliku albo symbolu.',
      ));
    }

    const missingFields = Array.isArray(record.metadata.missingFields)
      ? record.metadata.missingFields.filter((item): item is string => typeof item === 'string')
      : [];
    const symbolIssues = (symbolResolutionIndex.byNlRecord.get(record.id) ?? [])
      .filter((resolution) => resolution.status === 'ambiguous' || resolution.status === 'conflicting');
    if (missingFields.length > 0 || symbolIssues.length > 0) {
      const detail = ambiguityDetail(record, missingFields, symbolIssues);
      diagnostics.push(makeDiagnostic(
        'review_required',
        'AMBIGUOUS_REQUIREMENT',
        symbolIssues.length > 0 ? 'Niejednoznaczny cel wymagania' : 'Niekompletne wymaganie',
        detail,
        [record.id],
        ambiguityAction(missingFields, symbolIssues),
      ));
    }

    if (record.epistemic.confidence < 0.5 && record.source.kind !== 'ast') {
      diagnostics.push(makeDiagnostic(
        'info',
        'LOW_CONFIDENCE',
        'Niska pewność ekstrakcji',
        `Rekord ma confidence=${record.epistemic.confidence}: ${record.statement.text}`,
        [record.id],
        'Doprecyzować źródło lub dodać jawny identyfikator, ścieżkę albo symbol.',
      ));
    }

    if ((neighbors.get(record.id)?.length ?? 0) === 0 && isImportantRecord(record)) {
      diagnostics.push(makeDiagnostic(
        'warning',
        'UNLINKED_RECORD',
        'Rekord niepołączony z przepływem wiedzy',
        `Nie znaleziono relacji dla ${record.id}: ${record.statement.text}`,
        [record.id],
        'Dodać wspólny ticket, symbol, ścieżkę lub bardziej jednoznaczny obiekt intencji.',
      ));
    }
  }

  for (const relation of graph.relations.filter((item) => item.type === 'contradicts')) {
    diagnostics.push(makeDiagnostic(
      'blocking',
      'CONFLICTING_INTENT',
      'Sprzeczne intencje lub dowody',
      `Relacja ${relation.id} łączy rekordy o przeciwnej polaryzacji.`,
      [relation.from, relation.to],
      'Rozstrzygnąć konflikt w kanonicznym tickecie lub decyzji człowieka.',
    ));
  }

  if (!diagnostics.some((item) => item.severity === 'blocking' || item.severity === 'review_required')) {
    diagnostics.push(makeDiagnostic(
      'info',
      'ALIGNED',
      'Brak blokujących rozbieżności',
      'Dostępne źródła nie wykazały konfliktu wymagającego blokady. Nie jest to automatyczne zatwierdzenie DONE.',
      [],
      'Przejrzeć raport i zatwierdzić wynik zgodnie z polityką projektu.',
    ));
  }

  const unique = [...new Map(diagnostics.map((item) => [item.id, item])).values()]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.id.localeCompare(b.id));
  const counts: Record<DiagnosticSeverity, number> = { info: 0, warning: 0, review_required: 0, blocking: 0 };
  for (const item of unique) counts[item.severity] += 1;
  return {
    schemaVersion: 't2c.diagnostics/v1',
    generatedAt,
    graphFingerprint: graph.fingerprint,
    diagnostics: unique,
    counts,
  };
}

/**
 * Relations are navigation until their basis proves the requested behaviour.
 * In particular, `shared_path + module_coverage` says only that a file exists.
 */
function indexGroundedImplementationEvidence(
  graph: IntentGraph,
  recordsById: Map<string, IntentRecord>,
): Set<string> {
  const grounded = new Set<string>();
  for (const relation of graph.relations) {
    const left = recordsById.get(relation.from);
    const right = recordsById.get(relation.to);
    if (!left || !right) continue;
    if (isImplementationEvidence(right) && relationSupportsImplementation(left, right, relation)) {
      grounded.add(left.id);
    }
    if (isImplementationEvidence(left) && relationSupportsImplementation(right, left, relation)) {
      grounded.add(right.id);
    }
  }
  return grounded;
}

function relationSupportsImplementation(
  declaration: IntentRecord,
  evidence: IntentRecord,
  relation: IntentRelation,
): boolean {
  const basis = relation.basis;
  if (basis.includes('shared_symbol')) return true;
  if (basis.some((item) => item.startsWith('module_topic:')
    || item.startsWith('capability_overlap:')
    || item === 'cross_language_reranker')) return true;

  // Text similarity to a concrete fact/commit may corroborate a capability.
  // Aggregate text contains its own path, so similarity there would merely
  // count the location a second time.
  if (!isFileAggregate(evidence) && basis.some((item) => {
    const score = item.startsWith('text_similarity:') ? Number(item.slice('text_similarity:'.length)) : 0;
    return Number.isFinite(score) && score >= 0.2;
  })) return true;

  // A declaration that says nothing beyond the edit envelope may be fulfilled
  // by exact target evidence. Capability-bearing declarations cannot.
  return !hasCapabilityClaim(declaration)
    && basis.some((item) => item === 'shared_path' || item === 'shared_ticket');
}

function ambiguityDetail(
  record: IntentRecord,
  missingFields: string[],
  symbolIssues: NlSymbolResolution[],
): string {
  const parts: string[] = [];
  if (missingFields.length > 0) parts.push(`Brakujące pola: ${missingFields.join(', ')}`);
  for (const issue of symbolIssues) {
    const paths = issue.paths.join(', ');
    parts.push(issue.status === 'conflicting'
      ? `Symbol "${issue.symbol}" nie występuje we wskazanej ścieżce; deklaracje AST: ${paths}`
      : `Symbol "${issue.symbol}" wskazuje kilka plików AST: ${paths}`);
  }
  parts.push(`Treść: ${record.statement.text}`);
  return parts.join('. ');
}

function ambiguityAction(missingFields: string[], symbolIssues: NlSymbolResolution[]): string {
  const actions = missingFields.map((field) => MISSING_FIELD_ACTIONS[field]
    ?? `Uzupełnić pole ${field} jawnie w wymaganiu.`);
  for (const issue of symbolIssues) {
    actions.push(issue.status === 'conflicting'
      ? `Poprawić target.path dla symbolu ${issue.symbol}; dostępne ścieżki: ${issue.paths.join(', ')}.`
      : `Dodać target.path dla symbolu ${issue.symbol}; wybrać jedną z: ${issue.paths.join(', ')}.`);
  }
  return [...new Set(actions)].join(' ');
}

const MISSING_FIELD_ACTIONS: Record<string, string> = {
  action: 'Dodać jednoznaczny czasownik działania, np. dodać, usunąć albo zweryfikować.',
  object: 'Nazwać konkretny obiekt lub zachowanie, którego dotyczy zmiana.',
  text: 'Dodać niepustą treść wymagania.',
  trigger: 'Wskazać moment lub warunek wykonania, np. przed zapisem albo po błędzie.',
  failure_behavior: 'Opisać zachowanie przy niepowodzeniu, np. odrzucenie lub zwracany błąd.',
  acceptance_evidence: 'Dodać mierzalne kryterium akceptacji, test albo oczekiwany wynik.',
};

function buildNeighbors(graph: IntentGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const relation of graph.relations) {
    appendNeighbor(map, relation.from, relation.to);
    appendNeighbor(map, relation.to, relation.from);
  }
  return map;
}

function appendNeighbor(map: Map<string, string[]>, from: string, to: string): void {
  const values = map.get(from);
  if (values) values.push(to);
  else map.set(from, [to]);
}

/**
 * Files that Git or AST evidence actually touched, as an alias set.
 *
 * Symbol-level facts cannot be linked to a file-level plan without pairing that
 * plan with every symbol in the module, which the linker deliberately refuses
 * to do (see `test/linker-pairing.test.ts`). This index therefore closes only
 * declarations that carry no behavioural claim beyond their file target.
 * Capability-bearing declarations require grounded relation evidence and do
 * not call `hasImplementedTarget` at all.
 */
function indexImplementedPaths(graph: IntentGraph): Set<string> {
  const paths = new Set<string>();
  for (const record of graph.records) {
    if (!isImplementationEvidence(record)) continue;
    for (const value of record.statement.target.paths) {
      for (const alias of pathAliases(value)) paths.add(alias);
    }
    if (record.source.path) {
      for (const alias of pathAliases(record.source.path)) paths.add(alias);
    }
  }
  return paths;
}

/** Documentation files are evidence for changelog entries that name them. */
function indexDocumentedPaths(graph: IntentGraph): Set<string> {
  const paths = new Set<string>();
  for (const record of graph.records) {
    if (record.source.kind !== 'document' || !record.source.path) continue;
    for (const alias of pathAliases(record.source.path)) paths.add(alias);
  }
  return paths;
}

/** True when the record names a file that Git or AST evidence covers. */
function hasImplementedTarget(record: IntentRecord, implementedPaths: Set<string>): boolean {
  return record.statement.target.paths.some((value) => pathAliases(value).some((alias) => implementedPaths.has(alias)));
}

function hasDocumentedTarget(record: IntentRecord, documentedPaths: Set<string>): boolean {
  return record.statement.target.paths.some((value) => pathAliases(value).some((alias) => documentedPaths.has(alias)));
}

function isPlan(record: IntentRecord): boolean {
  if (['implemented', 'released'].includes(record.lifecycle.status)) return false;
  // A TODO item or an NL task is a plan by construction. Documentation is not:
  // most of it describes what already exists. Once the deterministic converter
  // started emitting `document` records, treating every sentence as a plan
  // produced 574 "planned, no code" findings on this repository, 555 of them
  // from purely descriptive prose. Only prescriptive wording states an
  // obligation that code can fail to meet.
  if (record.source.kind === 'document') {
    return ['required', 'recommended'].includes(record.statement.modality);
  }
  return ['nl', 'todo'].includes(record.source.kind);
}

function isImplementationEvidence(record: IntentRecord): boolean {
  // Configuration is observed reality too: a declared key in a committed file
  // is evidence that the behaviour exists, exactly like an AST fact.
  return ['git', 'ast', 'system'].includes(record.source.kind);
}

function isPublicImplementation(record: IntentRecord): boolean {
  if (record.source.kind !== 'ast' || record.statement.kind !== 'symbol_fact' && record.statement.kind !== 'python_symbol_fact') return false;
  const symbol = record.source.symbol ?? record.statement.object;
  if (symbol.startsWith('_')) return false;
  if (record.metadata.language === 'typescript' || record.metadata.language === 'javascript') return record.metadata.exported === true;
  return true;
}

function isReleaseCandidate(record: IntentRecord): boolean {
  if (record.source.kind === 'git') return record.metadata.docOnly !== true;
  return isPublicImplementation(record);
}

function isImportantRecord(record: IntentRecord): boolean {
  if (record.source.kind === 'ast') return isPublicImplementation(record);
  if (record.source.kind === 'changelog') return isActionableChangelogRecord(record);
  return ['nl', 'todo', 'git', 'document'].includes(record.source.kind);
}

function makeDiagnostic(
  severity: DiagnosticSeverity,
  code: Diagnostic['code'],
  title: string,
  detail: string,
  recordIds: string[],
  suggestedAction: string,
): Diagnostic {
  const seed = { severity, code, title, detail, recordIds: [...recordIds].sort() };
  return {
    id: createIntentId(seed, 'DIAG'),
    code,
    severity,
    title,
    detail,
    recordIds: [...recordIds].sort(),
    suggestedAction,
  };
}

function severityRank(value: DiagnosticSeverity): number {
  return { info: 0, warning: 1, review_required: 2, blocking: 3 }[value];
}
