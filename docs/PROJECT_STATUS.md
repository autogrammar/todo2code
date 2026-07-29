# Aktualny stan projektu

Stan na **2026-07-29**, wersja runtime `0.4.0`, baza `5c1c16b`
(`main` równy `origin/main` przed wdrożeniem deduplikacji propozycji).

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
                              (audytowane API LLM)
```

Istnieją już rygorystyczne kontrakty wyjściowe `t2c.conclusion/v1` i
`t2c.todo-proposal/v1`, lecz nie istnieje jeszcze pełna ścieżka wykonawcza
`DSL2TODO`. Sekcja „Następne
działania” w `team-summary.md` jest projekcją pola `suggestedAction` z
diagnostyki albo narracją LLM. Nie jest walidowanym DSL zadań, nie wykonuje
deduplikacji z istniejącym `TODO.md` i nie generuje zatwierdzalnego
`TODO.patch`.

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
| Analiza uczestników i rozbieżności komunikacji | działa jako osobne CLI/MCP/A2A | grupuje każdego człowieka/agenta i porównuje request/plan/claim z Git/AST; nie jest jeszcze częścią głównego pipeline run-history |
| Linker i walidacja grafu | działa | pełna walidacja `t2c.intent/v1` i `t2c.graph/v1`, stabilny fingerprint |
| Diagnostyka i Intent vs Reality | działa | wynik jest deterministyczny, ale AST może dominować liczbę tematów i ostrzeżeń |
| Graf → raport NL | działa | LLM ma ograniczony payload; bez modelu powstaje jawnie oznaczony raport deterministyczny |
| Kontrakty wniosków i zadań DSL | działa | JSON Schema, typy, stabilne ID, walidacja cytowań względem konkretnego grafu/raportu i jawna provenance LLM/fallback |
| DSL/diagnostyka → zadania DSL | działa jako API biblioteki | audytowana synteza OpenRouter, walidacja, deduplikacja z TODO, priority i acykliczne zależności; `require-llm` nie fallbackuje |
| Zadania DSL → `TODO.patch` | brak | planowana walidacja, deduplikacja i bramka akceptacji człowieka |

## Bieżąca walidacja

`npm run verify` zakończyło się powodzeniem:

- 135 testów: 134 zaliczone, 0 błędów, 1 pominięty test Java bez lokalnego JDK;
- 46 modułów i 234 importy wewnętrzne: brak cykli, niezależny `src/core`;
- 9 deterministycznych entrypointów i 17 modułów bez tranzytywnego importu LLM;
- 57 zmiennych używanych przez kod/Docker i 57 odpowiadających kluczy
  `.env.example`, bez duplikatów;
- kompilacja TypeScript `strict` i pełna walidacja runtime DSL zakończone
  powodzeniem.

Przebieg offline na `examples/` dla commita `5c1c16b` utworzył 202 rekordy i
616 relacji. Liczba relacji jest snapshotem, ponieważ wejście Git obejmuje
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

1. Synteza `DSL2TODO` działa jako API biblioteki z deduplikacją, ale nie ma
   jeszcze renderera `TODO.patch`, bramki akceptacji ani ekspozycji przez
   CLI/MCP/A2A/SDK.
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
7. Analiza komunikacji ma obecnie deterministyczny parser. Semantyczna synteza
   per uczestnik przez LLM oraz włączenie wyników do głównej historii runów
   pozostają zaplanowane.

## Plan docelowego DSL2TODO

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

Każda propozycja powinna zawierać źródłowe ID diagnostyk i rekordów, zakres
plików/symboli, kryteria akceptacji, priorytet, zależności, confidence oraz
pełny audyt modelu i wersji runtime. LLM może syntetyzować i dzielić zadania,
ale nie może usuwać dowodów ani bez zatwierdzenia modyfikować `TODO.md`.

Szczegółowy, uporządkowany backlog znajduje się w [`TODO.md`](../TODO.md).
