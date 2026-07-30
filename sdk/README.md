# todo2code SDK

Klienci runtime'u `todo2code` dla pięciu języków. Każdy SDK rozmawia z
endpointem **A2A v1.0** (`POST /a2a`, nagłówek `A2A-Version: 1.0`) i udostępnia
ten sam zestaw akcji.

| Język | Katalog | Zależności | Klasa |
|---|---|---|---|
| TypeScript / Node | [`typescript/`](typescript/) | brak (globalne `fetch`) | `T2CClient` |
| Python 3.10+ | [`python/`](python/) | brak (`urllib`, `subprocess`, `json`) | `T2CClient`, `TypeScriptRuntime` |
| Go 1.21+ | [`go/`](go/) | brak (biblioteka standardowa) | `todo2code.Client` |
| Rust 1.70+ | [`rust/`](rust/) | `serde`, `serde_json` | `todo2code::Client` |
| PHP 8.1+ | [`php/`](php/) | brak (`ext-json`) | `Todo2Code\Client` |

Rust jest jedynym SDK z zależnością zewnętrzną: standardowa biblioteka nie ma
parsera JSON. HTTP jest tam mówione wprost po `std::net::TcpStream`, żeby nie
wciągać runtime'u asynchronicznego.

## Wspólny model

Wszystkie akcje przechodzą przez `SendMessage` i zwracają task A2A. Metoda
`call()` rozpakowuje pierwszy artefakt JSON, więc kod wywołujący pracuje na
zwykłym wyniku:

```text
send(action, input)  -> Task            (pełna odpowiedź A2A)
call(action, input)  -> wynik akcji     (rozpakowany artefakt)
```

Uwaga na kształt odpowiedzi: `SendMessage` opakowuje task jako `{"task": …}`,
natomiast `GetTask` i `CancelTask` zwracają go bez wrappera. Każdy SDK
akceptuje obie postacie.

## Dostępne akcje

`extract_nl`, `extract_git`, `extract_ast`, `extract_config`, `extract_markdown`, `extract_docs`,
`extract_communication`, `analyze_communication`, `link`, `diagnose`,
`summarize`, `diff`, `diff_files`, `diff_git`, `reality`,
`compare_workspace`, `pipeline`, `propose_todo`, `render_todo`, `apply_todo`.

Granica LLM obowiązuje tak samo jak w CLI: `extract_nl` oraz semantyczne
wzbogacanie `extract_markdown` obsługują `prefer-llm`/`require-llm`, a
`extract_docs` i `summarize` wołają OpenRouter. Każdy SDK może wymusić
`nlMode: deterministic` lub `markdownMode: deterministic` i odczytać audyt
fallbacku (`audit.status`, `effectiveMode`, `reason`, `runtimeVersion`,
`configuration`). Wszystkie pięć klientów ma convenience methods dla NL,
dokumentacji i deterministycznej konfiguracji/infrastruktury. Każdy klient ma
też metody propose → review → approved apply;
przykłady używają `prefer-llm`, więc bez sekretu tworzą audytowany pusty patch i
bezpieczny, idempotentny no-op po jawnej zgodzie. Python zachowuje metody zwracające same rekordy oraz udostępnia
pełne envelope przez warianty `*_result()`. Przykłady wymuszają
deterministyczne NL i Markdown, aby wynik i koszt nie zależały od sieci, oraz
odrzucają wynik bez poprawnego audytu.

Python ma dodatkowo lokalny most `TypeScriptRuntime`, który przez `subprocess`
uruchamia kanoniczny CLI Node/TypeScript. Dzięki temu paczka może wykonywać
pipeline, diagnostykę, graph diff i reality bez serwera, zachowując dokładnie tę
samą semantykę co CLI.

## Uruchomienie przykładów

Najpierw serwer:

```bash
npm run build
node dist/src/interfaces/a2a.js        # domyślnie :8787
```

Potem dowolny przykład (wszystkie robią to samo: NL → AST → Markdown → graf →
diagnostyka → widok reality → diff Git → propozycje → patch → approved apply):

```bash
export T2C_A2A_URL=http://localhost:8787
export T2C_EXAMPLE_ROOT=examples/backend

npx tsc -p sdk/typescript/tsconfig.json && node sdk/typescript/dist/examples/basic.js
python3 sdk/python/examples/basic.py
(cd sdk/go && go run ./examples/basic)
(cd sdk/rust && cargo run --example basic)
php sdk/php/examples/basic.php
```

Opcjonalny czwarty przypadek testuje porównanie `origin/main` z aktualnym
filesystemem przez wspólną akcję runtime'u:

```bash
export T2C_COMPARE_WORKSPACE=1
export T2C_COMPARE_BASE=origin/main
```

Gdy serwer działa z `T2C_A2A_TOKEN`, ustaw tę samą zmienną w środowisku
klienta — każdy SDK dołączy nagłówek `Authorization: Bearer`.

### Kontrola spójności

Wszystkie pięć przykładów przepuszcza te same 92 rekordy przez `link` i musi
otrzymać **identyczny fingerprint grafu**, listy proposal/duplicate ID oraz
fingerprint patcha. Rozjazd oznacza, że typy danego SDK gubią pole przy
round-tripie:

```text
graph fingerprint: 488ffe359297e1bf   # TS, Python, Go, Rust, PHP
```

Fingerprint dotyczy fixture'a `examples/backend` w wersji `0.5.0`; jego zmiana
po świadomej aktualizacji fixture'a lub semantyki linkera wymaga ponownego
uruchomienia wszystkich pięciu przykładów i aktualizacji tej wartości.
