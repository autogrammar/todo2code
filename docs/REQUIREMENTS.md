# Śledzenie wymagań

| Wymaganie | Implementacja | Test / odbiór |
|---|---|---|
| NL → Intent DSL przez LLM z jawnym fallbackiem | `src/extractors/nl-llm.ts`, `src/extractors/nl.ts`, `src/llm/openrouter.ts` | `nl.test.ts`: sukces LLM, fallback, `require-llm`; `verify-no-llm-imports.mjs` chroni parser deterministyczny |
| Ostatnie 10 commitów → DSL | `src/extractors/git.ts`, default `T2C_GIT_COMMIT_COUNT=10` | `git.test.ts` (dokładnie 10 z repo zawierającego 12 commitów) |
| Aktualne AST → DSL | `src/extractors/ast.ts`, `python/ast_extract.py` | `ast.test.ts` |
| TODO + CHANGELOG → DSL, struktura + LLM | `src/extractors/markdown.ts`, `src/extractors/markdown-llm.ts` | `markdown.test.ts`: parser, sukces LLM, zachowanie pól strukturalnych, fallback i `require-llm`; live `qwen/qwen3.7-plus` |
| Dokumentacja → DSL przez LLM | `src/extractors/docs-llm.ts`, `src/llm/openrouter.ts` | `openrouter.test.ts`: structured output i bezsieciowy mock ekstraktora; live wymaga klucza |
| Konsolidacja DSL → NL przez LLM | `src/summary/summarizer.ts` | `openrouter.test.ts`: ugruntowane cytowania; pipeline testuje fallback; live wymaga klucza |
| Graf relacji | `src/graph/linker.ts` | `graph.test.ts` |
| Diagnostyka rozbieżności | `src/graph/diagnostics.ts` | `graph.test.ts`, `pipeline.test.ts` |
| Origin/ref → lokalny workspace | `src/comparison/workspace.ts`, `t2c compare-workspace`, akcja `compare_workspace` | `workspace.test.ts`: prawdziwy bare origin, niecommitowany filesystem oraz brak sieciowego summary mimo skonfigurowanego klucza |
| Audyt runtime/LLM | `src/pipeline/run.ts`, `t2c.run/v1` | `pipeline.test.ts`: wersja, redacted config, fingerprint, statusy etapów |
| Modularność | `scripts/verify-module-boundaries.mjs` | `npm run verify:modules`: brak cykli i niezależny `src/core` |
| Kontrakt środowiska | `.env.example`, `src/config/env.ts`, Docker/Compose i SDK | `npm run verify:env`: kompletność lokalnego `.env`, 47 udokumentowanych nazw i brak duplikatów |
| TypeScript runtime | cały katalog `src/` | `npm run build` |
| SDK i przykłady użycia | `sdk/{typescript,python,go,rust,php}` | kompilacja/lint każdego SDK oraz pięć przykładów na żywym A2A; opcjonalny flow workspace w przykładzie TypeScript |
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
