# Śledzenie wymagań

| Wymaganie | Implementacja | Test / odbiór |
|---|---|---|
| NL → Intent DSL bez LLM | `src/extractors/nl.ts`, `src/tf/classifier.ts` | `nl.test.ts`, `verify-no-llm-imports.mjs` |
| Ostatnie 10 commitów → DSL | `src/extractors/git.ts`, default `T2C_GIT_COMMIT_COUNT=10` | `git.test.ts` (dokładnie 10 z repo zawierającego 12 commitów) |
| Aktualne AST → DSL | `src/extractors/ast.ts`, `python/ast_extract.py` | `ast.test.ts` |
| TODO + CHANGELOG → DSL | `src/extractors/markdown.ts` | `markdown.test.ts` |
| Dokumentacja → DSL przez LLM | `src/extractors/docs-llm.ts`, `src/llm/openrouter.ts` | `openrouter.test.ts`: structured output i bezsieciowy mock ekstraktora; live wymaga klucza |
| Konsolidacja DSL → NL przez LLM | `src/summary/summarizer.ts` | `openrouter.test.ts`: ugruntowane cytowania; pipeline testuje fallback; live wymaga klucza |
| Graf relacji | `src/graph/linker.ts` | `graph.test.ts` |
| Diagnostyka rozbieżności | `src/graph/diagnostics.ts` | `graph.test.ts`, `pipeline.test.ts` |
| TypeScript runtime | cały katalog `src/` | `npm run build` |
| MCP | `src/interfaces/mcp.ts` | `scripts/mcp-request.sh` |
| A2A | `src/interfaces/a2a.ts` | `scripts/a2a-request.sh` |
| Konfiguracja `.env` | `src/config/env.ts`, `.env.example` | `doctor` |
| Docker | `Dockerfile`, `docker-compose.yml` | `make docker-build` |
| Python tylko gdy przydatny | standard-library AST helper | `ast.test.ts` |
| Makefile | `Makefile` | `make verify`, `make demo` |

## Różnica względem materiału wejściowego

Materiał wejściowy koncentruje się również na governance: blokadach agenta, chronionych plikach, statusie `DONE` i review człowieka. `t2c` zachowuje epistemikę, diagnostykę i zasadę, że system nie zatwierdza samodzielnie `DONE`, ale zakres tej paczki skupia się na ekstrakcji, grafie wiedzy, komunikacji i interoperacyjności. Pełne branch protection/work permits pozostają warstwą integracyjną repozytorium/CI.

## Granica zdalnych interfejsów

`security.test.ts` weryfikuje odrzucenie `../`, ucieczki przez symlink oraz pomijanie symlinkowanych plików Python przez akcje używane w MCP/A2A.
