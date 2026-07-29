# Walidacja paczki

Stan walidacji: **2026-07-29**, `todo2code 0.2.0`, baza Git
`origin/main` = `a67606c5fd66b2003bc642adca8961d9881a574f`.

## Kontrole lokalne

| Kontrola | Wynik |
|---|---|
| TypeScript `strict` / `npm run check` | PASS |
| Transitive no-LLM import boundary | PASS — 7 entrypointów, 11 modułów |
| Granice modułów | PASS — 36 modułów, 159 importów wewnętrznych, brak cykli, niezależny `src/core` |
| Build TypeScript | PASS |
| Testy Node | PASS — 85/85 |
| Offline pipeline smoke test | PASS — 195 rekordów, 695 relacji; jawna degradacja NL/summary bez klucza |
| Git extractor na repo z 12 commitami | PASS — dokładnie 10 rekordów commitów |
| TypeScript/JavaScript + Python + Go AST | PASS |
| Audytowane NL → DSL | PASS — mock LLM, oznaczony fallback i błąd `require-llm` |
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

Pełny przebieg wykonano poleceniem `make validate`. Proby MCP i A2A jawnie
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
`735331a5a07d4e52…`. Opcjonalny przykład TypeScript uruchomił także
`compare_workspace` i zwrócił `unchanged` dla niezmienionego
`examples/backend`. Porównanie nie wywołało summary LLM; oba manifesty oznaczają
je jako świadomie pominięte i zapisują deterministyczny raport.

## Origin vs bieżący filesystem

Końcowy przebieg:

```bash
node dist/src/cli.js compare-workspace . \
  --base origin/main \
  --task TASK.md \
  --out .intent
```

Artefakty znajdują się w
`.intent/comparisons/20260729T160505Z-e7897af7/`. Stan przed analizą obejmował
54 zmienione lub nowe pliki, `HEAD` był równy `origin/main` (`ahead=0`,
`behind=0`).

| Metryka | `origin/main` | filesystem | Zmiana |
|---|--:|--:|--:|
| Zadeklarowane tematy | 1 | 11 | +10 |
| Zaobserwowane tematy kodu | 83 | 89 | +6 |
| Deklarowana intencja z implementacją | 0,0% | 27,27% | +27,27 pp |
| Kod posiadający plan | 0,0% | 3,37% | +3,37 pp |
| Kod posiadający dokumentację w grafie | 0,0% | 0,0% | bez zmiany |
| Pełne wyrównanie plan + kod + dokumentacja | 0,0% | 0,0% | bez zmiany |
| Tematy rozbieżne | 109 | 129 | +20 |
| Diagnostyka blocking | 0 | 0 | bez zmiany |

Trend jest **mixed**: trzy tematy deklarowane w `TASK.md` mają dowód w kodzie,
ale lokalny zakres implementacji zwiększył się szybciej niż deklaracje i
udokumentowane fakty. Diff zawiera 2172 dodane, 1529 usuniętych, 332 zmienione
i 3764 niezmienione rekordy. Duża liczba zmian wynika również z tożsamości
źródeł/wierszy AST; nie jest równoznaczna z liczbą funkcji biznesowych.

## Live OpenRouter

Audytowane NL → DSL działa. W końcowym porównaniu `openrouter/auto-beta`
przetworzył `TASK.md` do 19 rekordów w 19,0 s. Manifest zapisał
`status=succeeded`, `degraded=false`, model, runtime `0.2.0`, bezpieczne parametry
i fingerprint konfiguracji; nie zawiera klucza API.

Pełne pokrycie dokumentacji nie zostało potwierdzone. Model
`qwen/qwen3.7-plus` przekroczył limit 120 s zarówno dla `docs/REQUIREMENTS.md`,
jak i jawnie wskazanego historycznego raportu
`.intent/runs/20260729T123956Z-2c6601ec/team-summary.md`. Runtime nie ukrywa tego:
chunk otrzymuje warning, a etap status `partial` albo `failed` zależnie od tego,
czy inne chunki dostarczyły rekordy. Szeroki glob `.intent/**/*.md` pozostaje
zablokowany; tylko dokładnie wskazany raport może zostać włączony.

## Docker

Docker nie jest częścią `make validate` i nie został ponownie zbudowany po tej
zmianie. Ostatnia kontrola obrazu 0.2.0 zakończyła się statusem `healthy` dla
`/healthz` i `/ui`; przed publikacją kolejnego wydania należy powtórzyć
`make docker-build` i health check.

## Pozostałe ograniczenia 0.2.0

- Adapter AST obejmuje TypeScript, JavaScript, Python i Go; Java/Rust są w backlogu.
- `require-llm` zgłasza awarię przed zbudowaniem grafu, ale nie zapisuje jeszcze osobnego manifestu failed-run.
- Audyt OpenRouter nie zapisuje jeszcze response ID, resolved provider/model ani token usage.
- Pełne pokrycie „intencja + kod + dokumentacja” wymaga działającej ekstrakcji dokumentów i bardziej precyzyjnych deklaracji symboli/ścieżek.
- Plikowy A2A task store wymaga wspólnego wolumenu z atomowym `mkdir`/`rename`; A2A nie implementuje streamingu ani push notifications.
- TensorFlow jest opcjonalny. Deterministyczny parser NL działa bez niego, ale jest świadomym trybem/fallbackiem i nie jest przedstawiany jako semantycznie równoważny LLM.
- `@tensorflow/tfjs-node@4.22.0` ma podatny łańcuch instalacyjny; zalecana instalacja produkcyjna używa `--omit=optional`, dopóki adapter nie zostanie wymieniony lub odizolowany.
