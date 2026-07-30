# Aktualny stan projektu

Stan na **2026-07-30**, wersja runtime `0.4.0`.

## Ocena wykonania przepływu

Aktualny runtime realizuje kompletną ścieżkę wejściową i analityczną:

```text
NL / Git / AST / TODO / CHANGELOG / dokumentacja
                         ↓
                 t2c.intent/v1
                         ↓
           walidacja + deterministyczny linker
                         ↓
                  t2c.graph/v1
                         ↓
       diagnostyka + Intent vs Reality + diff
                    ↙             ↘
 raport NL (LLM/fallback)    conclusion + todo-proposal
                                      ↓
                              TODO.patch → approved apply
```

Rygorystyczne kontrakty wyjściowe `t2c.conclusion/v1`,
`t2c.todo-proposal/v1` i `t2c.todo-patch/v1` są dostępne przez CLI, MCP, A2A,
service i pięć SDK. Główny pipeline opcjonalnie zapisuje syntezę, walidację i
patch w manifeście runu. `TODO.md` zmienia wyłącznie osobna operacja apply po
jawnej zgodzie na dokładny hash; receipt również trafia do manifestu. Sekcja
„Następne działania” w `team-summary.md` pozostaje niezależną projekcją
diagnostyki/narracją LLM i nie zastępuje walidowanych propozycji DSL2TODO.

## Macierz komponentów

| Komponent | Stan | Ograniczenie lub dowód |
|---|---|---|
| NL → DSL, parser deterministyczny | działa | Testy obejmują segmentację, modalność i jawny fallback; złożone zdania nadal mogą otrzymać `AMBIGUOUS_REQUIREMENT` |
| NL → DSL, OpenRouter | działa kontraktowo | Sukces, błędy i `require-llm` są testowane z providerem kontrolowanym; dostępność live zależy od modelu |
| Git → DSL | działa | Jeden rekord na commit, diff, pliki i numstat; test obejmuje także repo bez commitów |
| TypeScript/JavaScript AST → DSL | działa | TypeScript Compiler API |
| Python AST → DSL | działa | helper standard-library `ast` |
| Go AST → DSL | działa | helper `go/ast` i jawna degradacja bez toolchainu |
| Rust AST → DSL | działa | helper `syn` i jawna degradacja bez toolchainu |
| Java AST → DSL | działa warunkowo | adapter ma testy, ale bieżąca lokalna walidacja pominęła fixture z powodu braku JDK |
| TODO → DSL | działa | osobny parser; checkbox i lifecycle pozostają deterministyczne |
| CHANGELOG → DSL | działa | osobny parser; zachowuje wersję, datę, kategorię i klasę `claim` |
| TODO/CHANGELOG + LLM | działa kontraktowo, live niestabilne | struktura jest chroniona przez runtime; ostatni run `qwen/qwen3.7-plus` przekroczył 120 s i użył jawnego fallbacku |
| Dokumentacja → DSL | działa kontraktowo | chunking, budżet i structured output są testowane; brak deterministycznego odpowiednika semantycznego |
| `project/<ticket>/` komunikacja → DSL | działa | zachowuje uczestnika, `human|agent`, typ wypowiedzi, ticket i aliasy Git jako `agent_log` |
| Analiza uczestników i rozbieżności komunikacji | działa w pipeline/CLI/MCP/A2A/history/UI/watch | grupuje każdego człowieka/agenta, porównuje request/plan/claim z Git/AST, zapisuje artefakty i wspiera filtry participant/role/ticket/severity |
| Linker i walidacja grafu | działa | pełna walidacja `t2c.intent/v1` i `t2c.graph/v1`, stabilny fingerprint |
| Diagnostyka i Intent vs Reality | działa | wynik jest deterministyczny, ale AST może dominować liczbę tematów i ostrzeżeń |
| Graf → raport NL | działa | LLM ma ograniczony payload; bez modelu powstaje jawnie oznaczony raport deterministyczny |
| Kontrakty wniosków i zadań DSL | działa | JSON Schema, typy, stabilne ID, walidacja cytowań względem konkretnego grafu/raportu i jawna provenance LLM/fallback |
| DSL/diagnostyka → zadania DSL | działa we wszystkich interfejsach | audytowana synteza OpenRouter, walidacja, deduplikacja z TODO, priority i acykliczne zależności; `require-llm` nie fallbackuje |
| Zadania DSL → `TODO.patch` | działa we wszystkich interfejsach | stabilny renderer i JSON audit, jawna zgoda hasha, ochrona stale/tampering, atomowe/idempotentne apply z receiptem i rejestracją w run history |

## Bieżąca walidacja

`npm run verify` zakończyło się powodzeniem:

- 148 testów: 147 zaliczonych, 0 błędów, 1 pominięty test Java bez lokalnego JDK;
- 47 modułów i 247 importów wewnętrznych: brak cykli, niezależny `src/core`;
- 9 deterministycznych entrypointów i 18 modułów bez tranzytywnego importu LLM;
- 57 zmiennych używanych przez kod/Docker i 57 odpowiadających kluczy
  `.env.example`, bez duplikatów;
- kompilacja TypeScript `strict` i pełna walidacja runtime DSL zakończone
  powodzeniem.

Przebieg offline na `examples/` utworzył 207 rekordów i 651 relacji. Liczba
relacji jest snapshotem, ponieważ wejście Git obejmuje
ostatnich 10 commitów:

| Źródło | Rekordy |
|---|---:|
| AST | 180 |
| Git | 10 |
| NL | 7 |
| TODO | 3 |
| CHANGELOG | 2 |

Diagnostyka zawierała 0 blokad, 6 pozycji `review_required`, 41 ostrzeżeń i
39 informacji. Bieżące `make demo` jawnie wyłącza LLM dokumentacji i
podsumowania, dzięki czemu stan runu jest `succeeded` i nie zależy od sieci ani
prywatnego `.env`. Nie jest to jednak dowód jakości semantycznej LLM.

Testy potwierdzają wykonanie ścieżek i kontraktów, nie mierzą jeszcze jakości
semantycznej na zbiorze wzorcowym. Projekt nie ma obecnie raportowanych metryk
precision/recall dla NL → DSL, dokumentacja → DSL, linkowania ani DSL2TODO.

## Najważniejsze ograniczenia

1. Pipeline tworzy patch do review, ale celowo nie może go sam zatwierdzić;
   approval pozostaje osobną operacją człowieka lub uprawnionego klienta.
2. Raport LLM jest nadal Markdownem i nie przechodzi jeszcze przez istniejący
   kontrakt `t2c.conclusion/v1`.
3. Fakty AST są znacznie drobniejsze niż intencje produktowe. Bez agregacji
   zawyżają liczbę `IMPLEMENTED_NOT_PLANNED` i `IMPLEMENTED_NOT_DOCUMENTED`.
4. Wzbogacanie całego TODO/CHANGELOG jednym dużym żądaniem może przekroczyć
   timeout providera.
5. Adaptery językowe są orkiestratorowane przez duży `src/extractors/ast.ts`;
   podział per język uprości niezależne wersjonowanie i testowanie.
6. Porównania historyczne wykonane bez dokumentacyjnego DSL raportują 0%
   pokrycia dokumentacją jako brak dowodu w grafie, a nie dowód braku
   dokumentacji w repozytorium.
7. Analiza komunikacji ma deterministyczny parser. Semantyczne wzbogacanie per
   uczestnik przez LLM i jawny rejestr aliasów tożsamości pozostają zaplanowane.

## Wdrożony przepływ DSL2TODO

```text
t2c.graph/v1 + t2c.diagnostics/v1
                  ↓
       audytowana synteza zadań przez LLM
                  ↓
          t2c.todo-proposal/v1
                  ↓
     walidacja + deduplikacja + priorytety
                  ↓
              TODO.patch
                  ↓
          akceptacja człowieka
```

Każda propozycja zawiera źródłowe ID diagnostyk i rekordów, zakres
plików/symboli, kryteria akceptacji, priorytet, zależności, confidence oraz
pełny audyt modelu i wersji runtime. LLM może syntetyzować i dzielić zadania,
ale nie może usuwać dowodów ani bez zatwierdzenia modyfikować `TODO.md`.

Szczegółowy, uporządkowany backlog znajduje się w [`TODO.md`](../TODO.md).
