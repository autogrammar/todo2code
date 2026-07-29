# Walidacja paczki

Stan walidacji: **2026-07-29**, `todo2code 0.2.0`.

## Uruchomione kontrole

| Kontrola | Wynik |
|---|---|
| TypeScript `strict` / `npm run check` | PASS |
| Transitive no-LLM import boundary | PASS — 7 entrypointów, 11 modułów |
| Build TypeScript | PASS |
| Testy Node | PASS — 54/54 |
| Offline pipeline smoke test | PASS — 27 rekordów, 41 relacji |
| Git extractor na repo z 12 commitami | PASS — dokładnie 10 rekordów commitów |
| TypeScript/JavaScript + Python + Go AST | PASS |
| OpenRouter structured-output client przez mock HTTP | PASS |
| Dokumentacja → DSL przez mock OpenRouter | PASS |
| Graf → NL przez mock OpenRouter | PASS |
| MCP `2026-07-28` `server/discover` + `tools/list` | PASS — 13 narzędzi |
| MCP legacy `initialize` `2025-11-25` + `tools/list` | PASS — 13 narzędzi |
| A2A v1 `SendMessage` | PASS — task completed, 1 artifact |
| A2A versioning, pagination, ownership i Bearer | PASS |
| Ochrona przed `../` i symlink escape w MCP/A2A | PASS |
| Kompilacja helpera Python | PASS |
| Składnia skryptów Bash | PASS |
| Parsowanie JSON Schema/przykładów | PASS |
| Parsowanie Compose i GitHub Actions YAML | PASS |
| CLI `doctor`, `--help`, `--version` | PASS |
| Diff graf/pliki/Git i reality: JSON/SVG/HTML/Markdown | PASS |
| SDK TypeScript, Python, Go, Rust i PHP | PASS — wspólny fingerprint |
| Python wheel + lokalny most do TypeScript runtime | PASS — instalacja wheel, `--version`, reality JSON/SVG/Markdown |
| Obraz Docker i health check A2A | PASS — kontener healthy |
| Live OpenRouter | PASS — dokumentacja LLM i uziemione podsumowanie |

## Kontrole zewnętrzne

### Intent vs Reality bieżącego repozytorium

Świeży pipeline uruchomiony na bieżącym drzewie (`--no-docs-llm`) utworzył graf
`4ba97dd502ff8b83…` z 4801 obserwowanymi rekordami i 3 deklaracjami. Projekcja
`t2c.reality/v1` wykryła 100 tematów rozbieżnych. Najważniejszy wynik jest
zgodny ze stanem repozytorium: „persistent A2A task store for clustered
deployment” ma deklarację TODO/changelog, ale nie ma dowodu implementacji.

Duża liczba tematów `code, no plan` oznacza, że fakty AST są znacznie
dokładniejsze niż bieżące deklaracje celów. Widok działa poprawnie, lecz jego
wartość wzrośnie po dodaniu ścieżek/symboli do tasków i dokumentacji. Artefakty
kontrolne wygenerowano jako `.intent-eval/reality.svg` i
`.intent-eval/reality.md`.

### Live OpenRouter

Wykonano pełny przebieg z `qwen/qwen3.7-plus` dla ekstrakcji dokumentacji oraz
`qwen/qwen3.7-flash` dla podsumowania. Run
`.intent/runs/20260729T123956Z-2c6601ec` zawiera 3597 rekordów, w tym rekordy
`INT-DOC`, oraz podsumowanie z uziemionymi cytowaniami. Część dużych chunków
modelu plus przekroczyła limit 120 sekund; ostrzeżenia zostały zachowane w
manifeście zamiast udawać pełne pokrycie.

### Docker daemon

Obraz został zbudowany przez `docker compose -f docker-compose.yml up --build -d`.
Kontener `todo2code-t2c-a2a-1` osiągnął status `healthy`; `/healthz`, `/ui`
oraz przykłady SDK TypeScript, Python, Go, Rust i PHP zostały odpytane na żywej
usłudze i zwróciły wspólny fingerprint grafu `6cb862730e935e99`.

Powtórzenie walidacji:

```bash
make docker-build
T2C_WORKSPACE=/ścieżka/do/repo make docker-up
curl -fsS http://localhost:8787/healthz
make docker-down
```

## Ograniczenia wersji 0.2.0

- A2A task store jest pamięciowy i nie nadaje się jeszcze do klastra lub trwałych zadań.
- A2A nie implementuje streamingu ani push notifications; Agent Card deklaruje oba jako `false`.
- Adapter AST obejmuje TypeScript, JavaScript, Python i Go; Java/Rust są w backlogu.
- TensorFlow jest opcjonalny. Bez przypiętego lokalnego modelu system używa deterministycznych heurystyk.
- Linker opiera się na jawnych ticketach, symbolach, ścieżkach i podobieństwie tokenów; nie zastępuje decyzji człowieka o statusie `DONE`.
