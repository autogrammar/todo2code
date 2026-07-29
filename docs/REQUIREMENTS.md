# Śledzenie wymagań

| Wymaganie | Implementacja | Test / odbiór |
|---|---|---|
| NL → Intent DSL przez LLM z jawnym fallbackiem | `src/extractors/nl-llm.ts`, `src/extractors/nl.ts`, `src/llm/openrouter.ts` | `nl.test.ts`: sukces LLM, fallback, `require-llm`; `verify-no-llm-imports.mjs` chroni parser deterministyczny |
| Ostatnie 10 commitów → DSL | `src/extractors/git.ts`, default `T2C_GIT_COMMIT_COUNT=10` | `git.test.ts` (dokładnie 10 z repo zawierającego 12 commitów) |
| Aktualne AST → DSL | `src/extractors/ast.ts`, helpery `python/`, `golang/`, `java/`, `rust-ast/` | `ast.test.ts`, `ast-languages.test.ts` |
| TODO + CHANGELOG → DSL, struktura + LLM | osobne `src/extractors/todo.ts`, `changelog.ts`, kompozycja `markdown.ts`, audyt `markdown-llm.ts` | `markdown.test.ts`: oba konwertery, sukces LLM, zachowanie pól strukturalnych, fallback i `require-llm`; live `qwen/qwen3.7-plus` |
| Dokumentacja → DSL przez LLM | `src/extractors/docs-llm.ts`, `src/llm/openrouter.ts` | `openrouter.test.ts`: structured output, target hints, współbieżność, budżet chunków, runtime/config audit |
| Konsolidacja DSL → NL przez LLM | `src/summary/summarizer.ts` | `openrouter.test.ts`: ugruntowane cytowania; pipeline testuje fallback; live wymaga klucza |
| Strukturalne wnioski `t2c.conclusion/v1` | **PLANOWANE — brak implementacji** | P0/P1 w `TODO.md`: schema, runtime validation i renderowanie raportu |
| DSL + diagnostyka → `t2c.todo-proposal/v1` → `TODO.patch` | **PLANOWANE — brak implementacji** | P0 w `TODO.md`: LLM synthesis, źródła dowodowe, deduplikacja, approval i testy end-to-end |
| Graf relacji | `src/graph/linker.ts` | `graph.test.ts` |
| Diagnostyka rozbieżności | `src/graph/diagnostics.ts` | `graph.test.ts`, `pipeline.test.ts` |
| Origin/ref → lokalny workspace | `src/comparison/workspace.ts`, `t2c compare-workspace`, akcja `compare_workspace` | `workspace.test.ts`: prawdziwy bare origin, niecommitowany filesystem oraz brak sieciowego summary mimo skonfigurowanego klucza |
| Audyt runtime/LLM | `src/llm/audit.ts`, `src/pipeline/run.ts`, `t2c.run/v1` | testy NL/Markdown/docs: standalone runtime/config; `pipeline.test.ts`: fingerprint, odpowiedzi i failed-run dla wymaganego LLM oraz nieoczekiwanej awarii |
| Pełna walidacja DSL w runtime | `src/core/schema.ts`, granice graf/diff/reality/summary | `schema-validation.test.ts`: kompletność rekordów, enumy, nadmiarowe pola, relacje i statystyki |
| Modularność | `scripts/verify-module-boundaries.mjs` | `npm run verify:modules`: brak cykli i niezależny `src/core` |
| Kontrakt środowiska | `.env.example`, `src/config/env.ts`, Docker/Compose i SDK | `npm run verify:env`: kompletność lokalnego `.env`, 56 udokumentowanych nazw i brak duplikatów |
| TypeScript runtime | cały katalog `src/` | `npm run build` |
| SDK i przykłady użycia | `sdk/{typescript,python,go,rust,php}` | każdy SDK ma convenience NL/docs i audyt; pięć przykładów testuje offline NL + Markdown, graf/reality/diff; opcjonalny workspace |
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
