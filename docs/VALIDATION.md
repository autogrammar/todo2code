# Walidacja paczki

Stan walidacji: **2026-07-29**, `todo2code 0.2.0`, baza Git
`origin/main` = `afe34f5a4932ec4015f7ab0dd3bf30a410e1b79d`.

## Kontrole lokalne

| Kontrola | Wynik |
|---|---|
| TypeScript `strict` / `npm run check` | PASS |
| Transitive no-LLM import boundary | PASS — 7 entrypointów, 11 modułów |
| Granice modułów | PASS — 38 modułów, 170 importów wewnętrznych, brak cykli, niezależny `src/core` |
| Kontrakt środowiska | PASS — 47 zmiennych kodu/Dockera, 47 kluczy `.env.example`; prywatny `.env` zsynchronizowany; brak duplikatów, aliasów i nadmiarowych kluczy |
| Build TypeScript | PASS |
| Testy Node | PASS — 88/88 |
| Offline pipeline smoke test | PASS — 195 rekordów, 695 relacji; jawna degradacja NL/summary bez klucza |
| Git extractor na repo z 12 commitami | PASS — dokładnie 10 rekordów commitów |
| TypeScript/JavaScript + Python + Go AST | PASS |
| Audytowane NL → DSL | PASS — mock LLM, oznaczony fallback i błąd `require-llm` |
| Audytowane TODO/CHANGELOG → DSL | PASS — zachowanie struktury, runtime validation, oznaczony fallback i błąd `require-llm` |
| OpenRouter invalid-model discovery | PASS — lista modeli po błędnym identyfikatorze |
| Dokumentacja → DSL przez mock OpenRouter | PASS — structured output i ograniczona współbieżność |
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
| `npm audit --omit=optional` | PASS — 0 podatności |
| `npm audit` z opcjonalnym TensorFlow | WARN — 7 high, 1 critical w łańcuchu instalacyjnym |

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
`.intent/comparisons/20260729T163147Z-64a9d98e/`. Stan przed analizą obejmował
47 zmienionych, nowych lub usuniętych plików, `HEAD` był równy `origin/main` (`ahead=0`,
`behind=0`).

| Metryka | `origin/main` | filesystem | Zmiana |
|---|--:|--:|--:|
| Zadeklarowane rekordy | 14 | 14 | bez zmiany |
| Zaobserwowane tematy kodu | 88 | 91 | +3 |
| Deklarowana intencja z implementacją | 14,29% | 7,69% | −6,60 pp |
| Kod posiadający plan | 2,27% | 1,10% | −1,17 pp |
| Kod posiadający dokumentację w grafie | 0,0% | 0,0% | bez zmiany |
| Pełne wyrównanie plan + kod + dokumentacja | 0,0% | 0,0% | bez zmiany |
| Tematy rozbieżne | 130 | 135 | +5 |
| Diagnostyka blocking | 0 | 0 | bez zmiany |

Trend jest **regressed** według obecnej heurystyki: lokalny zakres kodu urósł,
ale dopasowanie celów deklaracji do symboli spadło. Diff zawiera 1309 dodanych,
1020 usuniętych, 486 zmienionych i 4753 niezmienione rekordy. Brak blokujących
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

Pełne pokrycie dokumentacji nie zostało potwierdzone. Model
`qwen/qwen3.7-plus` przekroczył limit 120 s zarówno dla `docs/REQUIREMENTS.md`,
jak i jawnie wskazanego historycznego raportu
`.intent/runs/20260729T123956Z-2c6601ec/team-summary.md`. Runtime nie ukrywa tego:
chunk otrzymuje warning, a etap status `partial` albo `failed` zależnie od tego,
czy inne chunki dostarczyły rekordy. Szeroki glob `.intent/**/*.md` pozostaje
zablokowany; tylko dokładnie wskazany raport może zostać włączony.

## Docker

`docker compose config -q`, `make docker-build` i odtworzenie usługi z obrazu
`todo2code:local` przeszły. Kontener osiągnął stan `healthy`; `/healthz` zwrócił
poprawny A2A 1.0, a `/ui` HTTP 200. Usunięto konfliktujący `compose.yml`, więc
zarówno zwykłe `docker compose`, jak i cele Makefile używają jednego
`docker-compose.yml`.

## Pozostałe ograniczenia 0.2.0

- Adapter AST obejmuje TypeScript, JavaScript, Python i Go; Java/Rust są w backlogu.
- `require-llm` zgłasza awarię przed zbudowaniem grafu, ale nie zapisuje jeszcze osobnego manifestu failed-run.
- Audyt OpenRouter nie zapisuje jeszcze response ID, resolved provider/model ani token usage.
- Pełne pokrycie „intencja + kod + dokumentacja” wymaga działającej ekstrakcji dokumentów i bardziej precyzyjnych deklaracji symboli/ścieżek.
- Plikowy A2A task store wymaga wspólnego wolumenu z atomowym `mkdir`/`rename`; A2A nie implementuje streamingu ani push notifications.
- TensorFlow jest opcjonalny. Deterministyczny parser NL działa bez niego, ale jest świadomym trybem/fallbackiem i nie jest przedstawiany jako semantycznie równoważny LLM.
- `@tensorflow/tfjs-node@4.22.0` ma podatny łańcuch instalacyjny; zalecana instalacja produkcyjna używa `--omit=optional`, dopóki adapter nie zostanie wymieniony lub odizolowany.
