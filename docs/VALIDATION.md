# Walidacja paczki

Stan walidacji: **2026-07-29**, `todo2code 0.2.0`, baza Git
`origin/main` = `e66306fbdb5881ae82dd9acf76b8a4aac3c90a5f`.

## Kontrole lokalne

| Kontrola | Wynik |
|---|---|
| TypeScript `strict` / `npm run check` | PASS |
| Transitive no-LLM import boundary | PASS — 7 entrypointów, 12 modułów |
| Granice modułów | PASS — 39 modułów, 175 importów wewnętrznych, brak cykli, niezależny `src/core` |
| Kontrakt środowiska | PASS — 56 zmiennych kodu/Dockera, 56 kluczy `.env.example`; prywatny `.env` zsynchronizowany; brak duplikatów i nadmiarowych kluczy |
| Build TypeScript | PASS |
| Testy Node | PASS — 97 zaliczonych, 0 błędów, 1 skip lokalnego JDK (sprawdzony osobno w kontenerze) |
| Offline pipeline smoke test | PASS — 195 rekordów, 702 relacje; jawna degradacja NL/Markdown/summary bez klucza |
| Git extractor na repo z 12 commitami | PASS — dokładnie 10 rekordów commitów |
| TypeScript/JavaScript + Python + Go + Java + Rust AST | PASS — Java 7 faktów w JDK 21 Docker, Rust fixture i `cargo test` |
| Audytowane NL → DSL | PASS — mock LLM, oznaczony fallback i błąd `require-llm` |
| Audytowane TODO/CHANGELOG → DSL | PASS — zachowanie struktury, runtime validation, oznaczony fallback i błąd `require-llm` |
| OpenRouter invalid-model discovery | PASS — lista modeli po błędnym identyfikatorze |
| Dokumentacja → DSL przez mock OpenRouter | PASS — structured output, target hints, limity rekordów/chunków, timeout i współbieżność |
| Graf → NL przez mock OpenRouter | PASS — uziemione cytowania i budżet AST |
| MCP `2026-07-28` `server/discover` + `tools/list` | PASS — 14 narzędzi |
| MCP legacy `initialize` `2025-11-25` + `tools/list` | PASS — 14 narzędzi |
| A2A v1 `SendMessage` | PASS — deterministyczny task completed, 1 artifact |
| A2A versioning, pagination, ownership, Bearer i persistent store | PASS |
| Watch + ignore rules | PASS — rate limit, agregacja, brak pętli, błędy reportera |
| Ochrona przed `../` i symlink escape w MCP/A2A | PASS |
| Diff graf/pliki/Git i reality: JSON/SVG/HTML/Markdown | PASS |
| Origin → niecommitowany workspace | PASS — prawdziwy bare origin i prywatny worktree |
| Python wheel + lokalny most do TypeScript runtime | PASS — test wykonuje reality bez serwera |
| CLI `doctor`, `--help`, `--version` | PASS |
| `npm audit` rdzenia | PASS — 0 podatności przy zwykłym `npm install` |
| Izolowany adapter TensorFlow | PASS/WARN — nie należy do drzewa core; jego osobny audit nadal raportuje 7 high i 1 critical |

Pełny przebieg wykonano poleceniem `make validate`. Próby MCP i A2A jawnie
nadpisują lokalne ustawienia wersji/LLM, dlatego kontrola offline nie zależy od
zawartości prywatnego `.env`.

## SDK i przykłady

- TypeScript: build `strict` i przykład na żywym A2A — PASS.
- Python: `py_compile` i przykład na żywym A2A — PASS.
- Go: `go test ./...` i przykład na żywym A2A — PASS.
- Rust: 2 testy jednostkowe, 1 doc-test i przykład na żywym A2A — PASS.
- PHP: lint klienta i przykładu oraz przykład na żywym A2A — PASS.

Wszystkie przykłady przeszły ścieżkę AST → Markdown → graf → diagnostyka →
Intent vs Reality → Git diff i uzyskały ten sam fingerprint
`7ef0dc655256a432…`; każdy potwierdził audyt Markdown o statusie `succeeded` i
trybie `deterministic`. Opcjonalny przykład TypeScript uruchomił także
`compare_workspace` i zwrócił `unchanged` dla niezmienionego
`examples/backend`. Porównanie nie wywołało summary LLM; oba manifesty oznaczają
je jako świadomie pominięte i zapisują deterministyczny raport.

## Origin vs bieżący filesystem

Końcowy przebieg:

```bash
T2C_NL_MODE=deterministic T2C_MARKDOWN_MODE=deterministic OPENROUTER_API_KEY= \
node dist/src/cli.js compare-workspace . \
  --base origin/main \
  --task TASK.md \
  --markdown-mode deterministic \
  --out .intent
```

Artefakty znajdują się w
`.intent/comparisons/20260729T170906Z-e2589603/`. Stan przed analizą obejmował
53 zmienione lub nowe pliki, `HEAD` był równy `origin/main` (`ahead=0`,
`behind=0`).

| Metryka | `origin/main` | filesystem | Zmiana |
|---|--:|--:|--:|
| Zadeklarowane rekordy | 15 | 12 | −3 |
| Zaobserwowane tematy kodu | 92 | 98 | +6 |
| Deklarowana intencja z implementacją | 8,33% | 0,0% | −8,33 pp |
| Kod posiadający plan | 1,09% | 0,0% | −1,09 pp |
| Kod posiadający dokumentację w grafie | 0,0% | 0,0% | bez zmiany |
| Pełne wyrównanie plan + kod + dokumentacja | 0,0% | 0,0% | bez zmiany |
| Tematy rozbieżne | 136 | 147 | +11 |
| Diagnostyka blocking | 0 | 0 | bez zmiany |

Trend jest **regressed** według obecnej heurystyki: lokalny zakres kodu urósł,
ale wykonane punkty zostały przeniesione z TODO do CHANGELOG, a dwa nowe punkty
TODO są świadomie niezrealizowanym backlogiem. Diff zawiera 1987 dodanych, 1367
usuniętych, 370 zmienionych i 5121 niezmienionych rekordów. Brak blokujących
diagnostyk nie oznacza pełnego pokrycia. Duża liczba zmian wynika również z
tożsamości źródeł/wierszy AST; nie jest równoznaczna z liczbą funkcji
biznesowych. Porównanie celowo wyłączyło LLM dokumentacji, dlatego 0% w kolumnie
dokumentacji oznacza brak załadowanego dowodu, a nie dowód braku dokumentacji.

## Live OpenRouter

Audytowane NL → DSL działa. W oddzielnym przebiegu live `openrouter/auto-beta`
przetworzył `TASK.md` do 19 rekordów w 19,0 s. Manifest zapisał
`status=succeeded`, `degraded=false`, model, runtime `0.2.0`, bezpieczne parametry
i fingerprint konfiguracji; nie zawiera klucza API.

Audytowane TODO/CHANGELOG → DSL również działa live. Model
`qwen/qwen3.7-plus` wzbogacił 10/10 rekordów (6 TODO, 4 CHANGELOG) w około 67 s.
Wszystkie rekordy miały `llmUsed=true`, `degraded=false`, zapisany model i
runtime `0.2.0`; zachowano 3 lifecycle `completed`, 3 `planned` i 4 `released`
oraz niezmienione source/version/date/category.

Nowy bounded extractor przetestowano live na jawnie wskazanym historycznym
raporcie `.intent/runs/20260729T163133Z-1f8c316b/team-summary.md`.
`qwen/qwen3.7-plus` przekroczył osobny limit 45 s zarówno dla 8000, jak i 2000
znaków. Runtime wykonał dokładnie jedno żądanie, zapisał `DOC_CHUNK_BUDGET` i
timeout, bez powtórnego schema-fallbacku. Ten sam 2000-znakowy chunk na
`qwen/qwen3.7-flash` zakończył się powodzeniem: 10 rekordów, jedno response ID,
resolved provider `Alibaba` i 5900 total tokens. Dowodzi to poprawności ścieżki
runtime; `plus` pozostaje problemem latencji providera dla przyjętego SLA.
Szeroki glob `.intent/**/*.md` pozostaje zablokowany; domyślne exclusions może
ominąć wyłącznie literalny `.intent/runs/<id>/team-summary.md`.

## Docker

`docker compose config -q`, `make docker-build` i odtworzenie usługi z obrazu
`todo2code:local` przeszły. Kontener osiągnął stan `healthy`; `/healthz` zwrócił
poprawny A2A 1.0, a `/ui` HTTP 200. Usunięto konfliktujący `compose.yml`, więc
zarówno zwykłe `docker compose`, jak i cele Makefile używają jednego
`docker-compose.yml`.

## Pozostałe ograniczenia 0.2.0

- Pełne pokrycie dokumentacją wymaga włączenia `--docs-llm`; porównanie offline
  poprawnie raportuje 0%, czyli brak załadowanego dowodu, nie brak dokumentacji.
- Alias symbolu jest przypisywany do ścieżki tylko wtedy, gdy w grafie wskazuje
  jednoznacznie jeden plik; symbole o tej samej nazwie w wielu modułach wymagają
  jawnej ścieżki lub kwalifikatora.
- Plikowy A2A task store wymaga wspólnego wolumenu; A2A nie implementuje jeszcze
  streamingu ani push notifications.
- TensorFlow jest świadomym, odizolowanym rozszerzeniem. Jego własny łańcuch
  instalacyjny ma advisories, a fallback heurystyczny nie jest semantycznie
  równoważny LLM ani modelowi klasyfikacyjnemu.
