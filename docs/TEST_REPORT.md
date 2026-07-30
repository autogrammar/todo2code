# Raport z testów i poprawek

Data wykonania: **2026-07-30**. Runtime: **0.5.0**. Baza robocza:
zweryfikowany `main` na `e0f33ba` (`chore: relicense project under
Apache-2.0`) wraz z opisanymi niżej zmianami roboczymi. Środowisko: Linux,
Node.js 20.19.5, Python 3.13.12, Go 1.24.4, Rust 1.93.0 i Docker 29.1.3.
Lokalnie nie ma JDK; adapter Java jest wymagany w osobnym jobie CI z Temurin
17.

Wszystkie poniższe wyniki pochodzą z ponownego uruchomienia poleceń po
poprawkach, a nie ze starszych snapshotów dokumentacji.

## Wynik zbiorczy

| Obszar | Polecenie | Wynik |
|---|---|---|
| Pełna walidacja | `npm run verify` | PASS |
| Testy | `npm test` | 172 testy: 171 pass, 0 fail, 1 Java skip |
| Granica LLM | `npm run verify:no-llm` | PASS — 9 entrypointów, 22 moduły |
| Moduły | `npm run verify:modules` | PASS — 71 modułów, 333 importy, 0 cykli |
| Kontrakt środowiska | `npm run verify:env` | PASS — 63 zmienne i 63 klucze |
| Gold benchmark | `npm run evaluate:gold` | 100% precision/recall i 100% stabilności |
| Przykłady | `npm run examples:check` | PASS — wszystkie 5 SDK |
| CLI/MCP/A2A | `make smoke && make protocol-smoke` | PASS |
| Docker | `make docker-smoke` | PASS — build, `/healthz`, `doctor` |
| Wheel Pythona | `make python-wheel` | PASS |
| Zależności produkcyjne | `npm audit --omit=dev` | 0 podatności |
| Live OpenRouter summary | `t2c summarize … --mode require-llm` | PASS — zwalidowane wnioski, bez fallbacku (3/4 prób; jedyna porażka to HTTP 429) |
| Zaplanowany kontrakt live | `npm run live:check` | PASS/SKIP — NL i summary w `require-llm`, redacted audit i budżety; bez klucza kontrolowany skip |

Jedyny pominięty test dotyczy adaptera Java i wynika z braku lokalnego JDK.
CI ustawia `T2C_REQUIRE_JAVA_TEST=1` w jobie Temurin 17, więc brak toolchainu
lub regresja adaptera nie mogą tam zostać pominięte.

## Przykłady

Końcowy przebieg `examples:check`:

```text
demo: 217 records, 99 relations; communication: 3 blocking, 1 warning
rejected event: agent is required
backend/frontend: strict compilation and HTTP integration passed
SDK examples: 5 languages, shared fingerprint da0f200c2eacded3
SDK DSL2TODO: shared proposal IDs, duplicates and patch fingerprint 252df1d273c95fee
examples check: PASS
```

Pięć SDK — TypeScript, Python, Go, Rust i PHP — zgadza się co do fingerprintu
grafu, propozycji, klasyfikacji duplikatów oraz renderowanego patcha. Backend i
frontend przechodzą kompilację strict oraz test HTTP, a niepoprawne zdarzenie
jest odrzucane.

Istotna jest **zgodność wszystkich pięciu SDK w obrębie jednego przebiegu**, nie
konkretna wartość: fingerprint jest funkcją stanu kodu i zmienia się przy każdej
modyfikacji ekstrakcji lub linkowania.

## Zweryfikowane poprawki

### Live LLM summary

Surowa odpowiedź providera jest sprawdzana przed odczytaniem pól i przed
utworzeniem semantycznego ID. Testy regresyjne pokrywają brak `title` oraz
całkowicie błędną kopertę `{conclusion,status}` i wymagają komunikatu
wskazującego konkretne pole zamiast wyjątku `reading 'trim'`.

Prompt wymienia pełny, siedmiopolowy kontrakt, rozdziela `title` i `detail`
oraz wymaga kopiowania `diagnosticIds` i `recordIds` dokładnie z wejścia.
Rzeczywisty OpenRouter w trybie `require-llm` zwraca poprawne obiekty
`t2c.conclusion/v1`; runtime waliduje ich cytowania i renderuje raport bez
degradacji. Zmierzona niezawodność: **3 z 4 prób**, przy czym jedyna porażka to
`HTTP 429` po serii wywołań diagnostycznych, a nie naruszenie kontraktu. Przed
poprawką **każda** próba kończyła się fallbackiem.

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

Agregaty zawierają teraz również ograniczoną, deterministycznie uporządkowaną
listę deklarowanych możliwości modułu. Linker normalizuje formy takie jak
`documentation`/`docs` → `document` i `validation`/`validator` → `validate`,
ale tworzy relację tematyczną dopiero przy co najmniej trzech wspólnych
tematach. Próba z progiem dwóch tematów utworzyła setki przypadkowych relacji,
dlatego nie została przyjęta.

Pomiar pełnego repozytorium:

| Metryka | Stary linker | Granica modułu | Tematy możliwości | Stan końcowy z nowym TODO/CHANGELOG |
|---|---:|---:|---:|---:|
| Wszystkie relacje | 294 067 | 3 475 | 3 560 | 4 041 |
| Relacje AST↔AST | 290 965 | 617 | 617 | 647 |
| Rekordy | 10 902 | 11 885 | 11 951 | 12 194 |
| Relacje AST↔TODO | 0 | 1 | 71 | 203 |
| Relacje AST↔NL | 0 | 0 | 10 | 11 |

Kontrolowane porównanie „Granica modułu" → „Tematy możliwości" wykonano przed
edycją backlogu; ostatnia kolumna obejmuje nowe, jawnie zapisane deklaracje z
`TODO.md` i `CHANGELOG.md`. W stanie końcowym 190 relacji ma podstawę
`module_topic:*` (176 AST↔TODO, 11 AST↔NL i 3 AST↔CHANGELOG). Kontrolowany
pomiar linkera utrzymał AST↔AST na 617; bieżące 647 wynika z nowych modułów i
faktów dodanych do analizowanego kodu, a nie z relacji `module_topic`. W demo
jest 217 rekordów i 99 relacji.

### Ekstrakcja ścieżek i metryka dokumentacji

`target.paths` przyjmuje wyłącznie kandydatów z rozpoznanym rozszerzeniem albo
z konwencjonalnym katalogiem głównym. Dotowane odwołania do pól kontraktu
trafiają do `target.symbols`. Liczba kandydatów z `TODO.md` i `CHANGELOG.md`
spadła z 81 do 16, bez ani jednego fragmentu prozy.

`IntentRealityView.totals.documentationMeasured` odróżnia „0% udokumentowanego
kodu" od „dokumentacja nie była w ogóle ekstrahowana". Widok Intent vs Reality
i porównanie workspace renderują ten drugi przypadek jawnie.

### Obowiązkowa provenance każdego rekordu DSL

Każde wywołanie centralnego `buildRecord` materializuje kompletne
`metadata.generation`. Dla konwertera deterministycznego są to: nazwa
generatora, jego wersja, wersja todo2code, requested/used mode oraz jawne
wartości `null` dla providera, modelu i odpowiedzi. Dla LLM runtime zapisuje
providera, model rozstrzygnięty przez odpowiedź (z kontrolowanym fallbackiem do
konfiguracji) oraz `responseId`. Degradacja LLM → parser deterministyczny wymaga
`requested=llm`, `used=deterministic`, `degraded=true` i niepustej przyczyny.

Runtime validator oraz `schemas/intent-record.schema.json` odrzucają brak
koperty, brak modelu/providera dla LLM i próbę przypisania modelu rekordowi
deterministycznemu. Typy lub bezpieczne akcesory udostępniają ją także SDK
TypeScript, Python, Go i Rust.

Wynikowe kontrakty `t2c.conclusion/v1`, `t2c.todo-proposal/v1` oraz
`t2c.participant-synthesis/v1` stosują tę samą zasadę: ich `generation` wymaga
nazwy i wersji generatora todo2code, wersji runtime oraz pełnej provenance LLM
albo deterministycznego fallbacku. Schematy i validator odrzucają anonimowy
generator również poza rekordami Intent DSL.

Audyt własnego repozytorium potwierdził **12 194/12 194** rekordów z provenance,
0 brakujących kopert i 0 rekordów z wersją runtime inną niż `0.5.0`. W przebiegu
offline wszystkie miały `used=deterministic`; testy stubowanych odpowiedzi
pokrywają rozstrzygnięty model/provider/response ID dla NL i dokumentacji.

To jest świadome zaostrzenie `t2c.intent/v1`: historyczny rekord bez
`metadata.generation` nie przejdzie już ścisłej walidacji i powinien zostać
ponownie wygenerowany aktualnym runtime'em.

### Samoanaliza wykonana przez todo2code

Po aktualizacji kodu, `TODO.md` i `CHANGELOG.md` uruchomiono deterministyczny
pipeline samego todo2code z wyłączonymi etapami sieciowymi. Run
`20260730T135945Z-3c956ead` zakończył się statusem `succeeded` i utworzył graf
o fingerprintcie `d0c33d2c3e31f5f8`:

- 12 194 rekordy i 4 041 relacji,
- 10 rekordów NL, 24 TODO, 125 CHANGELOG, 37 komunikacji, 10 Git i 11 988 AST,
- 0 rekordów `document`, jawnie oznaczone jako etap `skipped`,
- 3 diagnostyki blocking, 103 review-required, 781 warning i 461 info,
- 195 tematów: 4 aligned i 191 divergent; implementation coverage 21,1%,
  planned code 2,6%, a dokumentacja jawnie `not measured`,
- deterministyczne podsumowanie 100 zwalidowanych wniosków.

Run potwierdził też realny brak: bez sieci wszystkie skonfigurowane źródła
pipeline'u poza dokumentacją są konwertowane do DSL, natomiast dokumentacja
nie ma jeszcze deterministycznego konwertera. Nie oznacza to obsługi każdego
formatu pliku w repozytorium — jej granice opisuje punkt 4.

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
- 100% precision i recall linkowania exact-target (3/3),
- 100% precision i recall capability-topic (1/1) oraz 0 naruszeń hard-negative,
- 100% kompletności cytowań (14/14),
- 100% poprawności deduplikacji DSL2TODO,
- 100% stabilności dwóch kolejnych przebiegów.

## Co nadal wymaga dopracowania

Uporządkowane wedle wpływu. Każda pozycja ma pomiar z tego przebiegu.

### 1. Dopasowanie tematyczne wymaga szerszego benchmarku jakości

Pierwszy etap został wykonany: relacje AST↔NL wzrosły z 0 do **11**, a AST↔TODO
z 1 do **203** w ostatnim pomiarze (kontrolowany pomiar samej zmiany dawał
odpowiednio 10 i 71). W kontrolowanym pomiarze
linkera AST↔AST pozostało na 617; obecne 647 wynika z rozbudowy kodu. Fałszywe
`PLANNED_NOT_IMPLEMENTED` spadły przy tym z 40 do **4**. Przegląd próbek
potwierdził trafne powiązania m.in. dla adapterów Java/Rust, budżetu
dokumentacji i walidacji kontraktów. Nie jest to jednak jeszcze dowód jakości
na wielu repozytoriach.

Wartości bezwzględne pokrycia pozostają niskie i warto je czytać ostrożnie: na
pełnym repozytorium `implementation coverage` wynosi **21,1%**, `planned code`
**2,6%**, a `aligned` **4 z 195 tematów**. Raport nie odróżnia dziś dwóch
przyczyn niskiego `planned code` — braku dopasowania w linkerze od faktycznego
braku deklaracji dla większości modułów.

Gold benchmark rozdziela już exact-target od `module_topic` i zawiera pierwszy
pozytywny przypadek prose-to-module oraz hard negative poniżej progu. To usuwa
największą lukę testową, ale jedna para pozytywna nadal nie dowodzi jakości na
wielu repozytoriach; przed rozszerzaniem aliasów zbiór powinien dalej rosnąć.

### 2. Deterministyczne źródło rekordów `document` nadal nie istnieje

Metryka nie kłamie już w raportach: `IntentRealityView.totals` niesie
`documentationMeasured`, a widok Intent vs Reality i porównanie workspace
wypisują „not measured (no documentation records in this run)" zamiast
mylącego `0.0%`. Status `aligned` jest od dokumentacji odcięty.

Otwarta pozostaje przyczyna: rekordy `document` powstają **wyłącznie** przez
ekstraktor LLM, więc każdy przebieg offline — w tym `make demo` i
`examples:check` — nie mierzy dokumentacji w ogóle. Potrzebne jest
deterministyczne źródło (nagłówki, bloki kodu, odsyłacze do plików), żeby ta
oś była użyteczna bez klucza.

### 3. Ścieżka live LLM pozostaje kontrolą opt-in

Gold benchmark nadal buduje wnioski deterministycznie z fikstur i nie zależy od
sieci. Osobny job harmonogramu/`workflow_dispatch` uruchamia
`npm run live:check`: sprawdza NL → Intent DSL i graf → uziemione wnioski w
`require-llm`, więc fallback nie może ukryć złamanego kontraktu. Artefakt
`t2c.live-contract-check/v1` zawiera tylko provider/model, tokeny, koszt,
latencję i zredagowany błąd; limity kosztu i czasu są konfigurowalne. Brak
sekretu jawnie pomija job live i nigdy nie blokuje wymaganej walidacji offline.
Historycznie ręczne próby summary osiągnęły **3/4**, a jedyną porażką było
`HTTP 429`, nie naruszenie struktury.

### 4. Nie wszystkie formaty repozytorium mają własny konwerter DSL

Kod TypeScript/JavaScript, Python, Go, Java i Rust ma adaptery AST. PHP — mimo
że istnieje SDK PHP — oraz inne języki nie mają jeszcze adaptera. Pliki
konfiguracyjne JSON/YAML/TOML, Dockerfile i workflow CI są dziś widoczne tylko
pośrednio w Git, TODO/CHANGELOG lub dokumentacji; system nie interpretuje ich
deterministycznie jako deklaracji konfiguracji. Pipeline powinien raportować
liczbę pominiętych wspieranych i nieobsługiwanych plików, aby kompletność
code-to-DSL nie była domniemana.

### 5. Bare nazwy plików nie są rozwiązywane do katalogu

Ekstrakcja ścieżek na `TODO.md` + `CHANGELOG.md` tego repozytorium:

| | Kandydaci | Fragmenty prozy |
|---|--:|--:|
| Wyjściowo | 81 | 69 |
| Po regułach składniowych | 26 | 3 |
| Po allowliście rozszerzeń | **16** | **0** |

Referencje do pól DSL (`statement.object`, `epistemic.basis`,
`metadata.generation`) nie są już ścieżkami — trafiają do `target.symbols`,
czyli tam, gdzie należą. Alternacje prozatorskie zniknęły całkowicie.

Pozostaje jedno: bare nazwy typu `changelog.ts`, `todo.ts` czy `markdown.ts`
są zapisywane dosłownie, choć realnie leżą w `src/extractors/`. Dopóki nie są
rozwiązywane wobec drzewa repozytorium, nie połączą się z faktami AST z tych
plików. To jest wąskie i wprost powiązane z pozycją 1.

### 6. Adapter Java nie jest weryfikowany lokalnie

`npm test` pomija fixture Javy przy braku JDK. CI wymusza go przez
`T2C_REQUIRE_JAVA_TEST=1` w jobie Temurin 17 (`.github/workflows/ci.yml:34-40`),
więc regresja nie przejdzie do `main` — ale developer bez JDK nie zobaczy jej
przed pushem.

### 7. Pozostały backlog wydajnościowy i operacyjny

Otwarte pozostają: porcjowanie dużych TODO/CHANGELOG dla LLM, cache AST i
fragmentów dokumentacji, stabilniejsze trendy workspace, generowanie
walidatorów i schematów z jednego źródła, rozdzielenie adapterów językowych,
  A2A streaming ze współdzielonym transakcyjnym task store. Pełna lista z
  kryteriami znajduje się w `TODO.md`.

## Licencja

Zmiana licencji jest zakończona i znajduje się na `main` w commicie `e0f33ba`.
Główny plik licencji, README, wszystkie manifesty oraz pliki licencji SDK wskazują
`Apache-2.0`; pakiety i obraz produkcyjny nie deklarują już MIT.

## Reprodukcja

```bash
npm run verify
npm run evaluate:gold
npm run examples:check
OPENROUTER_API_KEY= npm run live:check
make smoke
make protocol-smoke
make docker-smoke
make python-wheel
npm audit --omit=dev
```
