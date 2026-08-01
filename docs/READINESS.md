# Gotowość projektu

Stan na **2026-08-01**, runtime `0.5.0`. Dokument odpowiada na jedno pytanie:
**czy todo2code jest kompletny i co trzeba poprawić, zanim będzie**.

`docs/PROJECT_STATUS.md` opisuje, co jest zbudowane. `docs/TEST_REPORT.md`
raportuje wyniki ostatniego przebiegu testów. Ten dokument ocenia dystans do
„gotowe" i nie powtarza ich treści.

Bramki offline uruchomiono ponownie 2026-07-31: `npm run verify`,
`npm run evaluate:gold`, `npm run examples:check`, smoke CLI/MCP/A2A, Docker i
audyt zależności przeszły. Pomiary repozytoriów wykonano w odłączonych worktree
z ich śledzonych commitów, bez prywatnych i nieśledzonych plików. Pełny
baseline siedmiu repozytoriów i kontrolowane A/B pierwszej poprawki są w
[`project/ticket-002`](../project/ticket-002/README.md). Deterministyczny audyt
pozostałych wpisów i drugie, niezależne A/B są w
[`project/ticket-003`](../project/ticket-003/README.md). Eksperyment
wielojęzycznego dopasowania i decyzja o odrzuceniu surowych embeddingów są w
[`project/ticket-004`](../project/ticket-004/README.md). Audyt konwersji
`user-*`/`ai-*` do Intent DSL i właścicieli odpowiedzi jest w
[`project/ticket-005`](../project/ticket-005/README.md); ticket zamknął
eksperyment rerankera przez kontrolowaną ścieżkę odrzucenia. Ticket
[`project/ticket-006`](../project/ticket-006/README.md) ujednolicił walidację
odpowiedzi i potwierdził odrzucenie na drugiej trasie modelowej. Ticket
[`project/ticket-007`](../project/ticket-007/README.md) domknął pustą trasę
odpowiedzi bez tworzenia tożsamości za człowieka. Ticket
[`project/ticket-008`](../project/ticket-008/README.md) przeniósł te granice do
standardu `wellmanifest/new-project` 0.6.0 i oddzielił indeks ticketów od
generowanego `project/README.md`. Ticket
[`project/ticket-009`](../project/ticket-009/README.md) rozszerzył jedno źródło
schematu z rerankera na wszystkie siedem produkcyjnych granic structured LLM.
Ticket [`project/ticket-010`](../project/ticket-010/README.md) dodał
przyrostowy cache AST i fragmentów dokumentacji oraz pomiar cold/warm na trzech
śledzonych snapshotach repozytoriów. Ticket
[`project/ticket-011`](../project/ticket-011/README.md) uziemił cele symboliczne
NL w deklaracjach AST: krótki symbol łączy się tylko przy jednym właścicielu,
a niejednoznaczność kończy się abstencją i listą ścieżek do wyboru.
Tickety [`012`](../project/ticket-012/README.md) i
[`013`](../project/ticket-013/README.md) zmierzyły pełny Live LLM i wybrały
Codestral 2508 jako domyślny model. Ticket
[`014`](../project/ticket-014/README.md) oddzielił lokalizację od implementacji:
sama istniejąca ścieżka nie zamyka już nowej funkcji, a kontrola Koru przeszła
pełny cykl od diagnostyki do zweryfikowanego patcha i re-analizy.
Ticket [`015`](../project/ticket-015/README.md) zachował pełną treść złożonej
intencji w tytule zadania Koru, usuwając wariant `Implement Implement ...` bez
zmiany samego rekordu DSL ani jego celów.
Ticket [`016`](../project/ticket-016/README.md) dodał obserwowalność PHP i A/B
na 40 śledzonych plikach `semcod/redsl`.

## Odpowiedź krótka

**Nie, projekt nie jest kompletny.** Warstwa deterministyczna jest operacyjnie
dojrzała. Warstwa semantyczna — czyli to, po co narzędzie istnieje — działa
poprawnie, ale mierzy niskie pokrycie i nie ma jeszcze dostatecznie szerokiego
dowodu jakości na wielu repozytoriach.

Rozstrzygające liczby, wszystkie z przebiegów opisanych w sekcji „Reprodukcja":

| | todo2code | subactor/platform |
|---|--:|--:|
| Rekordy | 17 064 | 10 628 |
| Relacje | 26 470 | 11 424 |
| Tematy | 474 | 678 |
| **aligned** | **82 (17,3%)** | **43 (6,3%)** |
| Implementation coverage | 24,4% | 10,0% |
| Documented code | 39,9% | 15,2% |

Na własnym repozytorium narzędzie wiąże mniej więcej co szósty temat. Na obcym
— co szesnasty. Ta sama treść zmierzona poprzednią wersją narzędzia dawała 74 i
**25** `aligned` oraz 22,0% i **5,9%** pokrycia; różnica pochodzi ze słownika
dziedzinowego PL→EN, odfiltrowania polskich słów funkcyjnych i z tego, że temat
bez własnego celu trafia teraz pod moduł, z którym łączy go relacja. Dystans
między repozytoriami zmalał, ale nie zniknął.

## Co jest gotowe

Te obszary mają kontrakt, testy i pomiar. Nie są obecnie blockerami wydania.

| Obszar | Dowód |
|---|---|
| Kontrakty DSL i walidacja runtime | kontrakty intencji, grafu, diagnostyk, wniosków, TODO, code-change, operation-plan i wszystkich siedmiu odpowiedzi LLM; 307 testów, 306 zaliczonych, 0 błędów i 1 lokalny skip JDK |
| Granica LLM | 9 deterministycznych entrypointów, 36 modułów bez tranzytywnego importu klienta; wymuszane przez `verify:no-llm` |
| Prowenienacja | każdy rekord niesie konwerter, wersję runtime i tryb; rekord LLM dodatkowo provider/model/response ID, a fallback jawny stan degradacji |
| Determinizm | dwa identyczne przebiegi gold dają ten sam fingerprint; `examples:check` powtarzalny |
| Cache ekstrakcji | content-addressed, wersjonowany i fail-open; TypeScript per plik, zewnętrzny AST per manifest języka, dokumentacja per plik i parametry chunkingu; odpowiedzi LLM nie są cache'owane |
| Ochrona ścieżek | wyjście poza `T2C_ROOT` odrzucane spójnie w CLI, MCP, A2A i SDK |
| Przepływ DSL2TODO | propose → render → approved apply, zgodny w pięciu SDK, `TODO.md` zmieniany wyłącznie po akceptacji hasha |
| Agregaty konfiguracji | jeden `configuration_file_fact` na plik; dokumentacja wiąże się przez jawną ścieżkę, a ogólne klucze nie uruchamiają capability-topic |
| Rozstrzyganie symboli NL | alias symbolu jest dowodem AST tylko przy jednym właścicielu albo zgodnym `target.path`; wiele modułów daje abstencję, kandydatów i `AMBIGUOUS_REQUIREMENT` |
| Lokalizacja vs funkcja | `shared_path` pozostaje relacją nawigacyjną, ale capability-bearing deklaracja wymaga symbolu, capability overlap, konkretnego faktu/commita albo zaakceptowanego reranku; reality nie liczy path-only jako pokrycia |
| Interfejsy | CLI, MCP, A2A v1.0, Docker, wheel Pythona |
| Odporność na obce repo | sześć repozytoriów zewnętrznych plus `subactor/platform`; brak awarii, brak wycieku poza root |
| Sygnał changeloga | placeholdery, skróty `... and N more files` i znane artefakty analizy pod `project/` nie udają już braku implementacji; merytoryczne wpisy nadal wymagają dowodu |
| Izolacja generowanej analizy | nowa referencja do nieśledzonego wejścia nadal blokuje raport; śledzona wzmianka audytowa o jego nazwie nie jest już mylona z odczytem prywatnego pliku |
| Intencje ludzi i agentów | sekcje `user-*`/`ai-*` zachowują właściciela i typ DSL; dowody ticketu nie udają rozmowy; każda rozbieżność wskazuje rolę oraz respondenta albo jawny sentinel nierozstrzygniętej roli |

## Audyt `user-*` / `ai-*` → DSL

Przed poprawką ticket-005 tworzył 165 rekordów `agent_log` z sześciu
anonimowych „uczestników”, bo `README.md`, logi, changelog i pliki iteracji
były traktowane jak rozmowa. Wszystkie 165 rekordów miało nierozstrzygniętą
tożsamość, a cztery konflikty człowiek–agent były artefaktem ról `unknown`.

Bezpośrednio po poprawce ten sam ticket tworzył 38 rekordów z dwóch
właścicieli: 34 dla `codex` i 4 dla `tom-sapletta-com`. Po dopisaniu końcowego
planu, raportu i decyzji jest to 51 + 4. Końcowa analiza ma 0 blocking, 8
warning i 8 `review_required`; nie są to anonimowe konflikty:

- 7 claimów wykonania nie ma jeszcze commita/test-faktu, więc odpowiedzieć
  (`responseRequiredRole=agent`) musi `codex`;
- 1 claim agenta o zatwierdzeniu nie ma decyzji w pliku należącym do człowieka,
  więc odpowiedzieć musi `tom-sapletta-com`;
- 8 szczegółowych działań nie ma równie szczegółowej intencji w human-owned
  pliku (najnowsze polecenie istnieje tylko w rozmowie), więc potwierdzenie albo
  korekta zakresu również należy do `tom-sapletta-com`.

Agent nie może zamknąć dwóch ostatnich klas przez edycję `user-*`. To właśnie
oczekiwany podział odpowiedzialności: dowód własnego wykonania uzupełnia agent,
a ludzką decyzję lub rozszerzenie zakresu zapisuje człowiek.

Przypadek brzegowy z ticket-006 jest zamknięty przez ticket-007. Gdy istnieje
wyłącznie plik agenta, analiza nadal wskazuje `responseRequiredRole=human`, ale
zamiast pustego `responseRequiredFrom=[]` emituje
`responseRequiredFrom=["unresolved:human"]`. Analogiczny brak agenta daje
`unresolved:agent`. Znany uczestnik nadal zachowuje pierwszeństwo; sentinel nie
udaje osoby, nie tworzy `user-*` i nie jest adresem zewnętrznej wysyłki.

Test migracyjny użył read-only historycznego commita `2b9e3c9` z
`wellmanifest/new-project`:

| Wariant | Rekordy | Wynik |
|---|---:|---|
| samo przemianowanie Prompt/raportu na `user-*`/`ai-*` | 0 | jawne ostrzeżenia wskazują człowieka i agenta, którzy muszą sklasyfikować treść |
| Opus, jawne `request` + analityczne `message` | 9 + 58 | 0 rozbieżności |
| GPT56Luna, jawne `request` + analityczne `message` | 9 + 72 | 3 fragmenty bez odpowiedzi, 0 fałszywego konfliktu różnych plików |

Wniosek: system porównuje intencje dopiero po konwersji sekcji do DSL, ale
zachowuje tekst, ścieżkę i linie źródłowe. Migracja musi zachować typ
epistemiczny — oznaczenie całej analizy jako `report` wytwarza fałszywe claimy,
dlatego starsze dokumenty mieszane wymagają podziału na sekcje.

## Audyt siedmiu repozytoriów

Wspólny pipeline offline uruchomiono na `code2llm`, `domd`, `pactfix`,
`code2logic`, `code2docs`, `redup` i `subactor/platform`. Wszystkie 7/7
przebiegów zakończyło się `succeeded`; zakres dokumentacji, tryby i commity są
utrwalone w
[`baseline.json`](../project/ticket-002/baseline.json).

| Repozytorium | Rekordy | Relacje | Implementation coverage | `CHANGELOG_WITHOUT_IMPLEMENTATION` |
|---|---:|---:|---:|---:|
| code2llm | 16 899 | 41 747 | 59,4% | 1 411 |
| domd | 10 611 | 7 470 | 11,8% | 105 |
| pactfix | 5 161 | 3 917 | 5,0% | 48 |
| code2logic | 21 423 | 16 927 | 17,7% | 121 |
| code2docs | 6 717 | 35 447 | 47,1% | 396 |
| redup | 7 204 | 19 173 | 49,2% | 703 |
| subactor/platform | 10 628 | 11 002 | 5,9% | 93 |

Powtarzalna próbka diagnostyk wykazała, że mechaniczne wpisy wydania zasłaniają
realne deklaracje bez implementacji. Minimalny klasyfikator usunął 1 024
fałszywe `review_required` w pięciu repozytoriach
(`2 877 → 1 853`) oraz 39 wtórnych `UNLINKED_RECORD`. Na `pactfix` i
`subactor/platform`, gdzie próbkowane wpisy były merytoryczne, liczby się nie
zmieniły. Fingerprint każdego grafu pozostał identyczny, a gold v2 zachował
100% precision/recall i zero naruszeń zabronionych kodów. Szczegóły:
[`iteration-01.md`](../project/ticket-002/iteration-01.md).

Drugi audyt sklasyfikował deterministyczną próbkę 168 z pozostałych 1 853
zgłoszeń (24 z każdego repozytorium), a następnie wykonał pełny cenzus
wyłonionych klas. Dokładne, pozbawione deklaracji zachowania wpisy
`Update <file>` stanowiły 547 przypadków w pięciu repozytoriach. Ich
odfiltrowanie obniżyło liczbę
`CHANGELOG_WITHOUT_IMPLEMENTATION` z **1 853 do 1 306** oraz wtórnych
`UNLINKED_RECORD` z 5 728 do 5 540. Wszystkie 7/7 fingerprintów grafu
pozostało identycznych, gold v2 nadal ma 100% precision/recall, a pełna
walidacja offline przeszła. Szczegóły i próbka:
[`iteration-01.md`](../project/ticket-003/iteration-01.md).

## Co blokuje uznanie za kompletny

Uporządkowane wedle wpływu. Każda pozycja ma pomiar i wskazany plik.

### 1. Pokrycie wiązania intencja↔kod nadal zależy od repozytorium

Na `subactor/platform` `implementation coverage` wynosi **10,0%**, a `aligned`
**43 z 678 tematów** — wobec 5,9% i 25 przed słownikiem dziedzinowym. Na własnym
repozytorium jest to 24,4%. Różnica zmalała, ale wciąż wynosi ponad dwa razy.

Zamknięto trzy przyczyny, każda zmierzona na tej samej treści:

- słownik PL→EN dla słownictwa dziedzinowego obserwowanego w tym korpusie oraz
  polskich końcówek na angielskich zapożyczeniach (`ticketu`, `foundera`);
- polskie słowa funkcyjne przestały udawać tematy. `nie` 175, `jest` 110 i
  `jako` 54 były jednymi z najczęstszych „tematów" korpusu, a bufory tematyczne
  biorą tylko pierwsze dwanaście tokenów rekordu — czysta gramatyka wypierała
  prawdziwe słownictwo, zanim dopasowanie się zaczęło;
- deklaracja, której własny cel nie wskazuje żadnego pliku, trafia pod moduł
  powiązany z nią relacją. Wcześniej zdanie, które linker *już* połączył z
  kodem, i tak liczyło się jako „planned, no code", bo tematy grupuje własny
  ticket/ścieżka/symbol rekordu, a nie graf.

Co zostaje: dopasowanie działa dla słownictwa w słowniku, nie dla języka. Gold
v2 mierzy teraz osobny kohort PL/DE/ES/FR: **0/6** oczekiwanych relacji poza
słownikiem i 0/6 naruszeń bliskich semantycznie par zabronionych.

Ticket-004 sprawdził dwa przypięte modele lokalne. MiniLM poprawnie uszeregował
5/6 par, E5 6/6, lecz zakresy cosine pozytywów i negatywów nachodziły na siebie.
Na rzeczywistym grafie `subactor/platform` próg E5 wskazał dwie nowe relacje i
obie odrzucono po przeglądzie. Wzajemny top-1 usunął fałszywe trafienia, ale nie
dodał żadnej relacji, więc surowe embeddingi nie weszły do linkera. Skalowanie
słownika ręcznie na każdy język i dziedzinę nadal nie jest planem.

Ticket-005 oddzielił retrieval od decyzji. Wersjonowany kandydat jest
ograniczony do 1–10 modułów, nie może utworzyć relacji, a decyzja musi
zaakceptować, odrzucić albo abstainować z cytatami z obu rekordów. Na
przejrzanych fixture'ach gold v2 reranker osiąga **6/6** oczekiwanych relacji,
**0/6** naruszeń par zabronionych i jedną abstencję hard-negative; zwykły
linker nadal świadomie raportuje 0/6.

Próba live na czystym commitcie `3e96573` platformy nie przeszła granicy
kontraktu. Trzy odpowiedzi `qwen/qwen3.7-plus` kolejno: nie zawierały tablicy
`decisions`, użyły pola `judgments`, a następnie zwróciły niepoprawny typ lub
zakres `confidence`. Runtime za każdym razem odmówił utworzenia relacji. Nie
zmierzono więc wzrostu coverage ani stabilnej, przypiętej rewizji dostawcy;
reranker nie jest eksportowany przez paczkę, CLI, MCP ani A2A. To wynik
negatywny, ale ważny: JSON Schema deklarowane na granicy providera nie jest
samo w sobie dowodem zgodności odpowiedzi.

Ticket-006 usunął lokalny drift: schema wysyłana do providera, typ TypeScript i
walidator runtime mają jedno źródło, a pełny test porównuje je z opublikowanym
schematem. Druga trasa, `qwen/qwen3.7-flash`, również zawiodła — dodała
niedozwolone `response.decisions[0].decision`. Nowy błąd podał dokładną
ścieżkę oraz provider/model/response ID bez utrwalania payloadu. Plus i Flash
zostały więc odrzucone przed zmianą grafu.

Ticket-009 usunął tę samą klasę driftu z pozostałych granic. Mały,
bezdependencyjny kontrakt TypeScript generuje JSON Schema i parser runtime dla
NL, dokumentacji, TODO/CHANGELOG, komunikacji, podsumowania, syntezy zadań oraz
rerankera. `npm run verify:structured-responses` mierzy **7 wywołań
kontraktowych i 0 surowych wywołań JSON** w kodzie produkcyjnym, a
`verify:schemas` porównuje publikowany schemat dokumentów z wynikiem generatora.
Niepoprawny enum, procent zamiast liczby, puste klucze i nadmiarowe pole są
odrzucane z dokładną ścieżką. Provider/model/response ID pozostają w audycie
nawet wtedy, gdy parser odrzuci odpowiedź. Kontrole cytowań i własności dowodu
pozostają osobnym etapem, bo zgodność JSON nie dowodzi istnienia rekordu w
konkretnym grafie.

**Warunek zamknięcia:** dopasowanie niezależne od ręcznego słownika (osadzenia
albo tłumaczenie/reranking tematów), stabilny kontrakt live podniesiony z 0/6
na gold v2 i potwierdzony wzrostem `implementation coverage` na repozytorium
spoza tego korpusu.

### 2. Gold dataset: rozszerzony w v2, ale próba wciąż jest mała

`evaluation/gold/v2/dataset.json` (`t2c.gold-dataset/v2`) zastąpił v1 jako
bramka `npm run evaluate:gold`; v1 zostaje w drzewie i nadal jest ewaluowalny.
Stan po rozszerzeniu:

| | v1 | v2 |
|---|--:|--:|
| Przypadki ekstrakcji / oczekiwane rekordy | 6 / 9 | 10 / 21 |
| Kanały ekstrakcji | 3 | 4 (doszedł deterministyczny baseline dokumentacji) |
| Relacje linkowania `exact-target` | 6 | 10 |
| Relacje linkowania `capability-topic` | 1 | 8 |
| Zabronione pary linkowania | 2 | 14 |
| Przypadki diagnostyk (false DONE, partial) | brak zakresu | 5 / 11 oczekiwań |
| Wielojęzyczny kohort | brak | 6 oczekiwanych / 6 zabronionych |
| Udokumentowane luki (`knownGap`) | brak | 6 |

Zakres `diagnostics` istnieje, bo ani ekstrakcja, ani linkowanie nie wyrażają
zdania „ten DONE nie ma za sobą implementacji": rekord ekstrahuje się poprawnie
i nie łączy z niczym — czyli dokładnie stan, o który chodzi. Przypadek
`diagnostics-true-done-with-evidence` pilnuje strony odwrotnej: DONE z dowodem
musi milczeć.

**Warunek zamknięcia:** próba na tyle duża, by zmiana progu trzech tematów dała
mierzalny spadek w którąkolwiek stronę — dziś 8 pozytywów i 6 negatywów to
minimum, nie komfort.

### 3. Harmonogramowana kontrola LLM obejmuje cały pipeline, ale trend jest jeszcze krótki

`make demollm` przechodzi. Historia przebiegów pokazała **1 z 6** przed
dodaniem korygującej próby, a później sporadyczny zmyślony `recordId` i pusty
lokalny klucz propozycji. Generator v2 wyprowadza rekordy tylko z cytowanych
diagnostyk, nadal odrzuca nieznane diagnostyki i nadaje lokalne klucze w
runtime. Bieżący `live:check` i pełny run przeszły bez retry, lecz:

- gold nie uruchamia realnego wywołania, więc regresja promptu lub modelu
  nie zostanie wykryta przez bramkę offline;
- historia dopiero zaczyna się zbierać — kontrakt i przechowywanie są gotowe,
  ale trend potrzebuje przebiegów, żeby cokolwiek znaczyć.

`npm run live:check` obejmuje teraz **sześć etapów z sześciu**. Kontrola
uruchamia pipeline `require-llm` nad `examples/` i mierzy jego manifest, zamiast
wołać wybrane etapy własnymi wywołaniami — dzięki temu nie może rozjechać się z
tym, co pipeline naprawdę robi, a właśnie tak dryfowała do dwóch etapów. Progi
są rozdzielone na etap i na cały przebieg (`t2c.live-contract-check/v2`), a
`.intent-live/contract-check-history.json` przechowuje zredagowany trend
ostatnich 50 przebiegów; job CI odtwarza go z cache i publikuje jako artefakt.
Historia jest raportowana, ale nie jest bramką: jeden wolny dzień providera nie
powinien wywracać buildu, a trend, którego nikt nie zapisuje, i tak jest
nieczytelny.

**Warunek zamknięcia:** kilka zapisanych przebiegów harmonogramowych, żeby
mediana latencji i kosztu per etap opisywała cokolwiek.

### 4. Luki w pokryciu języków i formatów

PHP ma od ticketu 016 dependency-free adapter składniowy oparty o
`token_get_all(..., TOKEN_PARSE)`. Kontrolowane A/B na `semcod/redsl` zamieniło
ostrzeżenie o 40 nieobsługiwanych plikach na 2 127 unikalnych rekordów PHP,
80 nowych relacji i 18 mniej ostrzeżeń diagnostycznych, bez zmiany liczby
planów. Nadal brakuje parserów Ruby/C#/Kotlin/C/C++ i innych raportowanych
jawnie języków.

### 5. Znane ograniczenia semantyczne

- Bare nazwy plików rozwiązują się tylko przy unikalności w repo; `validation.ts`
  czy `types.ts` pozostają niewiązalne bez katalogu. To świadomy kompromis
  precyzji, nie usterka, ale obniża recall.
- Konfiguracja i AST mogą dowodzić `implemented`, ale raport rozdziela już
  jakość tego dowodu. Pomiar wykazał 16 z 46 tematów opartych wyłącznie na
  konfiguracji na `subactor/platform` wobec 4 z 89 tutaj; `alignedByEvidence`
  zachowuje ten podział bez odbierania konfiguracji statusu implementacji.
- Wpisy changelogu nie uczestniczą w szerokim dopasowaniu tematycznym. Audyt
  siedmiu repozytoriów pokazał, że takie połączenie mieszałoby prawdziwe
  deklaracje wydania z mechaniką release notes. Szum mechaniczny jest już
  odfiltrowany. Z pozostałych **1 306** wpisów pełny cenzus klasyfikuje 1 275
  jako merytoryczne lub nieweryfikowalne deklaracje, 30 jako niezrealizowane
  pozycje roadmapy i 1 jako zbiorcze podsumowanie plików. Pierwsza grupa nadal
  wymaga precyzyjnego dowodu przez ticket, symbol lub ścieżkę. Następna
  hipoteza to jawny cykl życia pozycji roadmapy, nie kolejne wyciszenie tekstu
  changeloga.

### 6. Cache ogranicza powtarzaną ekstrakcję, ale nie dowodzi pełnej skali

Ticket-010 dodał cache pod `<outputDir>/cache/v1`: TypeScript jest zapisywany
per plik, adaptery zewnętrzne per pełny manifest języka, a Markdown per plik,
rozmiar fragmentu i wersję algorytmu. Uszkodzenie lub błąd I/O powoduje
ponowną ekstrakcję; wyniki z ostrzeżeniem toolchainu i odpowiedzi LLM nie są
utrwalane. Cold/warm na śledzonych snapshotach dał **1398,4→442,1 ms** dla
15 062 rekordów AST todo2code i **49,2→16,8 ms** dla 751 rekordów
subactor-improvement, z identycznym wyjściem. Dla dokumentacyjnego new-project
zysk był mały (**10,1→7,2 ms**, 26/26 hitów), co potwierdza, że granicę
skalowania całego pipeline'u nadal trzeba mierzyć na większych grafach; cache
nie przyspiesza linkowania ani syntezy LLM.

### 7. Pełny kontrakt live LLM działa na jawnym modelu

Domyślny `openrouter/auto-beta` ukrywał wybór modelu, a odrzucona odpowiedź
traciła metadane. Pomiary na identycznym pipeline `require-llm` wykazały, że
Qwen 3.7 Plus łamał kontrakty dokumentacji i komunikacji również po korekcie,
a GPT-5.4 Mini dwukrotnie łamał już kontrakt NL. Nie obniżono rygoru parsera.

Jawny `google/gemini-3.6-flash` przeszedł **6/6** etapów bez fallbacku i
degradacji: 125,486 s, 177 953 tokeny, $0.412363. Każdy bezpośredni ekstraktor
ma teraz jedną próbę korekcyjną z dokładnym schematem; druga zła odpowiedź
nadal przerywa run. Audyt zachowuje obie odpowiedzi, a request timeout nie może
być krótszy niż mierzony budżet etapu. Historia obejmuje bieżący zapis.

Ticket-013 powtórzył pełny kontrakt na modelach wybranych z poprawnych kohort
`llm-code-benchmark`. `mistralai/codestral-2508` przeszedł 6/6 w **57,129 s**
za **$0.037994**, a `google/gemini-3-flash-preview` w 64,064 s za $0.076411.
`deepseek/deepseek-v4-pro` przekroczył 900-sekundowy budżet i został odrzucony.
Codestral jest teraz jawnym domyślnym modelem. Na `weekly` współbieżność trzech
batchy skróciła ten sam etap 218,741→53,362 ms; wcześniej timeoutujący
`nlp2uri` zakończył 619 rekordów / 20 żądań w 194,750 ms za $0.08588244.

## Ryzyka operacyjne

| Ryzyko | Stan |
|---|---|
| Adapter Java weryfikowany wyłącznie w CI | job Temurin 17 z `T2C_REQUIRE_JAVA_TEST=1`; w bieżącym środowisku pominięty z powodu braku JDK |
| Zależność od dostępności providera | testy offline nigdy nie wołają sieci; live check jest osobnym, opt-in jobem; Codestral i Gemini 3 Flash Preview przeszły 6/6, ale wynik nie gwarantuje przyszłej dostępności |
| Koszt LLM | Codestral: $0.037994 za pełne 6/6 na małym repo i $0.08588244 za 619 rekordów Markdown `nlp2uri`; duże backlogi nadal wymagają limitu kosztu |
| Audyt zależności | `npm audit --omit=dev`: 0 podatności |

## Kryteria wydania

Wersję `0.6.0` uznaję za gotową, gdy:

1. **zrobione** — gold v2 zachowuje osobne precision/recall dla dopasowania po
   celu i po temacie oraz rozszerza próbę: 8 pozytywów `capability-topic`
   zamiast 1, 14 par zabronionych, osobny zakres diagnostyk oraz kohort
   cross-language z 6 pozytywami i 6 negatywami. Próba jest nadal mała i
   pozostaje pozycją w TODO;
2. **zrobione operacyjnie** — live check obejmuje sześć etapów LLM, ma
   rozdzielone progi etap/przebieg, zapisuje historię i przeszedł 6/6 na jawnym
   modelu; trend nadal wymaga kolejnych planowych przebiegów;
3. `implementation coverage` na repozytorium innym niż własne przekracza próg
   ustalony po pomiarze z punktu 1 — dziś 10,0% jest zbyt niskie, by narzędzie
   było użyteczne bez ręcznej interpretacji.

Punkty 1 i 3 są warunkami merytorycznymi, a punkt 2 techniczno-operacyjnym.

Punkt 3 pozostaje otwarty, ale przesunął się. Pomiar A/B na identycznej treści
(ta sama treść śledzonego `HEAD`, dwie wersje narzędzia):

| | todo2code przed | po | platform przed | po |
|---|--:|--:|--:|--:|
| Relacje | 24 860 | 26 470 | 11 002 | 11 424 |
| Tematy | 482 | 474 | 688 | 678 |
| `aligned` | 74 | **82** | 25 | **43** |
| Implementation coverage | 22,0% | **24,4%** | 5,9% | **10,0%** |
| Documented code | 36,0% | 39,9% | 8,9% | 15,2% |

Wcześniejsza partia poprawek (modalność prohibicyjna, obligacja peryfrastyczna,
martwe `muszą` przez `\b` na diakrytyku, składanie liczby mnogiej) dodała
relacje, ale nie ruszyła pokrycia — bo `aligned` w ogóle nie czytało grafu.
Dopiero kotwiczenie deklaracji w powiązanym module przełożyło relacje na
metrykę.

## Reprodukcja

```bash
npm run verify          # 307 testów, 104 moduły, 7/0 structured/raw LLM calls
npm run evaluate:gold   # precision/recall po klasach, diagnostyki, stabilność
npm run examples:check  # pięć SDK, powtarzalny
npm audit --omit=dev    # zależności produkcyjne
make smoke protocol-smoke docker-smoke
npm run live:check      # opt-in, wymaga OPENROUTER_API_KEY
make demollm            # sześć etapów LLM bez fallbacku, płatne
```

Pomiary pokrycia z tego dokumentu:

```bash
t2c pipeline <root> --task TASK.md --todo TODO.md --changelog CHANGELOG.md \
  --docs 'README.md,docs/**/*.md' \
  --nl-mode deterministic --markdown-mode deterministic \
  --no-docs-llm --no-summary-llm --out .intent-readiness
t2c reality .intent-readiness/runs/<id>/intent.graph.json \
  --diagnostics .intent-readiness/runs/<id>/diagnostics.json --md reality.md
```

`todo2code` używał `--task TASK.md`; `subactor/platform` zastępował tę opcję
przez `--task none` i dodawał `--no-communication`. Zakres `--docs` zmienia
liczby — trzeba go podawać razem z wynikiem. Powyższa tabela pochodzi
odpowiednio z runów
`20260731T060324Z-7be82c1d` na `bf79b96` i
`20260731T060357Z-4ac57367` na `3e96573`.
