# Intent Evidence DSL (`t2c.intent/v1`)

## Rekord

```json
{
  "schemaVersion": "t2c.intent/v1",
  "id": "INT-TODO-0123456789abcdefabcd",
  "statement": {
    "kind": "todo_item",
    "actor": "team-platform",
    "action": "validate",
    "subject": null,
    "object": "contract before executeContract",
    "target": {
      "paths": ["src/runtime.ts"],
      "symbols": ["executeContract"],
      "tickets": ["T2C-14"],
      "versions": []
    },
    "modality": "required",
    "polarity": "positive",
    "text": "Dodać walidację kontraktu przed executeContract."
  },
  "lifecycle": { "status": "planned" },
  "source": {
    "kind": "todo",
    "path": "TODO.md",
    "lines": { "start": 5, "end": 5 },
    "revision": null,
    "symbol": null,
    "commitIndex": null,
    "extractor": "t2c/markdown-todo-openrouter@1",
    "contentHash": "...",
    "rawExcerpt": "- [ ] Dodać walidację..."
  },
  "epistemic": {
    "class": "plan",
    "confidence": 0.9,
    "basis": ["markdown_checkbox", "openrouter_markdown_enrichment"]
  },
  "observedAt": null,
  "metadata": {
    "checked": false,
    "llmUsed": true,
    "generation": {
      "generator": "t2c/markdown-todo-openrouter",
      "generatorVersion": "1",
      "runtimeVersion": "0.5.0",
      "requested": "llm",
      "used": "llm",
      "degraded": false,
      "fallbackReason": null,
      "provider": "openrouter",
      "model": "qwen/qwen3.7-plus",
      "responseId": "gen-..."
    }
  }
}
```

## Relacje

| Relacja | Interpretacja |
|---|---|
| `plans` | TODO planuje deklarację/ticket |
| `implements` | commit deklaruje implementację planu |
| `evidenced_by` | deklaracja lub claim ma powiązany fakt AST |
| `releases` | changelog publikuje zmianę |
| `documents` | dokumentacja opisuje intencję/zdolność |
| `contradicts` | rekordy mają podobny obiekt i przeciwną polaryzację |
| `duplicates` | prawdopodobne powtórzenie w tym samym rodzaju źródła |
| `same_as` | silna zgodność semantyczna |
| `related_to` | słabsze, ale wystarczające powiązanie |

## Reguły provenance

- Każdy rekord bez wyjątku ma obowiązkowe `metadata.generation`. Runtime i JSON
  Schema odrzucają rekord, który nie wskazuje generatora, jego wersji i wersji
  todo2code.
- `generator` identyfikuje konwerter bez sufiksu wersji, a
  `generatorVersion` przechowuje jego wersję. Przykład deterministyczny:
  `t2c/typescript-ast` + `1`; `provider`, `model` i `responseId` są wtedy
  obowiązkowo `null`.
- Dla `used=llm` pola `provider` i `model` są obowiązkowe, a `responseId`
  wskazuje odpowiedź, jeśli provider go zwrócił. Model pochodzi z odpowiedzi
  providera, z modelem skonfigurowanym jako kontrolowany fallback.
- `runtimeVersion` jest wersją todo2code, która materializowała rekord.
- Fallback zachowuje deterministyczny generator, ustawia `requested=llm`,
  `used=deterministic`, `degraded=true` oraz obowiązkowy `fallbackReason`.
- LLM nie może zmienić `source.path`, `source.lines`, `source.extractor` ani `epistemic.class` ustawianych przez runtime.
- `fact` jest zarezerwowany dla obserwacji deterministycznych.
- Commit message i changelog są `claim`, nawet gdy brzmią jak zakończona praca.
- Rekord wygenerowany przez LLM ma klasę `llm_inference` i podlega pułapowi
  confidence zależnemu od tego, jak ustrukturyzowane było źródło. Pułap nigdy nie
  sięga poziomu obserwacji deterministycznej:

  | Ekstraktor | Źródło | Pułap |
  |---|---|--:|
  | `t2c/markdown-openrouter@1` | TODO/CHANGELOG — wzbogacenie pozycji o znanej strukturze | `0.94` |
  | `t2c/nl-openrouter@1` | polecenie/ticket — proza o swobodnej formie | `0.90` |
  | `t2c/docs-openrouter@1` | dokumentacja — wnioskowanie z najdłuższego kontekstu | `0.85` |

  Dla porównania: fakt AST ma `1.0`, a deterministyczna pozycja TODO do `0.98`.
  Im mniej struktury w źródle, tym niższy sufit.
- Rekord NL z LLM nie może przekroczyć confidence `0.9`, a runtime wymusza lifecycle `proposed` niezależnie od odpowiedzi modelu.
- W TODO/CHANGELOG LLM nie może zmienić checkboxa, lifecycle, modality, wersji, daty, kategorii, source ani klasy `plan`/`claim`; confidence wzbogacenia nie przekracza `0.94`.
- `metadata.generation` jest polem runtime-owned; dane zwrócone przez model nie
  mogą go nadpisać.
- Brak pola pozostaje brakiem; system nie tworzy ukrytego faktu.

Runtime nie ufa samemu typowaniu TypeScript. Przed zbudowaniem grafu i na
publicznych granicach sprawdza kompletne obiekty, dozwolone enumy, zakresy
confidence i linii, format ID/hash/czasu, unikalność list, końce relacji oraz
zgodność statystyk grafu. Nieznane pola są odrzucane. Statyczne odpowiedniki
kontraktów znajdują się w `schemas/`.

Standalone ekstrakcje NL, TODO/CHANGELOG, komunikacji i dokumentacji zwracają `audit` z
wersją runtime, statusem, requested/effective mode, modelem, przyczyną
degradacji, metadanymi odpowiedzi oraz bezpiecznymi parametrami konfiguracji.
Klucz API nie jest częścią audytu.

## Ugruntowane wnioski (`t2c.conclusion/v1`)

Wniosek jest strukturalnym wynikiem analizy grafu i diagnostyki, a nie
swobodnym tekstem raportu. Minimalny poprawny obiekt wygląda tak:

```json
{
  "schemaVersion": "t2c.conclusion/v1",
  "id": "CONC-56103ade87e7fd328142",
  "kind": "finding",
  "title": "Brakuje dowodu implementacji",
  "detail": "Plan nie ma powiązanego rekordu Git ani AST.",
  "severity": "warning",
  "diagnosticIds": ["DIAG-0123456789abcdefabcd"],
  "recordIds": ["INT-TODO-0123456789abcdefabcd"],
  "confidence": 0.94,
  "generation": {
    "generator": "t2c/grounded-summary",
    "generatorVersion": "1",
    "runtimeVersion": "0.5.0",
    "generatedAt": "2026-07-29T12:00:00.000Z",
    "requestedMode": "require-llm",
    "effectiveMode": "llm",
    "degraded": false,
    "model": "qwen/qwen3.7-plus",
    "provider": "openrouter",
    "responseId": "generation-id",
    "configurationFingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "reason": null
  }
}
```

`id` jest skrótem stabilnego, kanonicznego zestawu `kind`, treści, severity i
cytowań. Czas generacji, model oraz confidence nie zmieniają tożsamości
semantycznej. Runtime odrzuca wniosek, jeżeli nie cytuje co najmniej jednej
istniejącej diagnostyki i jednego istniejącego rekordu z grafu, raport
diagnostyczny ma inny fingerprint lub ID nie odpowiada treści.

Etap podsumowania żąda od modelu wyłącznie pól semantycznych w structured
output. Runtime nadaje ID i provenance, odrzuca nieznane cytowania oraz waliduje
każdy obiekt tym kontraktem. Dopiero wtedy renderuje `team-summary.md`;
kanoniczna tablica wniosków pozostaje w `summary-conclusions.json`.

## Propozycje zadań (`t2c.todo-proposal/v1`)

Propozycja zadania ma zawsze `status: proposed`, priorytet `P0`–`P3`, target,
co najmniej jedno kryterium akceptacji oraz cytowania wniosku, diagnostyki i
rekordu intencji. `dependencies` zawiera stabilne ID innych propozycji:

```json
{
  "schemaVersion": "t2c.todo-proposal/v1",
  "id": "TPROP-237b3465ea484544f906",
  "title": "Dodać syntezę zadań",
  "description": "Wytworzyć propozycje z grafu i diagnostyki.",
  "priority": "P0",
  "status": "proposed",
  "target": {
    "paths": ["src/synthesis/tasks.ts"],
    "symbols": ["synthesizeTodoProposals"],
    "tickets": ["T2C-101"],
    "versions": []
  },
  "acceptanceCriteria": ["Niepoprawne cytowanie jest odrzucane."],
  "dependencies": [],
  "conclusionIds": ["CONC-56103ade87e7fd328142"],
  "diagnosticIds": ["DIAG-0123456789abcdefabcd"],
  "recordIds": ["INT-TODO-0123456789abcdefabcd"],
  "confidence": 0.9,
  "generation": {
    "generator": "t2c/task-synthesis",
    "generatorVersion": "1",
    "runtimeVersion": "0.5.0",
    "generatedAt": "2026-07-29T12:00:00.000Z",
    "requestedMode": "prefer-llm",
    "effectiveMode": "deterministic",
    "degraded": true,
    "model": null,
    "provider": null,
    "responseId": null,
    "configurationFingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "reason": "openrouter_timeout"
  }
}
```

Fallback nie może udawać wyniku semantycznej syntezy. Dla
`requestedMode=prefer-llm` wynik deterministyczny musi mieć `degraded=true` i
niepusty `reason`; `require-llm` nigdy nie dopuszcza wyniku deterministycznego.
Dla każdego wyniku wymagane są `generator` i `generatorVersion`; dla
rzeczywistego wyniku LLM wymagane są dodatkowo `model` i `provider`.
Opublikowane
schematy to `schemas/conclusion.schema.json` i
`schemas/todo-proposal.schema.json`; walidacja kontekstowa i stabilne ID są w
`src/core/schema.ts` oraz `src/core/id.ts`.

### Audytowana synteza grafu do zadań

`synthesizeTodoProposals(graph, diagnostics, config, mode)` jest jedyną
semantyczną ścieżką tworzącą te dwa kontrakty. Do modelu trafia ograniczony,
priorytetyzowany fragment grafu, diagnostyki z ich oryginalnymi ID i istniejące
rekordy TODO. Model zwraca lokalne klucze do wiązania obiektów; runtime:

- tworzy stabilne `CONC-*` i `TPROP-*`, normalizuje target i ustawia
  `status=proposed`;
- dołącza wersję runtime, fingerprint bezpiecznej konfiguracji oraz metadane
  odpowiedzi OpenRouter;
- sprawdza wszystkie cytowania względem konkretnego grafu i raportu oraz
  wymaga, aby dowody taska mieściły się w jego cytowanych wnioskach;
- odrzuca nieznane/zdublowane klucze, nieznane zależności i cały wynik, gdy
  choć jeden obiekt jest niepoprawny.

Po walidacji `validation` rozdziela `orderedProposalIds`, `newProposalIds` i
`duplicateProposalIds`. Dla każdego duplikatu `duplicates` wskazuje istniejące
ID rekordów TODO oraz deterministyczną podstawę, np. `shared_ticket_and_text`,
`shared_symbol_and_text` albo próg podobieństwa treści. `newProposalIds` jest
gotową listą po deduplikacji; pełne `proposals` pozostaje w wyniku jako ślad
audytowy. Kolejność jest topologiczna (zależność zawsze przed zadaniem), a wśród
gotowych węzłów rozstrzyga `P0` → `P3` i stabilne ID. Cykle, self-dependency,
nieznane zależności, puste lub powtórzone po trimowaniu kryteria akceptacji są
odrzucane.

Tryb `require-llm` zgłasza `TaskSynthesisRequiredError` zawierający audit
`failed`. Tryb `prefer-llm` nie zamienia diagnostyki w pozornie semantyczne
zadania: przy braku konfiguracji, timeoutcie lub błędnej odpowiedzi zwraca puste
`conclusions` i `proposals`, a jedynie `rawDiagnosticActions` skopiowane z
`suggestedAction`; audit ma wtedy `status=fallback`, `degraded=true` i kod
przyczyny. Model etapu wybiera `OPENROUTER_TASK_MODEL`, z fallbackiem
konfiguracyjnym do `OPENROUTER_MODEL`.

## Patch TODO (`t2c.todo-patch/v1`)

Renderer przyjmuje wyłącznie `validation.newProposalIds` w ustalonej wcześniej
kolejności topologicznej. Duplikaty nie trafiają do Markdownu, ale pozostają w
audytowym JSON jako `duplicateProposalIds` i `duplicates` wraz z ID istniejących
rekordów oraz podstawą klasyfikacji. Kontrakt `schemas/todo-patch.schema.json`
zawiera ponadto:

- hash dokładnej treści źródłowego `TODO.md`;
- fingerprint grafu i deterministyczny fingerprint diagnostyki;
- wybrane ID propozycji i pełny audit etapu syntezy (runtime/model/response);
- SHA-256 dokładnej treści reviewowalnego `TODO.patch`.

Markdown pokazuje opis, kryteria akceptacji, targety, zależności oraz ID
wniosków, diagnostyk i rekordów. Samo tworzenie i zapis artefaktów nigdy nie
zmienia `TODO.md`.

Zastosowanie wymaga jawnego `{ actor, patchHash }`. Runtime ponownie hashuje
patch, sprawdza niezmieniony hash źródłowego TODO i pod blokadą zapisuje wynik
przez plik tymczasowy + `fsync` + atomowy rename. Receipt
`t2c.todo-apply-receipt/v1` zachowuje aktora i czas akceptacji/zastosowania,
hash źródła, patcha i wyniku oraz wybrane ID. Ponowne wywołanie z tym samym
receiptem jest no-op; brak receipt po udanym rename można odzyskać tylko wtedy,
gdy bieżący plik kończy się dokładnym patchem, a hash odtworzonego prefiksu jest
hashem źródła. Stary source, zmieniony patch, niewłaściwa zgoda lub późniejsza
zmiana TODO są odrzucane i wymagają nowego renderowania/review.

CLI udostępnia trzy osobne granice: `propose-todo`, `render-todo` i
`apply-todo`; identyczne akcje `propose_todo`, `render_todo`, `apply_todo` są
dostępne przez service, MCP, A2A i pięć SDK. Wszystkie ścieżki wejścia/wyjścia
podlegają ograniczeniu `T2C_ROOT`, a apply wymaga aktora i dokładnego
`approvalHash`.

Główny pipeline z `taskSynthesisMode=prefer-llm|require-llm` zapisuje
`task-synthesis.json`, `todo-validation.json`, `TODO.patch` i
`TODO.patch.json` oraz rejestruje je w `manifest.files`. Pipeline wyłącznie
przygotowuje materiał do review. Receipt pojawia się w manifeście dopiero po
osobnym, zatwierdzonym apply.

## Plan zmiany kodu i acceptance

`t2c.code-change-plan/v1` jest deterministycznym, nieexecutowalnym mostem od
`PLANNED_NOT_IMPLEMENTED` lub `CHANGELOG_WITHOUT_IMPLEMENTATION` do review
zmiany kodu. Plan wymaga ugruntowanych `recordIds` i `diagnosticIds`, dokładnych
`target.paths`, kryteriów akceptacji, risk/rollback, content-bound `id`/hash i
pełnej `generation`. `changes[].path` musi należeć do `target.paths`; runtime
odrzuca traversal, obcy fingerprint, tampering i brak provenance.

`t2c.code-change-acceptance/v1` porównuje diagnostykę przed i po zewnętrznej
implementacji. `accepted=true` wymaga usunięcia wszystkich diagnostyk planu i
braku nowych `blocking`. Artefakt sam ma deterministyczną `generation` i nie
nadaje statusu `DONE`.

`t2c.code-change-review/v1` to hash-bound brief Markdown (`CODE_CHANGE.review.md`)
plus audit JSON — projekcja planów do review, nie apply źródeł. Pipeline zapisuje
plan set i review w każdym udanym runie. Schematy leżą w
`schemas/code-change-{plan,plan-set,acceptance,review}.schema.json`; przebieg i
diagram opisuje [`CODE_CHANGE_PLANS.md`](CODE_CHANGE_PLANS.md).

`target.paths` w Intent DSL jest zarezerwowane dla ścieżek repozytorium.
Runtime odrzuca trasy HTTP (`/api/...`), ścieżki hosta (`/var/run/...`) i
traversal `..` zarówno przy ekstrakcji NL, jak i przy materializacji planów
zmiany kodu. Hostnames (`logo.example.com`) nie trafiają do `target.symbols`.

## Audyt runu (`t2c.run/v1`)

Manifest jest częścią dowodu wykonania, nie tylko indeksem plików. Zawiera:

- `status: succeeded|degraded|failed`; failed-run ma `graphFingerprint=null`,
  nie publikuje grafu ani `latest.json` i wskazuje etap/kod awarii;
- `runtime.name` i `runtime.version`;
- bezpieczny `configuration` bez tokenów i kluczy oraz jego SHA-256 fingerprint;
- statusy etapów NL, Markdown, komunikacji, dokumentacji, syntezy zadań i podsumowania: `succeeded`, `partial`,
  `fallback`, `failed` albo `skipped`;
- requested/effective mode, model, czas, liczbę rekordów/ostrzeżeń i strukturalny
  powód degradacji;
- odpowiedzi LLM z dostępnymi `responseId`, resolved model/provider,
  prompt/completion/total tokens i cost;
- wersję runtime oraz bezpieczne parametry adapterów i budżetów dokumentacji.

Każdy błąd po utworzeniu katalogu runu — nie tylko `require-llm` — zapisuje
manifest `failed` z aktywnym etapem. Ukończone audyty pozostają zachowane,
etapy niewykonane są oznaczone jako przerwane, a `latest.json` nie wskazuje
niepełnego przebiegu.

Historyczne manifesty sprzed rozszerzenia nadal są czytane przez API; UI oznacza
ich status jako `legacy`.

## Diff grafów (`t2c.diff/v1`)

Diff zachowuje fingerprint grafu wcześniejszego i późniejszego oraz rozdziela rekordy na `added`, `removed`, `changed` i `unchanged`. Zmiana jest rozpoznawana po stabilnej tożsamości źródła (`kind`, ścieżka, linie, symbol i rodzaj statementu), dzięki czemu zmiana treści rekordu nie jest błędnie raportowana jako niezależne usunięcie i dodanie. Relacje są porównywane deterministycznie po końcach, typie, confidence i basis.

SVG jest wyłącznie projekcją `t2c.diff/v1`; nie jest źródłem danych i nie wpływa na fingerprint diffu.

## Diff plików (`t2c.filediff/v1`)

Deterministyczny algorytm Myersa porównuje linie bez LLM i zwraca hunki z numerami linii oraz podsumowaniem `added`, `removed`, `unchanged`. Ten sam model zasila unified diff, boczny widok SVG i HTML oraz tryb porównania Git. Dla bardzo dużego środka pliku runtime przechodzi na ograniczoną pamięciowo reprezentację blokowej zamiany i oznacza wynik jako `truncated`.

## Intent vs reality (`t2c.reality/v1`)

Widok zestawia źródła deklaratywne (`nl`, `todo`, `document`, `agent_log`) z dowodami wykonania (`git`, `ast`) i changelogiem. Każdy temat ma jawne liczniki per źródło oraz status, m.in. `aligned`, `planned_not_implemented`, `implemented_not_planned`, `implemented_not_documented` lub `conflicting`. SVG i Markdown są projekcjami tego samego deterministycznego modelu.

## Analiza komunikacji (`t2c.communication-analysis/v1`)

Rekordy z `project/<ticket>/` używają `source.kind=agent_log`. Runtime zachowuje
`metadata.participant`, `participantRole`, `messageType`, `ticket`, `recipient`
i `gitAuthors`. Gdy istnieje `project/participants.json`, rekord zawiera też
runtime-owned `participantId`, `displayName`, `a2aAgentIds`, `humanAliases`,
`identityResolved` i `identitySource`; display name nigdy nie jest używana do
zgadywania stabilnego ID. Polecenia człowieka są deklaracjami, plany pozostają planami, a
raporty agentów są claimami — nigdy faktami implementacji.

Opcjonalne wzbogacanie tworzy `t2c.participant-synthesis/v1`: runtime nadaje
ID, participant, rolę i tickety oraz mapuje cytowania na finalne ID
`agent_log`; model dostarcza wyłącznie summary, commitments, risks i
confidence. Analizator odrzuca cytowanie nieistniejącego rekordu, innego
uczestnika lub ticketu. Schemat jest publikowany w
`schemas/participant-synthesis.schema.json`.

Projekcja komunikacji grupuje każdego uczestnika osobno i zapisuje liczbę
deklaracji, planów, claimów, dopasowanych commitów, dowodów oraz identyfikatory
problemów. Problemy zawsze wskazują rekordy źródłowe i obejmują konflikty
między ludźmi/agentami, brak odpowiedzi, pracę poza requestem, brak dowodu
wykonania oraz nierozpoznaną tożsamość. Szczegółowy format wejściowy opisuje
[`TEAM_COMMUNICATION.md`](TEAM_COMMUNICATION.md).

Główny pipeline domyślnie dołącza `communication.intent.jsonl` do grafu oraz
zapisuje `communication-analysis.json` i `.md` w runie. Każdy issue otrzymuje
uziemioną diagnostykę cytującą oryginalne `agent_log` ID, dzięki czemu może być
wejściem task synthesis. Intent-vs-Reality pokazuje osobną lane `AGENT_LOG`;
rekord agenta o klasie `claim` nigdy nie jest zaliczany do faktów Git/AST.
Historia i UI filtrują runy po participant/role/ticket/severity, a porównanie
grafów może ograniczyć diff do tego samego zakresu komunikacji.

## Origin vs workspace (`t2c.workspace-comparison/v1`)

Format wiąże pełny SHA bazy z HEAD i stanem roboczym, przechowuje `ahead`,
`behind`, listę plików zmienionych przed analizą, pełny `t2c.diff/v1` oraz
metryki pokrycia obu stron. `trend.direction` jest `improved`, `regressed`,
`mixed` lub `unchanged` na podstawie zmian pełnego wyrównania, pokrycia
implementacji/planów/dokumentacji i liczby gaps.
