# Gotowość projektu

Stan na **2026-07-30**, runtime `0.5.0`. Dokument odpowiada na jedno pytanie:
**czy todo2code jest kompletny i co trzeba poprawić, zanim będzie**.

`docs/PROJECT_STATUS.md` opisuje, co jest zbudowane. `docs/TEST_REPORT.md`
raportuje wyniki ostatniego przebiegu testów. Ten dokument ocenia dystans do
„gotowe" i nie powtarza ich treści.

## Odpowiedź krótka

**Nie, projekt nie jest kompletny.** Warstwa deterministyczna jest operacyjnie
dojrzała. Warstwa semantyczna — czyli to, po co narzędzie istnieje — działa
poprawnie, ale mierzy niskie pokrycie i nie ma jeszcze dostatecznie szerokiego
dowodu jakości na wielu repozytoriach.

Rozstrzygające liczby, wszystkie z przebiegów opisanych w sekcji „Reprodukcja":

| | todo2code | subactor/platform |
|---|--:|--:|
| Rekordy | 15 907 | 10 447 |
| Relacje | 22 662 | 10 914 |
| Tematy | 449 | 687 |
| **aligned** | **68 (15%)** | **10 (1,5%)** |
| Implementation coverage | 21,5% | 2,4% |
| Documented code | 37,6% | 7,5% |

Na własnym repozytorium narzędzie wiąże co siódmy temat. Na obcym — co
sześćdziesiąty piąty. Ta różnica jest właściwą miarą tego, ile brakuje.

## Co jest gotowe

Te obszary mają kontrakt, testy i pomiar. Nie widzę powodu, by je dalej ruszać
przed wydaniem.

| Obszar | Dowód |
|---|---|
| Kontrakty DSL i walidacja runtime | `t2c.intent/v1`, `graph`, `diagnostics`, `conclusion`, `todo-proposal`, `todo-patch`, `code-change-plan`, `code-change-source-patch`, `code-change-close-result`; 216 testów, 0 błędów i 1 lokalny skip JDK |
| Granica LLM | 9 deterministycznych entrypointów, 30 modułów bez tranzytywnego importu klienta; wymuszane przez `verify:no-llm` |
| Prowenienacja | każdy rekord niesie konwerter, wersję runtime i tryb; rekord LLM dodatkowo provider/model/response ID, a fallback jawny stan degradacji |
| Determinizm | dwa identyczne przebiegi gold dają ten sam fingerprint; `examples:check` powtarzalny |
| Ochrona ścieżek | wyjście poza `T2C_ROOT` odrzucane spójnie w CLI, MCP, A2A i SDK |
| Przepływ DSL2TODO | propose → render → approved apply, zgodny w pięciu SDK, `TODO.md` zmieniany wyłącznie po akceptacji hasha |
| Agregaty konfiguracji | jeden `configuration_file_fact` na plik; dokumentacja wiąże się przez jawną ścieżkę, a ogólne klucze nie uruchamiają capability-topic |
| Interfejsy | CLI, MCP, A2A v1.0, Docker, wheel Pythona |
| Odporność na obce repo | trzy repozytoria zewnętrzne plus `subactor/platform`; brak awarii, brak wycieku poza root |

## Co blokuje uznanie za kompletny

Uporządkowane wedle wpływu. Każda pozycja ma pomiar i wskazany plik.

### 1. Pokrycie wiązania intencja↔kod jest niskie i mocno zależne od repozytorium

Na `subactor/platform` `implementation coverage` wynosi **2,4%**, a `aligned`
**10 z 687 tematów**. Dokumentacja jest tam po polsku, a identyfikatory w kodzie
po angielsku, więc heurystyka `module_topic` — wymagająca trzech wspólnych
znormalizowanych tematów — prawie nigdy nie trafia.

To nie jest usterka do naprawienia jedną zmianą. To granica obecnego podejścia:
dopasowanie leksykalne nie przechodzi przez barierę językową ani przez
dokumentację opisującą infrastrukturę zamiast kodu.

**Warunek zamknięcia:** pomiar precision/recall na gold v2 zawierającym trudne
NL (PL/EN, wielozdaniowe, bez ścieżek) i publikacja wyniku osobno dla
dopasowania po celu i po temacie.

### 2. Gold dataset jest za mały, by uzasadnić strojenie progów

Obecnie 9 przypadków ekstrakcji i 7 relacji linkowania, z czego **jedna** klasy
`capability-topic`. Przy takiej próbie 100% precision/recall nie mówi nic o
zachowaniu na nowym repozytorium, a każde obniżenie progu trzech tematów jest
zgadywaniem.

**Warunek zamknięcia:** co najmniej kilkanaście przypadków `capability-topic`,
w tym trudne negatywy tuż pod progiem, oraz `docs prescriptive vs descriptive`
i `partial implement / false DONE`.

### 3. Ścieżka LLM jest zależna od modelu i mierzona ręcznie

`make demollm` przechodzi, ale historia przebiegów pokazała **1 z 6** przed
dodaniem korygującej próby. Model fabrykuje poprawnie sformatowane, nieistniejące
ID rekordów; runtime słusznie je odrzuca. Retry (synteza zadań i podsumowanie)
podniósł skuteczność, lecz:

- nie ma pomiaru, o ile — pojedyncze uruchomienia nie są statystyką;
- gold nie uruchamia realnego wywołania, więc regresja promptu lub modelu
  nie zostanie wykryta przez CI;
- `npm run live:check` jest opt-in i obejmuje dwa etapy z sześciu.

**Warunek zamknięcia:** live check obejmujący wszystkie sześć etapów, z progami
i historią wyniku, uruchamiany harmonogramem.

### 4. Luki w pokryciu języków i formatów

PHP nie ma adaptera AST. Nierozpoznane pliki są raportowane jawnie, więc
narzędzie nie udaje pełnego pokrycia, ale repozytorium z istotną częścią kodu
w PHP dostanie niepełny obraz rzeczywistości.

### 5. Znane defekty semantyczne

- `detectPolarity` traktuje przyimek „without" jak negację zdania: „Document X
  without inventing files" zapisuje się jako intencja negatywna.
- Bare nazwy plików rozwiązują się tylko przy unikalności w repo; `validation.ts`
  czy `types.ts` pozostają niewiązalne bez katalogu. To świadomy kompromis
  precyzji, nie usterka, ale obniża recall.

### 6. Wydajność na dużych repozytoriach nieprzebadana

Brak cache'u AST i chunków dokumentacji po content hash. Największy opisany
tu pomiar gotowości ma 15,9 tys. rekordów, a test przenośności na `domd` około
23,3 tys.; nie wiadomo jeszcze, gdzie leży granica skalowania.

## Ryzyka operacyjne

| Ryzyko | Stan |
|---|---|
| Adapter Java weryfikowany wyłącznie w CI | job Temurin 17 z `T2C_REQUIRE_JAVA_TEST=1`; lokalnie zawsze pomijany |
| Zależność od dostępności providera | testy offline nigdy nie wołają sieci; live check jest osobnym, opt-in jobem |
| Koszt LLM | pełny `make demollm` to ~$0,09 i ~114 tys. tokenów na małym repo; brak ekstrapolacji dla dużych |
| Audyt zależności | `npm audit --omit=dev`: 0 podatności |

## Kryteria wydania

Wersję `0.6.0` uznaję za gotową, gdy:

1. gold v2 publikuje precision/recall osobno dla dopasowania po celu i po
   temacie, na próbie pozwalającej wykryć regresję progu;
2. live check obejmuje sześć etapów LLM i ma zapisaną historię wyniku;
3. `implementation coverage` na repozytorium innym niż własne przekracza próg
   ustalony po pomiarze z punktu 1 — dziś 2,4% jest zbyt niskie, by narzędzie
   było użyteczne bez ręcznej interpretacji.

Punkty 1 i 3 są warunkami merytorycznymi, a punkt 2 techniczno-operacyjnym.

## Reprodukcja

```bash
npm run verify          # 216 testów, 91 modułów, kontrakt .env, workflowy
npm run evaluate:gold   # precision/recall, cytowania, stabilność
npm run examples:check  # pięć SDK, powtarzalny
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

Zakres `--docs` zmienia liczby — trzeba go podawać razem z wynikiem.
