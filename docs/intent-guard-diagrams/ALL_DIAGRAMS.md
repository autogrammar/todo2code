# Diagramy działania systemu Intent Guard

Pakiet zawiera aktualne diagramy zgodne z najnowszymi zasadami:

- intencję podaje użytkownik;
- AI generuje TODO;
- człowiek zatwierdza TODO;
- agent sam uruchamia paczkę zgodnie z instrukcjami projektu;
- paczka nie uruchamia agentów i nie definiuje zakresu zadania;
- minimum trzy niezależne DSL-e są generowane z różnych źródeł;
- DSL-e są konsolidowane do DSL 4;
- wszystkie oficjalne zmiany wymagają zatwierdzenia człowieka;
- TODO, CHANGELOG i VERSION są chronione bramką;
- system działa przyrostowo i przygotowuje patche zamiast samodzielnie zatwierdzać dokumentację.

## 1. 01 Overall Process

```mermaid
flowchart TD
    U[Użytkownik przekazuje intencję] --> AITODO[AI generuje TODO i kryteria]
    AITODO --> H1[Człowiek zatwierdza TODO]
    H1 --> AG[Agent rozpoczyna pracę]
    AG --> START[Agent uruchamia intent-guard start]
    START --> WORK[Agent realizuje mały podpunkt]
    WORK --> CHECK[intent-guard checkpoint]
    CHECK --> CONS[Generowanie i konsolidacja DSL]
    CONS --> DEC{Decyzja bramki}

    DEC -->|ALLOW_CHECKPOINT| NEXT[Kolejny podpunkt]
    NEXT --> WORK

    DEC -->|REVIEW_REQUIRED| REVIEW[Człowiek przegląda raport i patch]
    DEC -->|BLOCK_STAGE| STOP[Praca zatrzymana]
    DEC -->|BLOCK_RELEASE| STOP

    REVIEW -->|zaakceptuj| APPLY[Zastosowanie zatwierdzonych zmian]
    REVIEW -->|popraw| REWORK[Agent poprawia kod lub TODO]
    REWORK --> WORK

    APPLY --> FINAL{Koniec etapu?}
    FINAL -->|nie| NEXT
    FINAL -->|tak| RELEASE[intent-guard release-check]
    RELEASE --> H2[Człowiek zatwierdza TODO, CHANGELOG i VERSION]
```

## 2. 02 Three Source Dsls And Consolidation

```mermaid
flowchart TD
    CODE[Kod, AST, graf zależności, testy] --> DSL1[DSL 1: Code Reality]
    GIT[3 commity kodowe + 10 zmian kontekstu] --> DSL2[DSL 2: Change Intent]
    INTENT[Intencja użytkownika + AI TODO + ticket + dokumenty] --> DSL3[DSL 3: Declared Intent]
    AI[AI-*.md, logs.txt, wyniki testów] --> DSLE[Opcjonalny DSL: Execution Evidence]

    DSL1 --> NORM[Normalizacja encji i relacji]
    DSL2 --> NORM
    DSL3 --> NORM
    DSLE --> NORM

    NORM --> DSL4[DSL 4: Consolidated Project State]
    DSL4 --> FINDINGS[Konflikty, regresje, braki, drift]
    DSL4 --> GATE[ALLOW / REVIEW / BLOCK]
    DSL4 --> PATCH[Propozycje aktualizacji Markdown]
```

## 3. 03 Code Reality Dsl

```mermaid
flowchart LR
    FILES[Pliki projektu] --> DETECT[Wykrycie języków]
    DETECT --> ADAPTERS[Wybór adapterów]
    ADAPTERS --> TS[TypeScript Compiler API]
    ADAPTERS --> PY[Python AST]
    ADAPTERS --> SCIP[SCIP]
    ADAPTERS --> TREE[Tree-sitter fallback]
    ADAPTERS --> GENERIC[Adapter generyczny]

    TS --> FACTS[Fakty techniczne]
    PY --> FACTS
    SCIP --> FACTS
    TREE --> FACTS
    GENERIC --> FACTS

    FACTS --> SYMBOLS[Symbole i publiczne API]
    FACTS --> IMPORTS[Importy i zależności]
    FACTS --> CALLS[Graf wywołań]
    FACTS --> TESTMAP[Powiązania testów]
    FACTS --> HASHES[Hashe symboli i modułów]

    SYMBOLS --> DSL1[DSL 1: Code Reality]
    IMPORTS --> DSL1
    CALLS --> DSL1
    TESTMAP --> DSL1
    HASHES --> DSL1
```

## 4. 04 Change Intent Dsl

```mermaid
flowchart TD
    LOG[Historia Git] --> FILTER[Odfiltrowanie zmian bez kodu]
    FILTER --> LAST3[3 ostatnie commity kodowe]
    FILTER --> LAST10[10 ostatnich istotnych zmian]

    LAST3 --> DIFF[Semantic diff AST przed i po]
    DIFF --> SYMBOLS[Zmiany symboli]
    DIFF --> CALLS[Zmiany ścieżek wywołań]
    DIFF --> TESTS[Dodane i usunięte testy]
    LAST3 --> CLAIMS[Deklaracje z commit message]

    LAST10 --> DIRECTION[Kontekst kierunku projektu]
    LAST10 --> REVERTS[Wykrycie cofanych decyzji]

    SYMBOLS --> INFER[Wniosek o intencji zmiany]
    CALLS --> INFER
    TESTS --> INFER
    CLAIMS --> INFER
    DIRECTION --> INFER
    REVERTS --> INFER

    INFER --> DSL2[DSL 2: Change Intent]
```

## 5. 05 Declared Intent Dsl

```mermaid
flowchart TD
    USER[Intencja użytkownika] --> TODOAI[AI generuje TODO]
    TODOAI --> HUMAN[Człowiek zatwierdza TODO]

    USER --> PARSE[Parser intencji]
    TODOAI --> PARSE
    TICKET[Ticket i kryteria] --> PARSE
    DOCS[README, MODULE, ADR, manifest] --> PARSE
    HUMAN --> PARSE

    PARSE --> GOAL[Cel]
    PARSE --> SCOPE[Zakres i poza zakresem]
    PARSE --> CRITERIA[Kryteria akceptacji]
    PARSE --> EVIDENCE[Wymagane dowody]
    PARSE --> AMBIG[Braki i niejednoznaczności]

    GOAL --> DSL3[DSL 3: Declared Intent]
    SCOPE --> DSL3
    CRITERIA --> DSL3
    EVIDENCE --> DSL3
    AMBIG --> DSL3
```

## 6. 06 Reconciliation Engine

```mermaid
flowchart TD
    DSL1[Code Reality] --> ALIGN[Mapowanie encji]
    DSL2[Change Intent] --> ALIGN
    DSL3[Declared Intent] --> ALIGN
    DSLE[Execution Evidence] --> ALIGN

    ALIGN --> C1[Porównanie wymagania z kodem]
    ALIGN --> C2[Porównanie commita z diffem]
    ALIGN --> C3[Porównanie deklaracji agenta z dowodami]
    ALIGN --> C4[Porównanie stanu z poprzednim snapshotem]

    C1 --> CLASS[Klasyfikacja]
    C2 --> CLASS
    C3 --> CLASS
    C4 --> CLASS

    CLASS --> ALIGNED[ALIGNED]
    CLASS --> MISSING[IMPLEMENTATION_MISSING]
    CLASS --> FALSE[FALSE_COMPLETION]
    CLASS --> REG[REGRESSION_DETECTED]
    CLASS --> DRIFT[DIRECTION_DRIFT]
    CLASS --> DOC[STALE_DOCUMENTATION]
    CLASS --> DUP[DUPLICATED_INTENT]
    CLASS --> CONFLICT[INTENT_CONFLICT]
    CLASS --> UNKNOWN[INSUFFICIENT_EVIDENCE]

    ALIGNED --> DSL4[DSL 4: Consolidated Project State]
    MISSING --> DSL4
    FALSE --> DSL4
    REG --> DSL4
    DRIFT --> DSL4
    DOC --> DSL4
    DUP --> DSL4
    CONFLICT --> DSL4
    UNKNOWN --> DSL4
```

## 7. 07 Agent Checkpoint Flow

```mermaid
flowchart TD
    TASK[Agent wybiera jeden podpunkt TODO] --> PERMIT[Scoped work permit]
    PERMIT --> EDIT[Zmiana kodu w dozwolonym zakresie]
    EDIT --> TEST[Uruchomienie testów]
    TEST --> CHECK[intent-guard checkpoint]

    CHECK --> DSL[Generowanie DSL 1, 2, 3 i DSL 4]
    DSL --> DEC{Zgodność z intencją?}

    DEC -->|tak| ACCEPT[Checkpoint techniczny]
    DEC -->|niepewne| REVIEW[REVIEW_REQUIRED]
    DEC -->|nie| BLOCK[BLOCK_STAGE]

    ACCEPT --> MORE{Kolejny podpunkt?}
    MORE -->|tak| TASK
    MORE -->|nie| FULL[Walidacja całego etapu]

    REVIEW --> HUMAN[Człowiek zatwierdza lub odrzuca]
    BLOCK --> HUMAN
    HUMAN -->|popraw| TASK
    HUMAN -->|zaakceptuj wyjątek| ACCEPT
```

## 8. 08 Protected Files And Release Gate

```mermaid
flowchart TD
    WORK[Praca nad kodem] --> VERIFY[intent-guard verify-stage]
    VERIFY --> STATUS{Wynik etapu}

    STATUS -->|FAILED| BLOCK[Blokada]
    STATUS -->|PARTIAL| REVIEW[Review required]
    STATUS -->|VERIFIED| PROPOSAL[Tryb proposal-only]

    BLOCK --> P1[TODO bez finalnego DONE]
    BLOCK --> P2[CHANGELOG zablokowany]
    BLOCK --> P3[VERSION zablokowana]
    BLOCK --> P4[Brak przejścia dalej]

    REVIEW --> HUMAN[Człowiek przegląda raport]
    PROPOSAL --> PATCH[Patche TODO / CHANGELOG / VERSION]
    PATCH --> HUMAN

    HUMAN -->|zatwierdzenie| APPLY[intent-guard apply]
    HUMAN -->|odrzucenie| REWORK[Powrót do pracy]

    APPLY --> DONE[Oficjalna aktualizacja plików]
```

## 9. 09 Markdown Synchronization

```mermaid
flowchart LR
    AST[AST i graf kodu] --> FACTS[Fakty techniczne]
    GIT[Git i semantic diff] --> FACTS
    TESTS[Testy] --> FACTS
    DSL4[DSL 4] --> FACTS

    FACTS --> GEN[Generator dokumentacji]
    GEN --> AUTO[Automatyczne sekcje AUTO]
    GEN --> PATCH[Proponowane patche]
    GEN --> REPORT[Raport zgodności]

    AUTO --> MODULE[MODULE.md]
    AUTO --> MAP[PROJECT_MAP.md]
    AUTO --> TECH[Techniczne sekcje ticketu]

    PATCH --> TODO[TODO.md]
    PATCH --> CHANGELOG[CHANGELOG.md]
    PATCH --> VERSION[VERSION]
    PATCH --> ARCH[ARCHITECTURE.md]

    MODULE --> HUMAN[Human approval]
    MAP --> HUMAN
    TECH --> HUMAN
    TODO --> HUMAN
    CHANGELOG --> HUMAN
    VERSION --> HUMAN
    ARCH --> HUMAN

    HUMAN --> APPLY[Zastosowanie zatwierdzonego patcha]
```

## 10. 10 Hash And Approval Invalidation

```mermaid
flowchart TD
    FILES[Pliki] --> FH[File hashes]
    FH --> SH[Symbol hashes]
    SH --> MH[Module hashes]
    MH --> GH[Architecture graph hash]

    INTENT[Intencja i TODO] --> IH[Intent hash]
    TESTS[Testy i wyniki] --> EH[Evidence hash]
    GIT[Commit i diff] --> EH

    GH --> SNAP[Evidence snapshot]
    IH --> SNAP
    EH --> SNAP

    SNAP --> APPROVAL[Human approval]
    APPROVAL --> VALID{Hashe bez zmian?}

    VALID -->|tak| ACTIVE[Approval active]
    VALID -->|nie| INVALID[APPROVAL_INVALIDATED]
    INVALID --> REVIEW[Ponowna weryfikacja człowieka]
```

## 11. 11 Background Incremental Monitor

```mermaid
sequenceDiagram
    participant Agent
    participant Watcher as Git/File watcher
    participant Index as Structural index
    participant Rules as Reconciliation engine
    participant LLM as LLM inference
    participant Human

    Agent->>Watcher: zmiana kodu lub dokumentu
    Watcher->>Index: wykryj zmienione pliki
    Index->>Index: AST diff, aktualizacja grafu i hashy
    Index->>Rules: fakty techniczne

    alt potrzebna interpretacja semantyczna
        Rules->>LLM: ograniczony kontekst
        LLM->>Rules: hipoteza + confidence + evidence
    end

    Rules->>Rules: porównanie z intencją i historią

    alt brak istotnego konfliktu
        Rules->>Agent: checkpoint możliwy
    else konflikt lub brak dowodów
        Rules->>Human: raport, alert i proponowany patch
    end
```

## 12. 12 Universal Package Architecture

```mermaid
flowchart TD
    CLI[intent-guard CLI] --> CORE[Python Core]
    CORE --> MODEL[Pydantic Intent Evidence DSL]
    CORE --> PLUGINS[Pluggy Plugin Manager]
    CORE --> STORE[SQLite Evidence Store]
    CORE --> GRAPH[NetworkX / własny graf]
    CORE --> MD[Markdown Patch Generator]
    CORE --> APPROVAL[Human Approval Engine]

    PLUGINS --> GIT[Git adapter]
    PLUGINS --> MARKDOWN[Markdown adapter]
    PLUGINS --> TESTS[Test results adapter]
    PLUGINS --> TREE[Tree-sitter adapter]
    PLUGINS --> SCIP[SCIP adapter]
    PLUGINS --> TS[TypeScript adapter]
    PLUGINS --> PY[Python adapter]
    PLUGINS --> JAVA[Java adapter]
    PLUGINS --> DOTNET[C# adapter]
    PLUGINS --> RUST[Rust adapter]
    PLUGINS --> GENERIC[Generic fallback]

    MODEL --> CORE
    STORE --> CORE
    GRAPH --> CORE
    APPROVAL --> CORE
```

## 13. 13 False Completion Scenario

```mermaid
flowchart TD
    A[Agent dodaje validateContract] --> B[Test jednostkowy przechodzi]
    B --> C[Agent zaznacza TODO jako wykonane]
    C --> D[Agent proponuje CHANGELOG i VERSION]
    D --> E[intent-guard checkpoint]

    E --> F[DSL 1 wykrywa call path]
    F --> G{Walidacja przed wykonaniem?}

    G -->|nie| H[FALSE_COMPLETION]
    H --> I[BLOCK_STAGE]
    I --> J[BLOCK_RELEASE]
    J --> K[Raport i proposed patch]
    K --> L[Człowiek decyduje]

    L -->|popraw kod| M[Agent zmienia kolejność wywołań]
    L -->|zmień intencję| N[Nowe zatwierdzenie TODO]
    L -->|zaakceptuj wyjątek| O[Zapis wyjątku i approval]
```

## 14. 14 Project File Layout

```mermaid
flowchart TD
    REPO[Analizowany projekt] --> CONFIG[.intent-guard.yml]
    REPO --> TICKETS[project/ticket-NNN]
    REPO --> DOCS[README / TODO / MODULE / ADR]
    REPO --> CODE[Kod i testy]

    GUARD[.intent-guard] --> DB[evidence.db]
    GUARD --> REPORTS[reports]
    GUARD --> PROPOSALS[proposals]
    GUARD --> APPROVALS[approvals]
    GUARD --> SNAPSHOTS[snapshots]

    TICKETS --> ACTIVE[README.md]
    TICKETS --> AI[AI-NAME.md]
    TICKETS --> LOGS[logs.txt]

    REPORTS --> AR[architecture-latest]
    REPORTS --> IR[intent-alignment-latest]

    PROPOSALS --> P1[TODO.patch]
    PROPOSALS --> P2[CHANGELOG.patch]
    PROPOSALS --> P3[VERSION.patch]
    PROPOSALS --> P4[ticket-status.patch]
```
