# Proces `make demollm`

`make demollm` demonstruje cały stabilny przepływ todo2code oraz dwa krytyczne
kontrakty prawdziwego modelu. Polecenie kończy się błędem, jeżeli brakuje klucza,
provider odrzuci żądanie, odpowiedź nie spełni schematu, cytowania nie należą do
grafu albo zostanie przekroczony budżet kosztu lub latencji.

## Uruchomienie

W prywatnym `.env` ustaw co najmniej `OPENROUTER_API_KEY`. Modele i budżety mogą
pozostać zgodne z `.env.example`.

```bash
make demollm
```

Target rozwija się do dwóch poleceń:

```bash
make demo
T2C_REQUIRE_LIVE_CHECK=1 npm run live:check
```

## Przepływ procesu

```mermaid
flowchart TD
    START[make demollm] --> BUILD[npm run build]
    BUILD --> OFFLINE[Deterministyczny pipeline examples]

    subgraph BASE[Budowa stabilnego grafu bez sieci]
        OFFLINE --> INPUTS[task.md + Git + kod + TODO/CHANGELOG<br/>dokumentacja + konfiguracja + komunikacja]
        INPUTS --> DSL[Rekordy t2c.intent/v1]
        DSL --> GRAPH[Linker tworzy t2c.graph/v1]
        GRAPH --> DIAG[Diagnostyka i Intent vs Reality]
        DIAG --> REPORT[Deterministyczne conclusions i team-summary.md]
        REPORT --> LATEST[examples/.intent-demo/latest.json]
    end

    LATEST --> ENV[Wczytanie prywatnego .env]
    ENV --> KEY{Klucz OpenRouter?}
    KEY -->|nie| FAILKEY[Błąd: T2C_REQUIRE_LIVE_CHECK=1]
    KEY -->|tak| NLLM[NL → Intent DSL<br/>require-llm]
    NLLM --> NVALID[Walidacja t2c.intent/v1<br/>i provenance modelu]
    NVALID --> SLLM[Graf + diagnostyka → conclusions<br/>require-llm]
    SLLM --> SVALID[Walidacja t2c.conclusion/v1<br/>oraz diagnosticIds i recordIds]
    SVALID --> BUDGET{Koszt i latencja<br/>w limitach?}
    BUDGET -->|nie| FAILBUDGET[Błąd live check]
    BUDGET -->|tak| AUDIT[Zredagowany contract-check.json]
    AUDIT --> PASS[PASS]
```

## Kolejność wywołań

```mermaid
sequenceDiagram
    actor U as Użytkownik
    participant M as Make
    participant P as Pipeline offline
    participant F as System plików
    participant L as Live contract check
    participant O as OpenRouter
    participant V as Runtime validators

    U->>M: make demollm
    M->>P: make demo
    P->>P: NL/Git/AST/Markdown/docs/config/communication → DSL
    P->>V: walidacja rekordów i grafu
    V-->>P: poprawny t2c.graph/v1
    P->>F: zapis runu i latest.json
    M->>L: T2C_REQUIRE_LIVE_CHECK=1 npm run live:check
    L->>F: wczytaj .env, latest graph i diagnostics
    L->>O: TASK.md → structured Intent DSL
    O-->>L: JSON + model/response/tokens/cost
    L->>V: waliduj rekordy i provenance
    V-->>L: OK
    L->>O: graph + diagnostics → structured conclusions
    O-->>L: JSON + model/response/tokens/cost
    L->>V: waliduj schema, IDs i cytowania
    V-->>L: OK
    L->>F: .intent-live/contract-check.json
    L-->>M: PASS lub błąd
    M-->>U: kod wyjścia 0 tylko po pełnym PASS
```

## Artefakty i interpretacja

| Artefakt | Znaczenie |
|---|---|
| `examples/.intent-demo/latest.json` | wskaźnik najnowszego kompletnego runu offline |
| `examples/.intent-demo/runs/<run-id>/manifest.json` | tryby etapów, wersja runtime, ostrzeżenia i status |
| `intent.graph.json` | graf dowodów przekazywany do testu summary |
| `diagnostics.json` | deterministyczne rozbieżności cytowane przez LLM |
| `team-summary.md` | raport offline; nie jest odpowiedzią live check |
| `.intent-live/contract-check.json` | zredagowany audyt modeli, tokenów, kosztu i latencji |

Live check nie zapisuje klucza, promptów ani treści odpowiedzi modelu. Pełna
odpowiedź jest walidowana w pamięci, a do audytu trafiają wyłącznie metadane.

## Co dokładnie korzysta z LLM

Bazowy `make demo` pozostaje deterministyczny, aby ten sam kod tworzył stabilny
graf niezależnie od sieci. Część live uruchamia w `require-llm`:

1. `TASK.md` → `t2c.intent/v1`;
2. graf i diagnostyka → `t2c.conclusion/v1`.

Nie jest to pełne wzbogacanie LLM każdego dokumentu ani całego TODO/CHANGELOG.
Do takiego przebiegu służy `pipeline` z trybami `prefer-llm` lub `require-llm`;
`demollm` jest krótkim testem kontraktów, kosztu i dostępności providera.

## Zweryfikowany wynik

Przebieg z 2026-07-30:

```text
extract_nl: ok · 7164 ms · 1284 tokens · $0.008088 · google/gemini-3.6-flash
summarize: ok · 18349 ms · 44136 tokens · $0.005666 · qwen/qwen3.7-flash
live contract check: PASS · total $0.013754
```

Wyniki live mogą zmieniać się wraz z providerem i modelem. Warunkiem sukcesu
nie jest identyczny czas lub koszt, lecz poprawny kontrakt oraz zmieszczenie się
w skonfigurowanych limitach `T2C_LIVE_MAX_LATENCY_MS` i
`T2C_LIVE_MAX_COST_USD`.
