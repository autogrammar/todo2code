# Gotowość projektu

Stan na **2026-07-31**, runtime `0.5.0`. Dokument odpowiada na jedno pytanie:
**czy todo2code jest kompletny i co trzeba poprawić, zanim będzie**.

`docs/PROJECT_STATUS.md` opisuje, co jest zbudowane. `docs/TEST_REPORT.md`
raportuje wyniki ostatniego przebiegu testów. Ten dokument ocenia dystans do
„gotowe" i nie powtarza ich treści.

Bramki offline uruchomiono ponownie 2026-07-31: `npm run verify`,
`npm run evaluate:gold`, `npm run examples:check` i audyt zależności przeszły.
Pomiary repozytoriów wykonano w odłączonych worktree z ich śledzonych `HEAD`,
bez prywatnych i nieśledzonych plików.

## Odpowiedź krótka

**Nie, projekt nie jest kompletny.** Warstwa deterministyczna jest operacyjnie
dojrzała. Warstwa semantyczna — czyli to, po co narzędzie istnieje — działa
poprawnie, ale mierzy niskie pokrycie i nie ma jeszcze dostatecznie szerokiego
dowodu jakości na wielu repozytoriach.

Rozstrzygające liczby, wszystkie z przebiegów opisanych w sekcji „Reprodukcja":

| | todo2code | subactor/platform |
|---|--:|--:|
| Rekordy | 16 928 | 10 628 |
| Relacje | 24 400 | 11 002 |
| Tematy | 478 | 688 |
| **aligned** | **74 (15,5%)** | **25 (3,6%)** |
| Implementation coverage | 22,3% | 5,9% |
| Documented code | 36,0% | 8,9% |

Na własnym repozytorium narzędzie wiąże mniej więcej co szósty temat. Na obcym
— co dwudziesty ósmy. Wynik `subactor/platform` poprawił się względem
poprzednich 10/687, ale różnica między repozytoriami nadal pokazuje istotny
brak przenośności semantycznej.

## Co jest gotowe

Te obszary mają kontrakt, testy i pomiar. Nie są obecnie blockerami wydania.

| Obszar | Dowód |
|---|---|
| Kontrakty DSL i walidacja runtime | kontrakty intencji, grafu, diagnostyk, wniosków, TODO, code-change i operation-plan; 238 testów, 237 zaliczonych, 0 błędów i 1 lokalny skip JDK |
| Granica LLM | 9 deterministycznych entrypointów, 30 modułów bez tranzytywnego importu klienta; wymuszane przez `verify:no-llm` |
| Prowenienacja | każdy rekord niesie konwerter, wersję runtime i tryb; rekord LLM dodatkowo provider/model/response ID, a fallback jawny stan degradacji |
| Determinizm | dwa identyczne przebiegi gold dają ten sam fingerprint; `examples:check` powtarzalny |
| Ochrona ścieżek | wyjście poza `T2C_ROOT` odrzucane spójnie w CLI, MCP, A2A i SDK |
| Przepływ DSL2TODO | propose → render → approved apply, zgodny w pięciu SDK, `TODO.md` zmieniany wyłącznie po akceptacji hasha |
| Agregaty konfiguracji | jeden `configuration_file_fact` na plik; dokumentacja wiąże się przez jawną ścieżkę, a ogólne klucze nie uruchamiają capability-topic |
| Interfejsy | CLI, MCP, A2A v1.0, Docker, wheel Pythona |
| Odporność na obce repo | sześć repozytoriów zewnętrznych plus `subactor/platform`; brak awarii, brak wycieku poza root |

## Co blokuje uznanie za kompletny

Uporządkowane wedle wpływu. Każda pozycja ma pomiar i wskazany plik.

### 1. Pokrycie wiązania intencja↔kod jest niskie i mocno zależne od repozytorium

Na `subactor/platform` `implementation coverage` wynosi **5,9%**, a `aligned`
**25 z 688 tematów**. Dokumentacja jest tam po polsku, a identyfikatory w kodzie
po angielsku, więc heurystyka `module_topic` — wymagająca trzech wspólnych
znormalizowanych tematów — nadal trafia rzadko.

To nie jest usterka do naprawienia jedną zmianą. To granica obecnego podejścia:
dopasowanie leksykalne nie przechodzi przez barierę językową ani przez
dokumentację opisującą infrastrukturę zamiast kodu.

Gold v2 mierzy tę granicę wprost: przypadek `link-topic-polish-prose-to-english-module`
jest oznaczony jako `knownGap` — relacja, której narzędzie powinno dowieść, a
nie potrafi (0/1). Nie wchodzi do precision/recall, bo bramka świecąca zawsze
na czerwono przestaje być czytana; jest raportowana osobno, żeby luka miała
liczbę.

**Warunek zamknięcia:** dopasowanie przechodzące barierę językową — słownik
dziedzinowy albo osadzenia — podniesione z 0/1 na gold v2 i potwierdzone
wzrostem `implementation coverage` na `subactor/platform`.

### 2. Gold dataset: rozszerzony w v2, ale próba wciąż jest mała

`evaluation/gold/v2/dataset.json` (`t2c.gold-dataset/v2`) zastąpił v1 jako
bramka `npm run evaluate:gold`; v1 zostaje w drzewie i nadal jest ewaluowalny.
Stan po rozszerzeniu:

| | v1 | v2 |
|---|--:|--:|
| Przypadki ekstrakcji / oczekiwane rekordy | 6 / 9 | 10 / 21 |
| Kanały ekstrakcji | 3 | 4 (doszedł deterministyczny baseline dokumentacji) |
| Relacje linkowania `exact-target` | 6 | 6 |
| Relacje linkowania `capability-topic` | 1 | 7 |
| Twarde negatywy linkowania | 2 | 5 |
| Przypadki diagnostyk (false DONE, partial) | brak zakresu | 5 / 11 oczekiwań |
| Udokumentowane luki (`knownGap`) | brak | 1 |

Zakres `diagnostics` istnieje, bo ani ekstrakcja, ani linkowanie nie wyrażają
zdania „ten DONE nie ma za sobą implementacji": rekord ekstrahuje się poprawnie
i nie łączy z niczym — czyli dokładnie stan, o który chodzi. Przypadek
`diagnostics-true-done-with-evidence` pilnuje strony odwrotnej: DONE z dowodem
musi milczeć.

**Warunek zamknięcia:** próba na tyle duża, by zmiana progu trzech tematów dała
mierzalny spadek w którąkolwiek stronę — dziś 7 pozytywów i 5 negatywów to
minimum, nie komfort.

### 3. Harmonogramowana kontrola LLM obejmuje tylko część pipeline'u

`make demollm` przechodzi. Historia przebiegów pokazała **1 z 6** przed
dodaniem korygującej próby, a później sporadyczny zmyślony `recordId` i pusty
lokalny klucz propozycji. Generator v2 wyprowadza rekordy tylko z cytowanych
diagnostyk, nadal odrzuca nieznane diagnostyki i nadaje lokalne klucze w
runtime. Bieżący `live:check` i pełny run przeszły bez retry, lecz:

- nie ma historii pozwalającej wyznaczyć stabilność — pojedyncze uruchomienia
  nie są statystyką;
- gold nie uruchamia realnego wywołania, więc regresja promptu lub modelu
  nie zostanie wykryta przez bramkę offline;
- `npm run live:check` jest opt-in i obejmuje dwa etapy z sześciu.

**Warunek zamknięcia:** live check obejmujący wszystkie sześć etapów, z progami
i historią wyniku, uruchamiany harmonogramem.

### 4. Luki w pokryciu języków i formatów

PHP nie ma adaptera AST. Nierozpoznane pliki są raportowane jawnie, więc
narzędzie nie udaje pełnego pokrycia, ale repozytorium z istotną częścią kodu
w PHP dostanie niepełny obraz rzeczywistości.

### 5. Znane ograniczenia semantyczne

- Bare nazwy plików rozwiązują się tylko przy unikalności w repo; `validation.ts`
  czy `types.ts` pozostają niewiązalne bez katalogu. To świadomy kompromis
  precyzji, nie usterka, ale obniża recall.
- Konfiguracja i AST są obecnie równorzędnym dowodem `implemented`. Nie ma
  jeszcze pomiaru, czy słaby dowód w postaci samego klucza konfiguracji nie
  zawyża statusu `aligned`.
- Wpisy changelogu nie uczestniczą w dopasowaniu tematycznym: `isModuleTopicSource`
  obejmuje `module_fact`, `nl`, `todo` i `document`, więc wpis wydania może
  dosięgnąć modułu wyłącznie przez jawny ticket, symbol lub ścieżkę. To wprost
  podnosi liczbę `CHANGELOG_WITHOUT_IMPLEMENTATION`; nie zmierzono jeszcze, ile
  z tych wpisów byłoby uzasadnionych tematycznie.

### 6. Wydajność na dużych repozytoriach nieprzebadana

Brak cache'u AST i chunków dokumentacji po content hash. Największy opisany
tu pomiar gotowości ma 16,9 tys. rekordów, a test przenośności na `domd` około
23,3 tys.; nie wiadomo jeszcze, gdzie leży granica skalowania.

## Ryzyka operacyjne

| Ryzyko | Stan |
|---|---|
| Adapter Java weryfikowany wyłącznie w CI | job Temurin 17 z `T2C_REQUIRE_JAVA_TEST=1`; w bieżącym środowisku pominięty z powodu braku JDK |
| Zależność od dostępności providera | testy offline nigdy nie wołają sieci; live check jest osobnym, opt-in jobem |
| Koszt LLM | ostatni pełny `make demollm`: ~$0,036 i 99 347 tokenów na małym repo; brak ekstrapolacji dla dużych |
| Audyt zależności | `npm audit --omit=dev`: 0 podatności |

## Kryteria wydania

Wersję `0.6.0` uznaję za gotową, gdy:

1. **zrobione** — gold v2 zachowuje osobne precision/recall dla dopasowania po
   celu i po temacie oraz rozszerza próbę: 7 pozytywów `capability-topic`
   zamiast 1, 5 twardych negatywów, osobny zakres diagnostyk i jedna
   udokumentowana luka. Próba jest nadal mała i pozostaje pozycją w TODO;
2. live check obejmuje sześć etapów LLM i ma zapisaną historię wyniku;
3. `implementation coverage` na repozytorium innym niż własne przekracza próg
   ustalony po pomiarze z punktu 1 — dziś 5,9% jest zbyt niskie, by narzędzie
   było użyteczne bez ręcznej interpretacji.

Punkty 1 i 3 są warunkami merytorycznymi, a punkt 2 techniczno-operacyjnym.

Poprawki jakości semantycznej wprowadzone razem z gold v2 — modalność
prohibicyjna (`nie wolno`, `is not allowed`), obligacja peryfrastyczna
(`has to`), martwe dopasowanie `muszą` przez `\b` na diakrytyku oraz składanie
liczby mnogiej w tematach — zmierzono na obu repozytoriach z ich śledzonych
`HEAD`: liczba relacji wzrosła z 24 246 do 24 400 (todo2code) i z 10 875 do
11 002 (`subactor/platform`), przy niezmienionych `aligned` 74/478 i 25/688 oraz
`implementation coverage` 22,3% i 5,9%. Poprawki są zatem realne na poziomie
zdania i relacji, ale **nie przesuwają pokrycia** — punkt 3 pozostaje otwarty.

## Reprodukcja

```bash
npm run verify          # 238 testów, 93 moduły, kontrakt .env, workflowy
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
