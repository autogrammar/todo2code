# Raport z testów i poprawek

Data wykonania: **2026-07-30**. Runtime: **0.5.0**. Baza robocza:
zweryfikowany `main` na `667eed2`. Środowisko: Linux,
Node.js 20.19.5, Python 3.13.12, Go 1.24.4, Rust 1.93.0 i Docker 29.1.3.
Lokalnie nie ma JDK; adapter Java jest wymagany w osobnym jobie CI z Temurin
17.

Wszystkie poniższe wyniki pochodzą z ponownego uruchomienia poleceń po
poprawkach, a nie ze starszych snapshotów dokumentacji.

## Wynik zbiorczy

| Obszar | Polecenie | Wynik |
|---|---|---|
| Pełna walidacja | `npm run verify` | PASS |
| Testy | `npm test` | 166 testów: 165 pass, 0 fail, 1 Java skip |
| Granica LLM | `npm run verify:no-llm` | PASS — 9 entrypointów, 21 modułów |
| Moduły | `npm run verify:modules` | PASS — 70 modułów, 331 importów, 0 cykli |
| Kontrakt środowiska | `npm run verify:env` | PASS — 59 zmiennych i 59 kluczy |
| Gold benchmark | `npm run evaluate:gold` | 100% precision/recall i 100% stabilności |
| Przykłady | `npm run examples:check` | PASS — wszystkie 5 SDK |
| CLI/MCP/A2A | `make smoke && make protocol-smoke` | PASS |
| Docker | `make docker-smoke` | PASS — build, `/healthz`, `doctor` |
| Wheel Pythona | `make python-wheel` | PASS |
| Zależności produkcyjne | `npm audit --omit=dev` | 0 podatności |
| Live OpenRouter summary | `t2c summarize … --mode require-llm` | PASS — 4 zwalidowane wnioski, bez fallbacku |

Jedyny pominięty test dotyczy adaptera Java i wynika z braku lokalnego JDK.
CI ustawia `T2C_REQUIRE_JAVA_TEST=1` w jobie Temurin 17, więc brak toolchainu
lub regresja adaptera nie mogą tam zostać pominięte.

## Przykłady

Końcowy przebieg `examples:check`:

```text
demo: 217 records, 113 relations; communication: 3 blocking, 1 warning
rejected event: agent is required
backend/frontend: strict compilation and HTTP integration passed
SDK examples: 5 languages, shared fingerprint 2347bea85da3d537
SDK DSL2TODO: shared proposal IDs, duplicates and patch fingerprint 629104a5497b520f
examples check: PASS
```

Pięć SDK — TypeScript, Python, Go, Rust i PHP — zgadza się co do fingerprintu
grafu, propozycji, klasyfikacji duplikatów oraz renderowanego patcha. Backend i
frontend przechodzą kompilację strict oraz test HTTP, a niepoprawne zdarzenie
jest odrzucane.

## Zweryfikowane poprawki

### Live LLM summary

Surowa odpowiedź providera jest sprawdzana przed odczytaniem pól i przed
utworzeniem semantycznego ID. Testy regresyjne pokrywają brak `title` oraz
całkowicie błędną kopertę `{conclusion,status}` i wymagają komunikatu
wskazującego konkretne pole zamiast wyjątku `reading 'trim'`.

Prompt wymienia pełny, siedmiopolowy kontrakt, rozdziela `title` i `detail`
oraz wymaga kopiowania `diagnosticIds` i `recordIds` dokładnie z wejścia.
Rzeczywisty OpenRouter w trybie `require-llm` zwrócił 4 poprawne obiekty
`t2c.conclusion/v1`; runtime zwalidował ich cytowania i wyrenderował raport bez
degradacji.

### Watch

`t2c watch` rozpoznaje istniejący `TASK.md` bez jawnego `--task`, obsługuje
`--task none` oraz przekazuje `--no-summary-llm`. Test integracyjny uruchamia
watch na żywym repozytorium Git, potwierdza rekord NL z domyślnego `TASK.md`,
zmienia plik źródłowy i czeka na drugi ukończony run.

### Bezpieczny output compare-workspace

`compare-workspace --out` normalizuje ścieżkę przez wspólną ochronę
`T2C_ROOT`. Absolutna ścieżka poza rootem i traversal są odrzucane, a test
potwierdza, że poza repozytorium nie powstaje żaden katalog.

### Intent vs Reality offline

Temat mający deklarację i obserwowany kod otrzymuje status `aligned` również
bez rekordów dokumentacyjnych. Pokrycie dokumentacji pozostaje osobną metryką,
a `IMPLEMENTED_NOT_DOCUMENTED` nadal jest widocznym diagnostykiem — brak
ekstraktora LLM nie fałszuje już samego statusu implementacji.

### Agregacja i szum AST

Każdy obsługiwany język emituje agregat modułu. Relacje oparte wyłącznie na
wspólnej ścieżce łączą intencję z agregatem, a nie z każdym wywołaniem w pliku;
AST↔AST pozostaje dozwolone dla rzeczywistych wspólnych deklaracji symbolu.

Pomiar pełnego repozytorium po poprawce:

| Metryka | Przed | Po |
|---|---:|---:|
| Wszystkie relacje | 294 067 | 2 370 |
| Relacje AST↔AST | 290 965 (98,9%) | 258 (10,9%) |
| Rekordy | 10 902 | 10 210 |
| Relacje AST↔TODO | 0 | 1 |

W demo liczba rekordów wynosi 217, a relacji spadła z 591 do 113; istnieją 3
relacje AST↔TODO. Zmiana usuwa ponad 99,9% wcześniejszych relacji AST↔AST w
pełnym repozytorium bez usuwania niskopoziomowych faktów dowodowych.

### Pozostałe naprawy

- TODO i CHANGELOG zachowują wieloliniowe elementy oraz pełny zakres źródła.
- AST respektuje ignore files i twardo wyklucza środowiska/vendor/build output.
- Alternacje prozatorskie, np. `backend/frontend`, nie są traktowane jako
  ścieżki, a prawdziwe ścieżki repozytorium pozostają rozpoznawane.
- `make validate` i CI wykonują automatyczny test dymny obrazu Docker.
- SVG Intent-vs-Reality dopasowuje kolumny i liczniki do zawartości.
- `examples:check` czyści własne artefakty, więc kolejne uruchomienia są
  powtarzalne.

## Gold benchmark

Wersjonowany `t2c.gold-dataset/v1` osiąga:

- 100% precision i recall ekstrakcji (7/7),
- 100% precision i recall linkowania (3/3),
- 100% kompletności cytowań (14/14),
- 100% poprawności deduplikacji DSL2TODO,
- 100% stabilności dwóch kolejnych przebiegów.

## Reprodukcja

```bash
npm run verify
npm run evaluate:gold
npm run examples:check
make smoke
make protocol-smoke
make docker-smoke
make python-wheel
npm audit --omit=dev
```
