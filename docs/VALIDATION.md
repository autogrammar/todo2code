# Walidacja paczki

Stan walidacji: **2026-07-31**, `todo2code 0.5.0`. Najnowsza lokalna kontrola
została wykonana na bieżącym drzewie `main`. Poniższe próby origin/workspace i live
OpenRouter są zachowanymi pomiarami historycznymi i mają własne identyfikatory
runów — nie należy interpretować ich jako porównania aktualnego drzewa.

## Kontrole lokalne

| Kontrola | Wynik |
|---|---|
| TypeScript `strict` / `npm run check` | PASS |
| Transitive no-LLM import boundary | PASS — 9 entrypointów, 36 modułów |
| Granice modułów | PASS — 104 moduły, 484 importy wewnętrzne, brak cykli, niezależny `src/core` |
| Kontrakt środowiska | PASS — 75 zmiennych kodu/Dockera/skryptów, 75 kluczy `.env.example`; klucze prywatnego `.env` zsynchronizowane; brak duplikatów i nadmiarowych kluczy |
| Generowana analiza | PASS — tracked-only snapshot; brak odwołań do nieśledzonych wejść, ścieżek tymczasowych i awarii pobrania parsera |
| Build TypeScript | PASS |
| Testy Node | PASS — 303 zaliczone, 0 błędów, 1 skip lokalnego JDK; dedykowany job CI nie pozwala pominąć adaptera Java |
| Pipeline `examples/` | PASS — 227 rekordów i 84 relacje, w tym 5 `agent_log`, 4 `document` i 6 `system` (2 agregaty plikowe); NL, Markdown, dokumentacja, konfiguracja i komunikacja deterministyczne, bez sieci i fallbacku |
| Git extractor na repo z 12 commitami | PASS — dokładnie 10 rekordów commitów |
| TypeScript/JavaScript + Python + Go + Java + Rust AST + PHP syntax | PASS — Java 7 faktów w JDK 21 Docker, wymagany job CI na Temurin 17, Rust fixture i `cargo test`; PHP namespace/use/type/function/method/call, skip oraz fail-open bez runtime |
| PHP A/B na `semcod/redsl` | PASS — 40 śledzonych plików: 2 127 unikalnych rekordów, +80 relacji, 730→712 warning diagnostics, 0 ostrzeżeń ekstrakcji i bez zmiany 1 planu |
| Audytowane NL → DSL | PASS — mock LLM, oznaczony fallback i błąd `require-llm` |
| Audytowane TODO/CHANGELOG → DSL | PASS — zachowanie struktury, runtime validation, oznaczony fallback i błąd `require-llm` |
| `npm run evaluate:gold` | PASS — gold v2: ekstrakcja (4 kanały), linkowanie (`exact-target` 10, `capability-topic` 8) i kody diagnostyk 100% precision/recall; cytowania i klasyfikacja duplikatów 100%; linker cross-language 0/6, captured reranker 6/6 z 0/6 naruszeń i 1 abstencją; `knownGap` 0/6 poza metryką; stabilność 2/2 przebiegów |
| Rozstrzyganie symboli NL względem AST | PASS — 6 testów unique/ambiguous/path/qualified/conflict/missing-fields; niejednoznaczny symbol nie tworzy relacji, a diagnostyka podaje ścieżki kandydatów |
| Ścieżka vs implementacja funkcji | PASS — gold existing-path negative/positive, reality coverage gate i pure-file control; Koru PLF-003 utworzył zweryfikowany commit `55a8b15`, 6/6 pytest, re-analiza 0 target plans; `weekly`/`nlp2uri`/`algitex` succeeded |
| Eksperymentalny reranker live | REJECTED/FAIL-CLOSED — czysty tracked snapshot platformy; Plus łamie envelope/typ, Flash dodaje `decisions[0].decision`; 0 relacji i brak eksportu produkcyjnego |
| Pełny kontrakt runtime DSL | PASS — exact keys, enumy, ID/hash/czas/linie, relacje, końce i statystyki grafu |
| Governed operation-plan DSL | PASS — 9 testów ID/hash, authority, sekretów, ryzyka, rollbacku, fail-closed bindingów i prywatnego atomowego artefaktu bez overwrite/dispatch |
| Code-change plan, source patch i acceptance | PASS — 18 testów: ugruntowane i użyteczne ścieżki/ID, zachowanie złożonej intencji w tytule, content hash, risk/rollback, provenance, tampering/sekrety, persisted CLI, zatwierdzone apply z preflightem/rollbackiem oraz re-diagnose pass/fail |
| Manifest każdej awarii pipeline | PASS — `require-llm` i nieoczekiwana awaria summary zapisują etap/kod bez publikowania `latest.json` |
| OpenRouter invalid-model discovery | PASS — lista modeli po błędnym identyfikatorze |
| Dokumentacja → DSL | PASS — deterministyczny baseline oraz mock OpenRouter: structured output, target hints, limity rekordów/chunków, timeout i współbieżność |
| Cache AST i chunków | PASS — content hash, cold/warm equivalence, invalidacja po zmianie pliku/parametru, recovery po uszkodzeniu, bypass oraz brak cache odpowiedzi providera |
| Konfiguracja/infrastruktura → DSL | PASS — JSON, TOML, Dockerfile i workflow CI (także z aktywną regułą `.*/`), jeden deterministyczny agregat na plik, explicit-path linking bez szumu tematów oraz publiczne interfejsy |
| Graf → NL przez mock OpenRouter | PASS — uziemione cytowania i budżet AST |
| Scheduled live OpenRouter | PASS/SKIP — osobny opt-in job sprawdza NL i summary w `require-llm`, budżety i redacted audit; bez klucza jawnie pomijany |
| MCP `2026-07-28` `server/discover` + `tools/list` | PASS — 26 narzędzi, w tym TODO propose/render/apply oraz code-change propose/render/source-patch/approved-apply/evaluate/close |
| MCP legacy `initialize` `2025-11-25` + `tools/list` | PASS — 26 narzędzi, w tym TODO propose/render/apply oraz code-change propose/render/source-patch/approved-apply/evaluate/close |
| A2A v1 `SendMessage` | PASS — deterministyczny task completed, 1 artifact |
| A2A versioning, pagination, ownership, Bearer i persistent store | PASS |
| Watch + ignore rules | PASS — rate limit, agregacja, brak pętli, błędy reportera |
| Ochrona przed `../` i symlink escape w MCP/A2A | PASS |
| Diff graf/pliki/Git i reality: JSON/SVG/HTML/Markdown | PASS |
| Origin → niecommitowany workspace | PASS — prawdziwy bare origin i prywatny worktree |
| Python wheel + lokalny most do TypeScript runtime | PASS — test wykonuje reality bez serwera |
| `project/<ticket>`: komunikacja ludzi i agentów | PASS — główny pipeline, manifest/history/UI/filter/watch; `user-*`/`ai-*` zachowują rolę i typ sekcji, dowody ticketu są pomijane, a każdy problem wskazuje `responseRequiredRole` i niepuste `responseRequiredFrom`; brak odbiorcy daje jawny sentinel roli; migracja Opus/GPT wykrywa brak typu, a standard `wellmanifest/new-project` 0.6.0 przechodzi izolowany test interoperacyjności |
| Audytowane wzbogacanie komunikacji | PASS — mock structured OpenRouter, syntezy per uczestnik z cytowaniami, zachowane runtime-owned identity/role/ticket/source/epistemic class, jawny fallback i `require-llm` |
| Kanoniczne odpowiedzi LLM | PASS — 7 produkcyjnych wywołań `chatStructuredWithMetadata`, 0 surowych wywołań JSON; schema i parser z jednego kontraktu, dokładne ścieżki błędów, metadata odrzuconej odpowiedzi zachowana |
| Publikowany schemat dokumentów | PASS — `npm run verify:schemas` porównuje plik JSON z mechanicznie generowanym kontraktem runtime |
| `t2c.participant-registry/v1` | PASS — exact stable IDs, mapowanie Git/A2A/human aliases, wykrywanie duplikatów i konfliktów; brak dopasowania po display name |
| `npm run examples:check` | PASS — offline demo, `DEMO-101`, strict backend/frontend, HTTP integration i 5 SDK ze wspólnym fingerprintem grafu `0e0e4a1f1daeeb95` oraz patcha `1b7fef6a7789866d` |
| Docker build + health smoke | PASS — obraz `todo2code:local`, A2A `/healthz` zwraca `status=ok` |
| CLI `doctor`, `--help`, `--version` | PASS |
| `npm audit` rdzenia | PASS — 0 podatności przy zwykłym `npm install` |
| Izolowany adapter TensorFlow | PASS/WARN — nie należy do drzewa core; jego osobny audit nadal raportuje 7 high i 1 critical |

Pełny przebieg wykonano poleceniem `make validate`. Próby MCP i A2A jawnie
nadpisują lokalne ustawienia wersji/LLM, dlatego kontrola offline nie zależy od
zawartości prywatnego `.env`.

Najnowsza kontrola obejmowała `npm run verify`, `npm run examples:check`, smoke
offline, build i health smoke Dockera oraz kontrolowany `live:check` bez klucza.
Wynik: 304 testy, 303 zaliczone, 0 błędów i 1 lokalny skip JDK.
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
`1dacf2edc8d603a2…`; każdy potwierdził audyt NL i Markdown o statusie
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
  --task none \
  --markdown-mode deterministic \
  --communication-mode deterministic \
  --out .intent-workspace-current
```

Artefakty znajdują się w
`.intent-workspace-current/comparisons/20260730T181851Z-769520b7/`. Był to
pre-commit audit opisanych tu zmian: `HEAD` był równy `origin/main`
(`ahead=0`, `behind=0`), a analizator widział 13 zmienionych lub nowych plików.
Jeden z nich, niezwiązany `nlp2uri.yaml`, pozostaje plikiem użytkownika i nie
wchodzi do commita.

| Metryka | `origin/main` | filesystem | Zmiana |
|---|--:|--:|--:|
| Tematy | 497 | 497 | 0 |
| Wyrównane tematy | 83 | 83 | 0 |
| Tematy rozbieżne | 414 | 414 | 0 |
| Pokrycie implementacji | 22,31% | 22,31% | 0 p.p. |
| Kod posiadający plan | 42,78% | 42,78% | 0 p.p. |
| Kod posiadający dokumentację | 42,78% | 42,78% | 0 p.p. |
| Diagnostyka blocking | 4 | 4 | 0 |

Trend jest **unchanged**. Zmiany dodały pięć obserwowanych rekordów netto, ale
nie pogorszyły żadnej metryki semantycznej ani ciężkich diagnostyk. Duży diff
rekordów i relacji pozostaje metryką pomocniczą: zawiera line/source churn AST,
a nie liczbę funkcji biznesowych.

## Live OpenRouter

### Pełny kontrakt 0.5.0

Ticket-012 uruchomił rzeczywisty pipeline `require-llm` dla wszystkich sześciu
etapów. `qwen/qwen3.7-plus` naruszył schemat dokumentacji i komunikacji także
po jednej korekcie, a `openai/gpt-5.4-mini` dwukrotnie naruszył schemat NL.
Jawny domyślny `google/gemini-3.6-flash` przeszedł 6/6 bez fallbacku:
125 486 ms, 177 953 tokeny, $0.412363. Wynik zapisano w redaktowanym
`t2c.live-contract-check/v2`; historia obejmuje bieżący run.

Ticket-013 dodał porównanie na tym samym kontrakcie. Codestral 2508 przeszedł
6/6 w 57 129 ms, 118 920 tokenach i za $0.037994; Gemini 3 Flash Preview
przeszedł 6/6 w 64 064 ms i za $0.076411. DeepSeek V4 Pro nie wytworzył
manifestu przed twardym limitem 900 s. Codestral został nowym domyślnym
modelem, a globalny deadline aktywnie przerywa oczekujące żądanie.

Na repozytoriach zewnętrznych Codestral wzbogacił 161 rekordów `weekly` w
53 362 ms oraz 619 rekordów `nlp2uri` w 194 750 ms po dodaniu ograniczonej
współbieżności trzech batchy. Oba manifesty miały `succeeded / llm`, bez
fallbacku i degradacji.

To potwierdza ścieżkę runtime, nie stałą jakość zewnętrznego providera. Live
pozostaje kontrolą opt-in, a druga odpowiedź niezgodna ze schematem nadal
kończy `require-llm` błędem.

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
Był to etap ekstrakcji/podsumowania, a nie eksperymentalny reranker semantyczny.
Późniejsza próba rerankera na Flash została odrzucona przed zmianą grafu z
powodu dodatkowego pola `response.decisions[0].decision`, zgodnie z wynikiem w
tabeli powyżej.
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
