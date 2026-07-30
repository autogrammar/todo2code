# Raport z testów i poprawek

Data wykonania: **2026-07-30**. Runtime: **0.5.0**. Baza robocza:
bieżący `main` wraz z opisanymi niżej poprawkami. Środowisko: Linux,
Node.js 20.19.5, Python 3.13.12, Go 1.24.4, Rust 1.93.0 i Docker 29.1.3.
Lokalnie nie ma JDK; adapter Java jest wymagany w osobnym jobie CI z Temurin
17.

Wszystkie poniższe wyniki pochodzą z ponownego uruchomienia poleceń po
poprawkach, a nie ze starszych snapshotów dokumentacji.

## Wynik zbiorczy

| Obszar | Polecenie | Wynik |
|---|---|---|
| Pełna walidacja | `npm run verify` | PASS |
| Testy | `npm test` | 227 testów: 226 pass, 0 fail, 1 Java skip |
| Granica LLM | `npm run verify:no-llm` | PASS — 9 entrypointów, 30 modułów |
| Moduły | `npm run verify:modules` | PASS — 93 moduły, 426 importów, 0 cykli |
| Kontrakt środowiska | `npm run verify:env` | PASS — 63 zmienne i 63 klucze |
| Workflow YAML | `npm run verify:workflows` | PASS — brak zduplikowanych kluczy najwyższego poziomu |
| Operation-plan DSL | `operation-plan.test.ts` | PASS — 9 testów kontraktu, authority, hasha, ryzyka, fail-closed bindingów i prywatnego artefaktu |
| Gold benchmark | `npm run evaluate:gold` | 100% precision/recall i 100% stabilności |
| Przykłady | `npm run examples:check` | PASS — wszystkie 5 SDK |
| CLI/MCP/A2A | `make smoke && make protocol-smoke` | PASS |
| Docker | `make docker-smoke` | PASS — build, `/healthz`, `doctor` |
| Wheel Pythona | `make python-wheel` | PASS |
| Zależności produkcyjne | `npm audit --omit=dev` | 0 podatności |
| Live OpenRouter summary | `npm run live:check` | PASS — generator v2, jedna odpowiedź, 22,6 s, 43 426 tokenów, $0.006251, bez fallbacku |
| Zaplanowany kontrakt live | `npm run live:check` | PASS/SKIP — NL i summary w `require-llm`, redacted audit i budżety; bez klucza kontrolowany skip |
| Pełny pipeline live | `make demollm` | PASS — 6/6 etapów `succeeded / llm / degraded=false`, bez fallbacku |
| Trzy zewnętrzne repozytoria (batch 1) | pipeline na `code2llm`, `domd`, `pactfix` | PASS — trzy kompletne manifesty |
| Trzy zewnętrzne repozytoria (batch 2) | pipeline na `code2logic`, `code2docs`, `redup` | PASS — trzy `succeeded`, code-change stage deterministic, review + source patches |

Jedyny pominięty test dotyczy adaptera Java i wynika z braku lokalnego JDK.
CI ustawia `T2C_REQUIRE_JAVA_TEST=1` w jobie Temurin 17, więc brak toolchainu
lub regresja adaptera nie mogą tam zostać pominięte.

## Walidacja na innych projektach

Pipeline uruchomiono deterministycznie na trzech rzeczywistych repozytoriach
z `~/github/semcod`, z artefaktami poza ich worktree:

| Repozytorium | Wynik | Rekordy grafu | Relacje | `PLANNED_NOT_IMPLEMENTED` | Plans / source patches | Komunikacja |
|---|---:|---:|---:|---:|---:|---:|
| `code2llm` | succeeded | 17 652 | 60 156 | 1 | 50 / 50 (limit runu) | 0, poprawnie pominięta |
| `domd` | succeeded | 23 276 | 247 869 | 1 942 | 50 / 50 (limit runu) | 0, poprawnie pominięta |
| `pactfix` | succeeded | 5 295 | 5 606 | 13 | 1 / 1 | 0, poprawnie pominięta |

### Batch 2 — `code2logic`, `code2docs`, `redup` (2026-07-30)

Deterministyczny pipeline offline (`--no-docs-llm --no-summary-llm
--no-communication --task-mode disabled`), artefakty w
`<repo>/.intent-t2c-semcod-batch/`. Przed uruchomieniem naprawiono składnię
`configuration.ts` (`??`/`||` bez nawiasów psuło build JS).

| Repozytorium | Wynik | Rekordy | Relacje | `PLANNED_NOT_IMPLEMENTED` | Plans / source patches | Uwagi |
|---|---:|---:|---:|---:|---:|---|
| `code2logic` | succeeded | 21 668 | 22 602 | 10→3* | 0 / 0 | *po poprawce `detectModality` (nagłówki „recommended”); pozostałe 3 to placeholdery TODO bez path |
| `code2docs` | succeeded | 6 960 | 40 290 | 0 | 50 / 50 (limit) | review + source-patch set z provenance |
| `redup` | succeeded | 7 803 | 28 523 | 7 | 50 / 50 (limit) | review + source-patch set z provenance |

We wszystkich trzech:
- `codeChangePlanning: succeeded / deterministic`;
- generatory `t2c/code-change-plan-set`, `t2c/code-change-review`,
  `t2c/code-change-source-patch-set`;
- `agent_log=0` przy `--no-communication`.
`code2logic` ostrzega o braku JDK (Java fixture) i 1 nieobsługiwanym pliku `.cs`.

Ponowny przebieg `code2llm` po dodaniu agregatów konfiguracji utworzył 5
`configuration_file_fact`. Pierwszy wariant, który dopuszczał ogólne
`module_topic`, dał 288 relacji międzyźródłowych (głównie z `pyproject.toml` i
`Makefile`) i został odrzucony. Wariant końcowy ma 2 relacje agregatów, obie
przez jawną wspólną ścieżkę `pyproject.toml`, oraz 0 relacji `system~system`.

Pierwszy przebieg na `domd` zgłosił `Python AST extraction failed: stdout
maxBuffer length exceeded`, ponieważ helper Python omijał repozytoryjne reguły
ignore i widział około 1906 plików zamiast wybranego przez todo2code zbioru.
Po poprawce helper otrzymuje dokładny, bezpiecznie ograniczony do root katalogu
manifest plików z tego samego matchera co pozostałe adaptery. Wszystkie trzy
repozytoria przeszły ponowny pipeline bez błędu Python AST.

Pierwszy przebieg błędnie utworzył 1146 rekordów komunikacji w `code2llm` i
1284 w `domd` z wygenerowanych plików typu `project/batch_1/context.md`. Po
zawężeniu detekcji oba repozytoria mają 0 takich rekordów i etap jest jawnie
`skipped / NO_COMMUNICATION_RECORDS`.

Zmiana klasyfikacji dokumentacji usunęła fałszywe plany opisowe. W
`code2llm` pozostał tylko 1 preskryptywny przypadek. Wysokie 1 942 na `domd`
nie pochodzi z opisowej dokumentacji: 1 941 wpisów to rzeczywiste, otwarte
checkboxy w jego `TODO.md`, a 1 to dokument o modalności `recommended`.

Po dodaniu automatycznego etapu `codeChangePlanning` wszystkie trzy pipeline'y
przeszły ponownie. Etap ma `succeeded / deterministic`, koperta plan-set używa
generatora `t2c/code-change-plan-set`, a każdy plan podaje runtime `0.5.0`.
`code2llm` i `domd` osiągnęły bezpieczny limit 50 planów; `pactfix` utworzył 1.
Każdy run zapisał również hash-bound `CODE_CHANGE.review.md`,
`t2c.code-change-review/v1` oraz tyle samo source patches co planów; koperta
patchy ma generator `t2c/code-change-source-patch-set`. Po
odrzuceniu nieinformatywnych par konfiguracja↔konfiguracja we wszystkich
trzech grafach pozostało 0 takich relacji; powiązania konfiguracji z AST,
dokumentacją lub wspólnym ticketem nadal są dozwolone i pokryte testami.

Pozostałe ostrzeżenia są oczekiwane i audytowalne: brak lokalnego JDK,
wykryte nieobsługiwane PHP/Ruby/C#, celowo niepoprawne fixture’y parserów oraz
cztery śledzone pliki JavaScript w `domd` przekraczające limit 524288 bajtów.

## Przykłady

Końcowy przebieg `examples:check`:

```text
demo: 227 records, 93 relations; communication: 3 blocking, 1 warning
rejected event: agent is required
backend/frontend: strict compilation and HTTP integration passed
SDK examples: 5 languages, shared fingerprint 2a1e0353460e6704
SDK DSL2TODO: shared proposal IDs, duplicates and patch fingerprint b279b1531823b0e9
examples check: PASS
```

### Metadane dokumentacji generowanej

`project.sh` uruchamia po `code2docs` deterministyczną synchronizację
`docs/README.md` z `package.json`. Test integracyjny potwierdza korektę wersji,
badge'a Node i Apache-2.0, względny link do `LICENSE`, idempotencję oraz
fail-closed przy zmianie szablonu generatora.

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
Rzeczywisty OpenRouter w trybie `require-llm` zwraca obiekty materializowane
jako `t2c.conclusion/v1`; runtime waliduje diagnostyki, ogranicza `recordIds`
do ich dowodów i renderuje raport bez degradacji. Bieżący `live:check` przeszedł
w jednej odpowiedzi summary (22,6 s, $0.006251). Nieznany `diagnosticId` nadal
jest odrzucany. Przed pierwszą poprawką każda próba kończyła się fallbackiem;
historyczne 429 pozostaje problemem dostępności providera, nie kontraktu.

### Pełny pipeline `demollm`

Run `20260730T185205Z-312a0535` przeszedł końcową kontrolę manifestu dla
wszystkich sześciu etapów LLM: NL, Markdown, dokumentacji, komunikacji,
syntezy zadań i summary. Każdy etap ma `status=succeeded`,
`effectiveMode=llm`, `degraded=false` i metadane odpowiedzi. Łączny zmierzony
koszt wyniósł około **$0.03602** (99 347 tokenów). Target nie zeruje klucza z `.env`, nie
wywołuje deterministycznego `make demo` i nie wyłącza dokumentacji ani summary.

Live run ujawnił odchylenia structured output providera: obiekt w polu NL
`text`, procentową pewność, skalarne listy, aliasy enumów, brak kryterium
akceptacji i niepoprawne powtórzone cytowania propozycji. Runtime normalizuje
wyłącznie równoważne reprezentacje, wyprowadza cytowania propozycji z
zatwierdzonych wniosków, a następnie nadal wykonuje pełną walidację grafu,
cytowań, zależności i kanonicznych kontraktów DSL.

Zgłoszone kolejne próby ujawniły dwie pozostałe niestabilności: summary
zmyślał `recordId`, a task synthesis zwracał pusty lokalny `proposal.key`.
Generator v2 ogranicza rekordy wniosku do rekordów należących do cytowanych
diagnostyk oraz nadaje brakujący klucz lokalny w runtime. Nieznany
`diagnosticId` nadal kończy `require-llm` błędem po jednej korekcie. Bieżące
`npm run live:check` i pełny run przeszły za pierwszym razem; task synthesis i
summary zapisały po jednej odpowiedzi, z pełną provenance i bez degradacji.

### Plan zmiany kodu i acceptance

`t2c.code-change-plan/v1` jest budowany deterministycznie tylko z diagnostyk
implementacyjnych mających konkretną ścieżkę. Runtime waliduje content-bound
ID/hash, cytowania, ograniczenie `changes[].path` do `target.paths`, risk,
rollback i provenance. `t2c.code-change-acceptance/v1` porównuje grafy przed i
po implementacji: wszystkie targeted diagnostics muszą zniknąć i nie może
pojawić się nowa blokada. Pozytywny wynik nadal nie ustawia `DONE`.

Siedemnaście testów obejmuje plan, brak zgadywania ścieżki, deterministyczność,
tampering, brak provenance, niespójny verdict, hash-bound review i source patch,
walidację path/akcji/sekretów, JSON Schema oraz pełny przebieg CLI wraz z
`close-code-change` oraz zatwierdzone `apply-source-patch` z preflightem,
ochroną symlinków, kontrolą stanu receipt i rollbackiem. MCP publikuje 26 narzędzi, A2A umiejętność
`review_code_changes`, a SDK TypeScript udostępnia propose, render,
source-patch, jawne apply, evaluate i close. Pipeline nie wykonuje auto-apply,
a close nie oznacza automatycznie DONE.

Filtr `isUsefulCodeChangePath` jest sprawdzany osobno dla prawidłowych źródeł
(TypeScript/Python, dokumentacja, SVG, lockfile, `Dockerfile`, `Makefile`) oraz
dla vendoringu, cache/build, binariów, dumpów analizy, artefaktów runu,
katalogów, globów, URI i ścieżek hosta. Deterministyczny pipeline na całym
repozytorium (`20260730T191330Z-152bfed1`) zakończył się `succeeded` bez LLM;
liczba planów po odfiltrowaniu szumu spadła z 9 do 3 i wszystkie pozostałe
zmiany wskazują konkretne pliki.

Kolejny audyt wykazał, że `.intentignore` odcinał `.github` przed
konwerterem, mimo deklarowanej obsługi workflow CI. Po precyzyjnym ponownym
włączeniu `.github/workflows/` run `20260730T201611Z-d65b5378` zapisał 30
rekordów konfiguracji dla `ci.yml`, wszystkie z generatorem
`t2c/configuration-structural@1` i runtime `0.5.0`. Jednocześnie dokument
wyekstrahowany z dokładnej ścieżki może być dowodem dla wpisu CHANGELOG, który
opisuje ten plik. Pipeline zakończył się `succeeded`, a liczba planów spadła z
3 do 1; pozostała wyłącznie rzeczywista rekomendacja dotycząca `project.sh`.

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
faktów dodanych do analizowanego kodu, a nie z relacji `module_topic`. Bieżące
demo ma 227 rekordów i 93 relacje, w tym cztery rekordy `document` i sześć
rekordów konfiguracji `system` (cztery deklaracje oraz dwa agregaty plikowe).

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

Audyt własnego repozytorium potwierdził **14 912/14 912** rekordów z provenance,
0 brakujących kopert i 0 rekordów z wersją runtime inną niż `0.5.0`. W przebiegu
offline wszystkie miały `used=deterministic`; testy stubowanych odpowiedzi
pokrywają rozstrzygnięty model/provider/response ID dla NL i dokumentacji.

To jest świadome zaostrzenie `t2c.intent/v1`: historyczny rekord bez
`metadata.generation` nie przejdzie już ścisłej walidacji i powinien zostać
ponownie wygenerowany aktualnym runtime'em.

### Samoanaliza wykonana przez todo2code

Po aktualizacji kodu, `TODO.md` i `CHANGELOG.md` uruchomiono deterministyczny
pipeline samego todo2code z wyłączonymi etapami sieciowymi:

```bash
t2c pipeline . --task TASK.md --todo TODO.md --changelog CHANGELOG.md \
  --docs 'README.md,docs/**/*.md,project/**/*.md' \
  --nl-mode deterministic --markdown-mode deterministic \
  --no-docs-llm --no-summary-llm
```

Zakres `--docs` trzeba podawać przy każdej liczbie, bo wpływa on na rekordy,
relacje i pokrycie. Izolowany run `20260730T170141Z-6e43c201` zakończył się
statusem `succeeded` i utworzył graf o fingerprintcie `b15494856a390614`:

- 14 912 rekordów i 24 394 relacje,
- 10 rekordów NL, 30 TODO, 141 CHANGELOG, 37 komunikacji, 10 Git, 13 150 AST,
  1 305 dokumentacji i 229 konfiguracji `system`,
- 5 diagnostyk blocking, 133 review-required, 1 117 warning i 325 info,
- 23 `PLANNED_NOT_IMPLEMENTED`; opisowe rekordy dokumentacji nie są już
  planami, a pozostałe wyniki pochodzą z TODO/NL lub preskryptywnych zdań,
- deterministyczne podsumowanie 100 zwalidowanych wniosków.

Run potwierdził, że dokumentacja i konfiguracja są obecnie konwertowane offline.
Nie oznacza to obsługi każdego języka programowania ani semantycznej interpretacji
każdego dowolnego formatu — granice opisuje punkt 4.

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

- 100% precision i recall ekstrakcji (9/9),
- 100% precision i recall linkowania exact-target (6/6),
- 100% precision i recall capability-topic (1/1) oraz 0 naruszeń hard-negative,
- 100% kompletności cytowań (14/14),
- 100% poprawności deduplikacji DSL2TODO,
- 100% stabilności dwóch kolejnych przebiegów.

## Co nadal wymaga dopracowania

Uporządkowane wedle wpływu. Każda pozycja ma pomiar z tego przebiegu.

### 1. Dopasowanie tematyczne wymaga szerszego benchmarku jakości

Pierwszy etap został wykonany: relacje AST↔NL wzrosły z 0 do **11**, a AST↔TODO
z 1 do **203** we wcześniejszym kontrolowanym pomiarze (pomiar samej zmiany
dawał odpowiednio 10 i 71). W kontrolowanym pomiarze linkera AST↔AST
pozostało na 617; późniejsze 647 wynikało z rozbudowy kodu. Bieżący audyt
ma **22** `PLANNED_NOT_IMPLEMENTED`, po wyłączeniu opisowej dokumentacji z
klasyfikacji planów. Przegląd próbek
potwierdził trafne powiązania m.in. dla adapterów Java/Rust, budżetu
dokumentacji i walidacji kontraktów. Nie jest to jednak jeszcze dowód jakości
na wielu repozytoriach.

Wartości bezwzględne pokrycia pozostają zależne od zbioru dokumentów i warto je
czytać ostrożnie: na bieżącym pełnym repozytorium `implementation coverage`
wynosi **23,4%**, `planned code` **46,4%**, a `aligned` **78 z 449 tematów**.
Dodanie deterministycznej dokumentacji zwiększyło liczbę deklarowanych tematów,
więc tych wartości nie należy porównywać bezpośrednio ze starym runem bez
rekordów `document`.

Gold benchmark rozdziela już exact-target od `module_topic` i zawiera pierwszy
pozytywny przypadek prose-to-module oraz hard negative poniżej progu. To usuwa
największą lukę testową, ale jedna para pozytywna nadal nie dowodzi jakości na
wielu repozytoriach; przed rozszerzaniem aliasów zbiór powinien dalej rosnąć.

### 2. Ścieżka live LLM pozostaje kontrolą opt-in

Gold benchmark nadal buduje wnioski deterministycznie z fikstur i nie zależy od
sieci. Osobny job harmonogramu/`workflow_dispatch` uruchamia
`npm run live:check`: sprawdza NL → Intent DSL i graf → uziemione wnioski w
`require-llm`, więc fallback nie może ukryć złamanego kontraktu. Artefakt
`t2c.live-contract-check/v1` zawiera tylko provider/model, tokeny, koszt,
latencję i zredagowany błąd; limity kosztu i czasu są konfigurowalne. Brak
sekretu jawnie pomija job live i nigdy nie blokuje wymaganej walidacji offline.
Historycznie ręczne próby summary osiągnęły **3/4**, a jedyną porażką było
`HTTP 429`, nie naruszenie struktury.

Porcjowanie TODO/CHANGELOG po 32 rekordy jest wdrożone i pokryte testem, ale
brakuje opublikowanego, zredagowanego porównania kosztu i latencji
`qwen/qwen3.7-plus` z szybszym modelem. Wymaga ono działającego providera i nie
może stać się zależnością wymaganej walidacji offline.

### 3. Nie wszystkie języki repozytorium mają adapter AST

Kod TypeScript/JavaScript, Python, Go, Java i Rust ma adaptery AST. PHP — mimo
że istnieje SDK PHP — oraz inne języki nie mają jeszcze adaptera. Runtime
raportuje teraz liczbę odkrytych plików nieobsługiwanych języków, więc nie
udaje pełnego pokrycia. JSON/YAML/TOML, Dockerfile i workflow CI mają już
deterministyczny konwerter konfiguracji. Adaptery językowe są już rozdzielone
na niezależnie testowalne moduły za wspólną kopertą.

### 4. Bare nazwy plików wymagają jednoznaczności

Ekstrakcja ścieżek na `TODO.md` + `CHANGELOG.md` tego repozytorium:

| | Kandydaci | Fragmenty prozy |
|---|--:|--:|
| Wyjściowo | 81 | 69 |
| Po regułach składniowych | 26 | 3 |
| Po allowliście rozszerzeń | **16** | **0** |

Referencje do pól DSL (`statement.object`, `epistemic.basis`,
`metadata.generation`) nie są już ścieżkami — trafiają do `target.symbols`,
czyli tam, gdzie należą. Alternacje prozatorskie zniknęły całkowicie.

Bare nazwy typu `markdown.ts` są teraz rozwiązywane wobec rzeczywistych
agregatów modułów AST, jeżeli basename występuje w repozytorium dokładnie raz.
Hipotetyczna ścieżka z TODO lub dokumentacji nie zmienia tego indeksu.
Niejednoznaczne `validation.ts`, `types.ts` czy `git.ts` celowo wymagają
katalogu. Gold benchmark mierzy pozytywny przypadek unikalny i dwa zabronione
dopasowania dla nazwy niejednoznacznej; wynik pozostaje 100% precision/recall.

### 5. Adapter Java nie jest weryfikowany lokalnie

`npm test` pomija fixture Javy przy braku JDK. CI wymusza go przez
`T2C_REQUIRE_JAVA_TEST=1` w jobie Temurin 17 (`.github/workflows/ci.yml:34-40`),
więc regresja nie przejdzie do `main` — ale developer bez JDK nie zobaczy jej
przed pushem.

### 6. Pozostały backlog architektoniczny i operacyjny

Otwarte pozostają: cache AST i fragmentów dokumentacji, generowanie validatorów
i schematów z jednego źródła oraz A2A streaming ze współdzielonym
transakcyjnym task store. Trend workspace, porcjowanie LLM, deterministyczna
dokumentacja i konfiguracja oraz podział adapterów językowych zostały wykonane.
Pełna lista z kryteriami znajduje się w `TODO.md`.

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
