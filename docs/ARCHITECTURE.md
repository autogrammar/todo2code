# Architektura todo2code

## Przepływ

```mermaid
flowchart LR
    NL[NL / ticket] --> NLE[NL heuristic extractor]
    GIT[Last N commits] --> GE[Git extractor]
    CODE[TS JS Python tree] --> AE[AST extractors]
    TODO[TODO.md] --> ME[Markdown extractor]
    CHG[CHANGELOG.md] --> ME
    DOCS[README ADR MODULE docs] --> ORE[OpenRouter document extractor]

    NLE --> DSL[Canonical t2c Intent DSL]
    GE --> DSL
    AE --> DSL
    ME --> DSL
    ORE --> DSL

    DSL --> LINK[Deterministic linker]
    LINK --> GRAPH[Intent evidence graph]
    GRAPH --> DIAG[Deterministic diagnostics]
    GRAPH --> SUM[OpenRouter summarizer]
    DIAG --> SUM
    SUM --> REPORT[Grounded team report]

    CLI --> NLE
    MCP --> CLI
    A2A --> CLI
```

## Komponenty

### `src/extractors/nl.ts`

Segmentuje linie i zdania, rozpoznaje modalność, negację, akcję, obiekt, ścieżki, symbole, tickety i wersje. Może użyć lokalnego klasyfikatora TensorFlow, lecz nigdy nie korzysta z OpenRouter.

### `src/extractors/git.ts`

Czyta ostatnie N commitów, autorów, timestampy, message/body, statusy plików, numstat i diff. Każdy commit ma oddzielny rekord; commit dokumentacyjny nie znika, tylko dostaje `docOnly=true`.

### `src/extractors/ast.ts`, `python/ast_extract.py` i `golang/ast_extract.go`

TypeScript Compiler API dostarcza fakty o importach, eksportach, symbolach i wywołaniach. Python używa standardowego `ast` (`python/ast_extract.py`), a Go standardowego `go/ast` (`golang/ast_extract.go`, uruchamiane przez `go run`). Każdy adapter zwraca tę samą kopertę JSON `{facts, warnings}`, więc dodanie kolejnego języka nie zmienia rdzenia. Adaptery są opcjonalne: brak toolchainu daje ostrzeżenie, nie błąd. AST jest faktem o stanie implementacji, a nie intencją człowieka.

### `src/extractors/markdown.ts`

TODO i CHANGELOG są parsowane osobno. Checkbox określa lifecycle planu, a wersja i kategoria changelogu określają claim wydania.

### `src/extractors/docs-llm.ts`

Dokumentacja jest dzielona według nagłówków i limitu znaków. OpenRouter zwraca strukturalny JSON. Runtime nadpisuje źródło, ogranicza zakres linii i confidence, dlatego model nie może podmienić provenance.

### `src/graph/linker.ts`

Kandydaci są indeksowani po ticketach, symbolach, ścieżkach i tokenach obiektu. Linker przyznaje punkty za dowody i tworzy relacje deterministycznie. Nie wykonuje zapytań sieciowych.

### `src/graph/diagnostics.ts`

Porównuje plany, claimy Git/CHANGELOG i fakty AST. Wynik nie zatwierdza pracy — identyfikuje ryzyka i wymagane decyzje.

### `src/summary/summarizer.ts`

Do OpenRouter trafia wyłącznie skompaktowany graf i diagnostyka. Surowy kod, diff i pełne dokumenty nie są wejściem summarizera.

### Trwałość tasków A2A

`src/interfaces/a2a.ts` utrzymuje szybki store pamięciowy, a po ustawieniu
`T2C_A2A_TASK_STORE` otacza operacje transakcją plikową. Snapshot zawiera taski
wraz z właścicielem, historią i artefaktami; indeks idempotency jest odtwarzany
z wiadomości użytkownika. Blokada katalogowa koordynuje repliki, a zapis przez
plik tymczasowy i `rename` zapobiega częściowym snapshotom po awarii procesu.
Ścieżka jest sprawdzana względem `T2C_ROOT` również pod kątem symlinków.

### `src/watch/watcher.ts` i `src/core/ignore.ts`

Watcher cyklicznie buduje posortowany snapshot `mtime:size`, nie korzysta z
platformowo zależnego rekursywnego `fs.watch`. Katalogi wykluczone przez
`.gitignore`, `.dockerignore` i `.intentignore` są odcinane przed wejściem do
drzewa, a symlinki pomijane. Osobny interwał skanowania wykrywa zmiany, natomiast
minimalny interwał raportu agreguje je i ogranicza koszt pipeline'u oraz LLM.

## Zaufanie do źródeł

Rekord nie jest „prawdą” bez kontekstu epistemicznego:

1. `declaration` — polecenie/ticket;
2. `plan` — TODO;
3. `fact` — AST;
4. `claim` — Git i CHANGELOG;
5. `llm_inference` — interpretacja dokumentacji przez OpenRouter.

System zachowuje różnicę między planem, twierdzeniem autora i stanem kodu. Relacja nie zmienia klasy epistemicznej rekordów.

## Determinizm

Identyfikatory i fingerprint grafu bazują na SHA-256 stabilnie serializowanych danych. `observedAt` i timestamp runu mogą się zmieniać; treść rekordów dla tego samego wejścia pozostaje stabilna. TensorFlow jest opcjonalny, dlatego powtarzalność wymaga przypiętego modelu i słownika.
