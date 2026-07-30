# Aktualny stan projektu

Stan na **2026-07-30**, wersja runtime `0.5.0`.

## Ocena wykonania przepływu

Aktualny runtime realizuje kompletną ścieżkę wejściową i analityczną:

```text
NL / Git / AST / TODO / CHANGELOG / dokumentacja / konfiguracja i CI
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
„Następne działania” w `team-summary.md` jest projekcją zwalidowanych wniosków
`t2c.conclusion/v1`, ale nadal nie zastępuje walidowanych propozycji DSL2TODO.

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
| Java AST → DSL | działa, wymagane w CI | lokalnie fixture może być pominięty bez JDK; osobny job Temurin 17 ustawia `T2C_REQUIRE_JAVA_TEST=1`, więc brak runtime lub regresja kończy CI błędem |
| TODO → DSL | działa | osobny parser; checkbox i lifecycle pozostają deterministyczne |
| CHANGELOG → DSL | działa | osobny parser; zachowuje wersję, datę, kategorię i klasę `claim` |
| TODO/CHANGELOG + LLM | działa kontraktowo w porcjach | maksymalnie 32 rekordy na żądanie, stabilna kolejność, wspólny audyt i provenance odpowiedzi per rekord; porównanie live kosztu/latencji dwóch modeli pozostaje otwarte |
| Dokumentacja → DSL | działa offline i opcjonalnie przez LLM | deterministyczny baseline obejmuje nagłówki, bloki kodu i jawne odwołania; chunking, budżet i structured output opcjonalnego wzbogacenia LLM są testowane |
| Konfiguracja i infrastruktura → DSL | działa offline | struktury JSON/YAML/TOML, Dockerfile, Compose i workflow CI są dostępne przez pipeline, CLI, MCP, A2A i pięć SDK; `.github/workflows/` jest jawnie wyłączone z ogólnego ignorowania dot-katalogów; każdy plik ma jeden `configuration_file_fact`, który wiąże się przez jawną ścieżkę bez ogólnych dopasowań tematów |
| `project/<ticket>/` komunikacja → DSL | działa | zachowuje uczestnika, `human|agent`, typ wypowiedzi, ticket i aliasy Git jako `agent_log`; root-level `project/` pozostaje przestrzenią analizy technicznej i nie jest interpretowany jako rozmowa |
| Analiza uczestników i rozbieżności komunikacji | działa w pipeline/CLI/MCP/A2A/history/UI/watch | grupuje każdego człowieka/agenta, porównuje request/plan/claim z Git/AST, zapisuje artefakty i wspiera filtry participant/role/ticket/severity |
| Audytowane wzbogacanie komunikacji | działa opt-in | structured OpenRouter + synteza per uczestnik z cytowaniami; identity/role/ticket/source/epistemic class należą do runtime; deterministic/prefer/require mają jawny audyt |
| Rejestr tożsamości uczestników | działa | `t2c.participant-registry/v1` mapuje dokładne stable ID na Git authors, A2A IDs i human aliases; duplikaty/konflikty/nieznane ID są odrzucane bez zgadywania display name |
| Linker i walidacja grafu | działa | pełna walidacja `t2c.intent/v1` i `t2c.graph/v1`, stabilny fingerprint |
| Provenance rekordów DSL | działa | każdy rekord wymaga generatora i jego wersji, wersji todo2code oraz — dla LLM — providera, rozstrzygniętego modelu i response ID; niespójne rekordy są odrzucane |
| Generowana analiza techniczna | działa fail-closed | `project.sh` domyślnie analizuje wyłącznie detached snapshot śledzonego `HEAD`; standardowa walidacja odrzuca odniesienia do nieśledzonych wejść, ścieżki tymczasowe i niedostępne parsery, a `prefact -a` jest opt-in |
| Przenośność między repozytoriami | zweryfikowana na 6 projektach | batch 1: `code2llm`, `domd`, `pactfix`; batch 2: `code2logic`, `code2docs`, `redup` — wszystkie `succeeded` offline z plan/review/source-patch stage; plany powstają tylko przy `target.paths` |
| Diagnostyka i Intent vs Reality | działa | agregaty modułów i plików konfiguracji ograniczają szum; AST/Git/konfiguracja są obserwowaną rzeczywistością, `aligned` wymaga także deklaracji, a pokrycie dokumentacji jest osobną metryką |
| Trend workspace | działa stabilnie | nagłówek trendu opiera się na pokryciu deklarowanych tematów, porównywalnej dokumentacji i ciężkich diagnostykach; churn linii i rekordów AST pozostaje metryką pomocniczą |
| Graf → wnioski → raport NL | działa także live | CLI ma jawne `deterministic|prefer-llm|require-llm`; generator v2 ogranicza `recordIds` do dowodów cytowanych diagnostyk, nieznane diagnostyki są odrzucane, a bieżący `live:check` przeszedł bez retry i fallbacku |
| Zaplanowana kontrola live OpenRouter | działa opt-in | osobny job sprawdza NL i summary w `require-llm`, egzekwuje budżet latencji/kosztu i publikuje tylko zredagowany audyt; wymagane CI pozostaje offline |
| Pełne `make demollm` | działa live, fail-closed | zweryfikowany run `20260730T185205Z-312a0535`: NL, Markdown, dokumentacja, komunikacja, synteza zadań i summary mają `succeeded / llm / degraded=false`; task i summary używają generatora v2, a końcowa bramka odrzuca brak metadanych lub degradację |
| Kontrakty wniosków i zadań DSL | działa | JSON Schema, typy, stabilne ID, walidacja cytowań względem konkretnego grafu/raportu i jawna provenance LLM/fallback |
| DSL/diagnostyka → zadania DSL | działa we wszystkich interfejsach | audytowana synteza OpenRouter, walidacja, deduplikacja z TODO, priority i acykliczne zależności; `require-llm` nie fallbackuje |
| Diagnostyka → plan + review/source-patch | działa w pipeline/CLI/MCP/A2A/SDK | `code-change-plans.json`, hash-bound review oraz `code-change-source-patches.json`; cele są ograniczone do konkretnych plików (bez vendoringu, binariów, dumpów, katalogów, globów i artefaktów runu); brak auto-apply, a osobne apply wymaga kompletnego diffu, aktora i `patchHash`, wykonuje preflight/rollback oraz zapisuje receipt z provenance |
| Re-analiza → acceptance | działa w CLI/MCP/A2A/SDK TypeScript | `t2c.code-change-acceptance/v1` wymaga zniknięcia targeted diagnostics i braku nowych blocking; `close-code-change` ocenia plan lub plan-set w jednym kroku i zwraca `t2c.code-change-close-result/v1` z runtime-owned provenance, bez auto-DONE |
| Zadania DSL → `TODO.patch` | działa we wszystkich interfejsach | stabilny renderer i JSON audit, jawna zgoda hasha, ochrona stale/tampering, atomowe/idempotentne apply z receiptem i rejestracją w run history |
| Intent → proposal operacji Subactor | działa kontraktowo | `t2c.variable-contract/v1` i `t2c.operation-plan/v1` mają content-bound ID/hash, walidację authority/risk/rollback; prywatny bridge zapisuje atomowo wyłącznie `subactor.process-envelope.v2`, odmawia nadpisania i nie dispatchuje procesu |

## Bieżąca walidacja

`npm run verify` zakończyło się powodzeniem:

- 232 testy: 231 zaliczonych, 0 błędów, 1 pominięty test Java bez lokalnego JDK;
- 93 moduły i 426 importów wewnętrznych, brak cykli, niezależny `src/core`;
- 9 deterministycznych entrypointów i 30 modułów bez tranzytywnego importu LLM;
- 63 zmienne używane przez kod/Docker i 63 odpowiadające klucze
  `.env.example`, bez duplikatów;
- workflow CI przechodzi kontrolę duplikatów kluczy najwyższego poziomu;
- kompilacja TypeScript `strict` i pełna walidacja runtime DSL zakończone
  powodzeniem.

Przebieg offline na `examples/` utworzył 227 rekordów i 92 relacje. Liczba
relacji jest snapshotem, ponieważ wejście Git obejmuje
ostatnich 10 commitów:

| Źródło | Rekordy |
|---|---:|
| AST | 190 |
| Git | 10 |
| NL | 7 |
| agent_log | 5 |
| TODO | 3 |
| CHANGELOG | 2 |
| dokumentacja | 4 |
| konfiguracja (`system`) | 6 |

Diagnostyka zawierała 3 blokady komunikacyjne, 7 pozycji `review_required`,
64 ostrzeżenia i 38 informacji. Bieżące `make demo` jawnie wyłącza LLM dokumentacji i
podsumowania, dzięki czemu stan runu jest `succeeded` i nie zależy od sieci ani
prywatnego `.env`. Nie jest to jednak dowód jakości semantycznej LLM.

Wersjonowany `t2c.gold-dataset/v1` mierzy jakość semantyczną offline na
niezależnych oczekiwaniach dla NL, zapisanej odpowiedzi modelu dokumentacji,
TODO/CHANGELOG, linkowania i DSL2TODO. Zbiór obejmuje 9 oczekiwanych rekordów
DSL, 7 relacji (6 exact-target i 1 capability-topic), hard negatives oraz 2
propozycje TODO. Bieżący wynik to 100% precision/recall dla ekstrakcji i obu
klas linkowania bez naruszenia hard-negative, 100% kompletności cytowań, 100% precision/recall
klasyfikacji duplikatów, 50% propozycji sklasyfikowanych jako duplikaty oraz
100% stabilności między dwoma przebiegami. Snapshot dokumentacyjny sprawdza
runtime repair i provenance, ale celowo nie jest pomiarem jakości żywego modelu.

## Najważniejsze ograniczenia

1. Pipeline tworzy patch do review, ale celowo nie może go sam zatwierdzić;
   approval pozostaje osobną operacją człowieka lub uprawnionego klienta.
2. Agregaty modułów ograniczają relacje i prezentację niskopoziomowych faktów
   AST, a deklaracje mogą łączyć się z nimi przez trzy wspólne, znormalizowane
   tematy możliwości. Jakość tej heurystyki wymaga jeszcze szerszego gold
   datasetu z trudnymi przypadkami negatywnymi.
3. Wzbogacanie TODO/CHANGELOG jest już porcjowane, ale pomiar live kosztu i
   latencji dla modelu domyślnego i szybszego wariantu nie został jeszcze
   wykonany w sposób nadający się do publikacji.
4. Adaptery językowe są rozdzielone na osobne moduły za małym orkiestratorem
   `src/extractors/ast.ts`; nadal nie mają osobnych paczek ani niezależnego
   versioningu release'ów.
5. Deterministyczna dokumentacja i konfiguracja mają już własne konwertery.
   PHP oraz pozostałe języki spoza TypeScript/JavaScript, Python, Go, Java i
   Rust nadal nie mają adapterów AST; runtime wypisuje ich liczby jawnie.
6. Starsze repozytoria bez `project/participants.json` działają w trybie
   legacy; dopiero dodanie rejestru wymusza stabilne `participant-id` i wyłącza
   traktowanie nazwy wyświetlanej jako rozstrzygniętej tożsamości.
7. Nadal otwarte są cache przyrostowe AST/dokumentacji, generowanie validatorów
   z jednego schematu, structured codegen/patch z LLM oraz A2A streaming ze
   współdzielonym transakcyjnym task store. Bare basename i prescriptive docs
   są już w linkerze/diagnostyce; plan `t2c.code-change-plan/v1` domyka
   ugruntowany most do review zmian kodu; deterministyczna propozycja pozostaje
   instruction-only, dopóki caller nie dostarczy kompletnego unified diffu.

Ostatni deterministyczny audyt własnego repozytorium
`20260730T202349Z-9bd483a1` zakończył się powodzeniem i nie wygenerował żadnego
planu zmiany kodu. Wcześniejsze dziewięć kandydatów zredukowano kolejno przez
filtrowanie ścieżek, właściwe dowody CI/dokumentacji i jawny kontrakt
przestrzeni nazw `project/`.

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
