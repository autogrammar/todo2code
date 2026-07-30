import { createIntentId } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import { pathAliases } from '../core/target.js';
import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  IntentGraph,
  IntentRecord,
} from '../core/types.js';

export function diagnoseGraph(graph: IntentGraph, generatedAt = new Date().toISOString()): DiagnosticReport {
  assertIntentGraph(graph);
  const diagnostics: Diagnostic[] = [];
  const neighbors = buildNeighbors(graph);
  const recordsById = new Map(graph.records.map((record) => [record.id, record]));
  const implementedPaths = indexImplementedPaths(graph);

  for (const record of graph.records) {
    const related = (neighbors.get(record.id) ?? [])
      .map((id) => recordsById.get(id))
      .filter((item): item is IntentRecord => Boolean(item));
    const evidenced = related.some(isImplementationEvidence) || hasImplementedTarget(record, implementedPaths);
    if (isPlan(record) && !evidenced) {
      diagnostics.push(makeDiagnostic(
        record.lifecycle.status === 'completed' ? 'blocking' : 'warning',
        'PLANNED_NOT_IMPLEMENTED',
        record.lifecycle.status === 'completed' ? 'Zadanie oznaczone jako ukończone bez dowodu implementacji' : 'Zaplanowane zadanie bez dowodu implementacji',
        `Nie znaleziono powiązanego rekordu Git ani faktu AST dla: ${record.statement.text}`,
        [record.id],
        'Dodać identyfikator ticketu/symbolu albo dostarczyć implementację i ponownie uruchomić linker.',
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

    if (record.source.kind === 'changelog' && !evidenced) {
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
    if (missingFields.length > 0) {
      diagnostics.push(makeDiagnostic(
        'review_required',
        'AMBIGUOUS_REQUIREMENT',
        'Niekompletne wymaganie',
        `Brakujące pola: ${missingFields.join(', ')}. Treść: ${record.statement.text}`,
        [record.id],
        'Uzupełnić wymaganie bez automatycznego dopowiadania brakujących faktów.',
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
 * to do (see `test/linker-pairing.test.ts`). The evidence is nevertheless real:
 * a task naming `src/extractors/ast.ts` *is* implemented when facts were
 * extracted from that exact file. Reading it from the graph here keeps the
 * relation set sparse while removing the false "planned, no code" verdict —
 * measured on this repository as 7 blocking findings against tasks whose code
 * and passing tests were present.
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

/** True when the record names a file that Git or AST evidence covers. */
function hasImplementedTarget(record: IntentRecord, implementedPaths: Set<string>): boolean {
  return record.statement.target.paths.some((value) => pathAliases(value).some((alias) => implementedPaths.has(alias)));
}

function isPlan(record: IntentRecord): boolean {
  return ['nl', 'todo', 'document'].includes(record.source.kind)
    && !['implemented', 'released'].includes(record.lifecycle.status);
}

function isImplementationEvidence(record: IntentRecord): boolean {
  return ['git', 'ast'].includes(record.source.kind);
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
  return ['nl', 'todo', 'git', 'changelog', 'document'].includes(record.source.kind);
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
