# Praktyczny przewodnik CLI

CLI `todo2code` zamienia polecenia, Git, kod, TODO/CHANGELOG, dokumentację i
komunikację ticketów na wspólny Intent Evidence DSL. Graf powstały z tych
rekordów służy do diagnostyki, Intent vs Reality i porównań w czasie.

## Instalacja i diagnostyka

```bash
npm install
npm run build
node dist/src/cli.js doctor
node dist/src/cli.js help
```

Po `npm link` pełne `node dist/src/cli.js` można zastąpić poleceniem `t2c`.

## Sprawdzenie wersjonowanych przykładów

```bash
npm run examples:check
# albo: make examples-check
```

Kontrola wykonuje:

1. całkowicie offline `npm run demo`;
2. pipeline `examples/` i analizę uczestników `DEMO-101`;
3. kompilację TypeScript `strict` przykładowego backendu i frontendu;
4. integrację HTTP: health, publikację, odczyt, klasyfikację i błąd `400`;
5. przykłady TypeScript oraz wszystkich dostępnych lokalnie SDK Python, Go,
   Rust i PHP;
6. porównanie fingerprintu grafu pomiędzy językami;
7. porównanie proposal ID, klasyfikacji duplikatów i fingerprintu `TODO.patch`
   dla wszystkich pięciu SDK.

Brak opcjonalnego toolchainu powoduje jawny `SKIP` tylko dla jego SDK. Node i
przykład TypeScript są wymagane. Skrypt uruchamia A2A na wolnym porcie i usuwa
proces oraz katalog tymczasowy także po błędzie.

## Pełny pipeline offline

```bash
node dist/src/cli.js pipeline /ścieżka/do/repo \
  --task TASK.md \
  --todo TODO.md \
  --changelog CHANGELOG.md \
  --docs 'README.md,docs/**/*.md' \
  --nl-mode deterministic \
  --markdown-mode deterministic \
  --no-docs-llm \
  --no-summary-llm \
  --out .intent
```

Flagi są jawne, więc obecność klucza OpenRouter w prywatnym `.env` nie zmienia
trybu wykonania. Udany run zapisuje:

```text
.intent/
├── latest.json
└── runs/<run-id>/
    ├── nl.intent.jsonl
    ├── git.intent.jsonl
    ├── ast.intent.jsonl
    ├── todo.intent.jsonl
    ├── changelog.intent.jsonl
    ├── document.intent.jsonl
    ├── intent.graph.json
    ├── diagnostics.json
    ├── communication.intent.jsonl
    ├── communication-analysis.json
    ├── communication-analysis.md
    ├── task-synthesis.json       # gdy --task-mode != disabled
    ├── todo-validation.json      # gdy --task-mode != disabled
    ├── TODO.patch                # wyłącznie do review
    ├── TODO.patch.json           # audyt patcha
    ├── team-summary.md
    └── manifest.json
```

`manifest.json` jest źródłem prawdy o trybach, wersji runtime, ostrzeżeniach i
degradacji. Szybki odczyt bez `jq`:

```bash
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
const latest = JSON.parse(await readFile('.intent/latest.json', 'utf8'));
const manifest = JSON.parse(await readFile(`${latest.runDirectory}/manifest.json`, 'utf8'));
console.log(manifest.status, manifest.runtime, manifest.stages, manifest.warnings);
NODE
```

## Pipeline z OpenRouter

Po ustawieniu `OPENROUTER_API_KEY` oraz modeli w `.env`:

```bash
node dist/src/cli.js pipeline . \
  --task TASK.md \
  --todo TODO.md \
  --changelog CHANGELOG.md \
  --docs 'README.md,docs/**/*.md,project/**/*.md' \
  --nl-mode prefer-llm \
  --markdown-mode prefer-llm \
  --task-mode prefer-llm \
  --out .intent
```

`prefer-llm` pozwala na jawnie audytowany fallback. Gdy wynik bez modelu jest
niedopuszczalny, należy użyć `require-llm`. Wtedy brak klucza, timeout, błędny
model lub niepoprawna odpowiedź kończą proces błędem i tworzą manifest
`status=failed` bez publikowania nieistniejącego grafu jako `latest`.

## DSL2TODO: propose, review i apply

Pipeline z `--task-mode prefer-llm|require-llm` może od razu zapisać syntezę,
walidację i patch w katalogu runu. Nie stosuje patcha. Te same etapy można
wykonać jawnie na istniejących artefaktach:

```bash
RUN=.intent/runs/<run-id>

node dist/src/cli.js propose-todo "$RUN/intent.graph.json" \
  --diagnostics "$RUN/diagnostics.json" \
  --mode require-llm \
  --out "$RUN/task-synthesis.json"

node dist/src/cli.js render-todo "$RUN/task-synthesis.json" \
  --graph "$RUN/intent.graph.json" \
  --diagnostics "$RUN/diagnostics.json" \
  --todo TODO.md \
  --patch "$RUN/TODO.patch" \
  --audit "$RUN/TODO.patch.json"
```

Po ręcznym przejrzeniu `TODO.patch` należy odczytać `renderedPatchHash` z
`TODO.patch.json` i przekazać go dosłownie jako zgodę:

```bash
node dist/src/cli.js apply-todo \
  --todo TODO.md \
  --patch "$RUN/TODO.patch" \
  --audit "$RUN/TODO.patch.json" \
  --receipt "$RUN/TODO.patch.receipt.json" \
  --actor reviewer@example.com \
  --approval-hash <renderedPatchHash>
```

Każde polecenie emituje wynik JSON. Ścieżki podlegają `T2C_ROOT`. Apply
odrzuca brak/błędny hash zgody, zmienione TODO i zmieniony patch; poprawne
powtórzenie jest idempotentne. Jeżeli artefakty należą do wersjonowanego runu,
service/MCP/A2A rejestrują je w jego `manifest.files`, łącznie z receiptem.

## Osobne konwertery

```bash
node dist/src/cli.js extract nl TASK.md --nl-mode deterministic --out nl.intent.jsonl
node dist/src/cli.js extract git --root . --count 10 --out git.intent.jsonl
node dist/src/cli.js extract ast . --out ast.intent.jsonl
node dist/src/cli.js extract markdown --root . --todo TODO.md --changelog CHANGELOG.md \
  --markdown-mode deterministic --out markdown.intent.jsonl
node dist/src/cli.js extract docs --root . --patterns 'README.md,docs/**/*.md' \
  --out docs.intent.jsonl
```

Ręczne zbudowanie i sprawdzenie grafu:

```bash
node dist/src/cli.js link nl.intent.jsonl git.intent.jsonl ast.intent.jsonl \
  markdown.intent.jsonl --out intent.graph.json
node dist/src/cli.js diagnose intent.graph.json --out diagnostics.json
```

## Intent vs Reality i diff

```bash
node dist/src/cli.js reality intent.graph.json \
  --diagnostics diagnostics.json \
  --gaps-only --out reality.json --md reality.md --svg reality.svg

node dist/src/cli.js diff before.graph.json after.graph.json \
  --out diff.json --svg diff.svg

node dist/src/cli.js diff --mode files before.ts after.ts \
  --svg files.diff.svg --html files.diff.html

node dist/src/cli.js diff --mode git . --rev origin/main \
  --svg workspace.diff.svg --html workspace.diff.html
```

SVG, HTML i Markdown są projekcjami danych JSON, nie alternatywnym źródłem
prawdy.

## Origin kontra lokalny filesystem

```bash
node dist/src/cli.js compare-workspace . \
  --base origin/main \
  --task TASK.md \
  --markdown-mode deterministic \
  --out .intent
```

Polecenie tworzy osobny graf dla wskazanego refa Git i osobny dla aktualnego
filesystemu, łącznie z niecommitowanymi zmianami. Wynikiem jest diff, metryki
pokrycia i kierunek trendu.

## Komunikacja `project/<ticket>`

```bash
node dist/src/cli.js communication . \
  --project-dir project \
  --ticket WM-101 \
  --communication-mode deterministic \
  --out .intent/WM-101.analysis.json \
  --md .intent/WM-101.analysis.md \
  --graph .intent/WM-101.graph.json
```

Analiza zachowuje tożsamość i rolę każdego uczestnika. Raportuje konflikty
człowiek–człowiek i człowiek–agent, brak odpowiedzi, działania poza zakresem
oraz claimy wykonania bez dowodu Git/AST. Główny `pipeline` i `watch` wykonują
ten etap domyślnie z `--project-dir project`; zakres można ograniczyć przez
`--communication-ticket TICKET` albo jawnie wyłączyć przez
`--no-communication`. Samodzielna komenda pozostaje przydatna do szybkiego
raportu jednego ticketu.

`--communication-mode prefer-llm` dodaje audytowane wzbogacenie semantyczne i
uziemioną syntezę osobno dla każdego uczestnika. `require-llm` nie fallbackuje,
a tryb domyślny `deterministic` nie używa sieci. Participant, rola, ticket,
linie źródłowe, lifecycle i epistemic class zawsze pochodzą z runtime.

Historia `/api/runs` przyjmuje filtry `participant`, `role`, `ticket` i
`severity`. Te same pola są dostępne w `/ui`; participant/role/ticket zawężają
również deterministyczny diff grafów do komunikacji wybranego zakresu.

## Watch, MCP i A2A

```bash
node dist/src/cli.js watch . --interval 60 --scan-interval 2 --out .intent
node dist/src/interfaces/mcp.js
node dist/src/interfaces/a2a.js
```

A2A domyślnie udostępnia health pod `http://localhost:8787/healthz`, Agent Card
pod `/.well-known/agent-card.json` i UI historii/diffów pod `/ui`.
