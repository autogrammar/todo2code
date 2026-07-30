# Walidacja paczki

Stan walidacji: **2026-07-30**, `todo2code 0.5.0`. Najnowsza lokalna kontrola
została wykonana na bieżącym drzewie `main`. Poniższe próby origin/workspace i live
OpenRouter są zachowanymi pomiarami historycznymi i mają własne identyfikatory
runów — nie należy interpretować ich jako porównania aktualnego drzewa.

## Kontrole lokalne

| Kontrola | Wynik |
|---|---|
| TypeScript `strict` / `npm run check` | PASS |
| Transitive no-LLM import boundary | PASS — 9 entrypointów, 18 modułów |
| Granice modułów | PASS — 47 modułów, 247 importów wewnętrznych, brak cykli, niezależny `src/core` |
| Kontrakt środowiska | PASS — 56 zmiennych kodu/Dockera, 56 kluczy `.env.example`; klucze prywatnego `.env` zsynchronizowane; brak duplikatów i nadmiarowych kluczy |
| Build TypeScript | PASS |
| Testy Node | PASS — 147 zaliczonych, 0 błędów, 1 skip lokalnego JDK (adapter ma wcześniejszą kontrolę kontenerową) |
| Pipeline `examples/` | PASS — 207 rekordów, w tym 5 `agent_log`; liczba relacji zależy od ostatnich 10 commitów; NL, Markdown, komunikacja i summary deterministyczne, dokumentacja pominięta, bez sieci i fallbacku |
| Git extractor na repo z 12 commitami | PASS — dokładnie 10 rekordów commitów |
| TypeScript/JavaScript + Python + Go + Java + Rust AST | PASS — Java 7 faktów w JDK 21 Docker, Rust fixture i `cargo test` |
| Audytowane NL → DSL | PASS — mock LLM, oznaczony fallback i błąd `require-llm` |
| Audytowane TODO/CHANGELOG → DSL | PASS — zachowanie struktury, runtime validation, oznaczony fallback i błąd `require-llm` |
| `npm run evaluate:gold` | PASS — ekstrakcja i linkowanie 100% precision/recall; cytowania 100%; klasyfikacja duplikatów 100% precision/recall; deduplication rate 50%; stabilność 2/2 przebiegów |
| Pełny kontrakt runtime DSL | PASS — exact keys, enumy, ID/hash/czas/linie, relacje, końce i statystyki grafu |
| Manifest każdej awarii pipeline | PASS — `require-llm` i nieoczekiwana awaria summary zapisują etap/kod bez publikowania `latest.json` |
| OpenRouter invalid-model discovery | PASS — lista modeli po błędnym identyfikatorze |
| Dokumentacja → DSL przez mock OpenRouter | PASS — structured output, target hints, limity rekordów/chunków, timeout i współbieżność |
| Graf → NL przez mock OpenRouter | PASS — uziemione cytowania i budżet AST |
| MCP `2026-07-28` `server/discover` + `tools/list` | PASS — 19 narzędzi, w tym propose/render/apply TODO |
| MCP legacy `initialize` `2025-11-25` + `tools/list` | PASS — 19 narzędzi, w tym propose/render/apply TODO |
| A2A v1 `SendMessage` | PASS — deterministyczny task completed, 1 artifact |
| A2A versioning, pagination, ownership, Bearer i persistent store | PASS |
| Watch + ignore rules | PASS — rate limit, agregacja, brak pętli, błędy reportera |
| Ochrona przed `../` i symlink escape w MCP/A2A | PASS |
| Diff graf/pliki/Git i reality: JSON/SVG/HTML/Markdown | PASS |
| Origin → niecommitowany workspace | PASS — prawdziwy bare origin i prywatny worktree |
| Python wheel + lokalny most do TypeScript runtime | PASS — test wykonuje reality bez serwera |
| `project/<ticket>`: komunikacja ludzi i agentów | PASS — główny pipeline, manifest/history/UI/filter/watch; `DEMO-101` wykrywa konflikty człowiek–człowiek i człowiek–agent oraz pracę poza zakresem; wariant `--no-ast` wykrywa claim bez dowodu |
| Audytowane wzbogacanie komunikacji | PASS — mock structured OpenRouter, syntezy per uczestnik z cytowaniami, zachowane runtime-owned identity/role/ticket/source/epistemic class, jawny fallback i `require-llm` |
| `t2c.participant-registry/v1` | PASS — exact stable IDs, mapowanie Git/A2A/human aliases, wykrywanie duplikatów i konfliktów; brak dopasowania po display name |
| `npm run examples:check` | PASS — offline demo, `DEMO-101`, strict backend/frontend, HTTP integration i 5 SDK ze wspólnym fingerprintem grafu `488ffe359297e1bf` oraz patcha `907d4fd79ef9f754` |
| Docker build + health smoke | PASS — obraz `todo2code:local`, A2A `/healthz` zwraca `status=ok` |
| CLI `doctor`, `--help`, `--version` | PASS |
| `npm audit` rdzenia | PASS — 0 podatności przy zwykłym `npm install` |
| Izolowany adapter TensorFlow | PASS/WARN — nie należy do drzewa core; jego osobny audit nadal raportuje 7 high i 1 critical |

Pełny przebieg wykonano poleceniem `make validate`. Próby MCP i A2A jawnie
nadpisują lokalne ustawienia wersji/LLM, dlatego kontrola offline nie zależy od
zawartości prywatnego `.env`.

Najnowsza kontrola obejmowała `npm run verify`, `npm run examples:check`, smoke
offline oraz build i health smoke Dockera; nie wykonywała live OpenRouter.
Wynik: 158 testów, 157 zaliczonych, 0 błędów i 1 lokalny skip JDK.
Stan funkcjonalny oraz pozostałe ograniczenia opisuje
[`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## SDK i przykłady

- TypeScript: build `strict` i przykład na żywym A2A — PASS.
- Python: `py_compile` i przykład na żywym A2A — PASS.
- Go: `go test ./...` i przykład na żywym A2A — PASS.
- Rust: 2 testy jednostkowe, 1 doc-test i przykład na żywym A2A — PASS.
- PHP: lint klienta i przykładu oraz przykład na żywym A2A — PASS.

Wszystkie przykłady przeszły ścieżkę NL → AST → Markdown → graf → diagnostyka →
Intent vs Reality → Git diff i uzyskały ten sam fingerprint
`488ffe359297e1bf…`; każdy potwierdził audyt NL i Markdown o statusie
`succeeded` i trybie `deterministic`. Opcjonalny przykład TypeScript uruchomił także
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
`.intent/comparisons/20260729T173712Z-acb9ce2f/`. Stan przed analizą obejmował
56 zmienionych lub nowych plików, `HEAD` był równy `origin/main` (`ahead=0`,
`behind=0`).

| Metryka | `origin/main` | filesystem | Zmiana |
|---|--:|--:|--:|
| Zadeklarowane rekordy | 12 | 13 | +1 |
| Zaobserwowane tematy kodu | 98 | 102 | +4 |
| Deklarowana intencja z implementacją | 0,0% | 0,0% | bez zmiany |
| Kod posiadający plan | 0,0% | 0,0% | bez zmiany |
| Kod posiadający dokumentację w grafie | 0,0% | 0,0% | bez zmiany |
| Pełne wyrównanie plan + kod + dokumentacja | 0,0% | 0,0% | bez zmiany |
| Tematy rozbieżne | 148 | 156 | +8 |
| Diagnostyka blocking | 0 | 0 | bez zmiany |

Trend jest **regressed** według obecnej heurystyki wyłącznie dlatego, że osiem
nowych tematów AST/CHANGELOG zwiększyło licznik gaps; żaden wskaźnik pokrycia
nie spadł i nie pojawiła się diagnostyka blocking. Diff zawiera 1839 dodanych,
1464 usunięte, 418 zmienionych i 5598 niezmienionych rekordów. Duża liczba zmian
wynika z tożsamości źródeł/wierszy AST i nie jest równoznaczna z liczbą funkcji
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

Są to historyczne próby live sprzed wydania 0.3.0. W 0.3.0 ta sama ścieżka ma
testy regresyjne z mockowanym providerem; nowy envelope dodatkowo zapisuje
`audit.runtimeVersion`, redacted `audit.configuration` i metadata generowania
dokumentacji.

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

## Pozostałe ograniczenia 0.5.0

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
