# Walidacja paczki

Stan walidacji: **2026-07-29**, `todo2code 0.1.0`.

## Uruchomione kontrole

| Kontrola | Wynik |
|---|---|
| TypeScript `strict` / `npm run check` | PASS |
| Transitive no-LLM import boundary | PASS — 7 entrypointów, 11 modułów |
| Build TypeScript | PASS |
| Testy Node | PASS — 15/15 |
| Offline pipeline smoke test | PASS — 27 rekordów, 41 relacji |
| Git extractor na repo z 12 commitami | PASS — dokładnie 10 rekordów commitów |
| TypeScript/JavaScript + Python AST | PASS |
| OpenRouter structured-output client przez mock HTTP | PASS |
| Dokumentacja → DSL przez mock OpenRouter | PASS |
| Graf → NL przez mock OpenRouter | PASS |
| MCP `2026-07-28` `server/discover` + `tools/list` | PASS — 9 narzędzi |
| MCP legacy `initialize` `2025-11-25` + `tools/list` | PASS — 9 narzędzi |
| A2A v1 `SendMessage` | PASS — task completed, 1 artifact |
| A2A versioning, pagination, ownership i Bearer | PASS |
| Ochrona przed `../` i symlink escape w MCP/A2A | PASS |
| Kompilacja helpera Python | PASS |
| Składnia skryptów Bash | PASS |
| Parsowanie JSON Schema/przykładów | PASS |
| Parsowanie Compose i GitHub Actions YAML | PASS |
| CLI `doctor`, `--help`, `--version` | PASS |

## Świadomie nieuruchomione kontrole zewnętrzne

### Live OpenRouter

Nie wykonano płatnego żądania do prawdziwego OpenRouter, ponieważ środowisko budowania nie zawierało `OPENROUTER_API_KEY`. Obie ścieżki LLM są testowane przez lokalny mock HTTP, w tym request `json_schema`, odpowiedź strukturalną, ograniczenie confidence, retry/fallback i ugruntowane identyfikatory rekordów.

Przed wdrożeniem produkcyjnym wykonaj:

```bash
cp .env.example .env
# ustaw OPENROUTER_API_KEY i ewentualnie modele
node dist/src/cli.js extract docs --root . --patterns 'docs/**/*.md'
```

### Docker daemon

W środowisku budowania nie było klienta/daemona Docker, dlatego obraz nie został fizycznie zbudowany. `Dockerfile` jest wieloetapowy, runtime działa jako użytkownik bez uprawnień root, zawiera health check i kopiuje wyłącznie artefakty potrzebne w runtime. `docker-compose.yml` oraz YAML CI zostały poprawnie sparsowane.

Walidacja w środowisku z Dockerem:

```bash
make docker-build
T2C_WORKSPACE=/ścieżka/do/repo make docker-up
curl -fsS http://localhost:8787/healthz
make docker-down
```

## Ograniczenia wersji 0.1.0

- A2A task store jest pamięciowy i nie nadaje się jeszcze do klastra lub trwałych zadań.
- A2A nie implementuje streamingu ani push notifications; Agent Card deklaruje oba jako `false`.
- Adapter AST obejmuje TypeScript, JavaScript i Python; Java/Go/Rust są w backlogu.
- TensorFlow jest opcjonalny. Bez przypiętego lokalnego modelu system używa deterministycznych heurystyk.
- Linker opiera się na jawnych ticketach, symbolach, ścieżkach i podobieństwie tokenów; nie zastępuje decyzji człowieka o statusie `DONE`.
