# Protokoły i API

## OpenRouter

`todo2code` korzysta z OpenRouter wyłącznie w trzech jawnych etapach:

1. NL → Intent DSL (`prefer-llm` lub `require-llm`);
2. dokumentacja → Intent DSL;
3. graf Intent DSL + diagnostyka → raport NL.

Klient używa:

- endpointu `${OPENROUTER_BASE_URL}/chat/completions`;
- `Authorization: Bearer ...`;
- nagłówków identyfikacji aplikacji `HTTP-Referer` oraz `X-OpenRouter-Title`;
- `response_format.type = "json_schema"` i `strict = true` dla NL/dokumentacji → DSL;
- `provider.require_parameters = true`, aby preferować endpointy obsługujące structured outputs;
- kontrolowanego fallbacku do `json_object`, gdy endpoint odrzuci `json_schema`;
- opcjonalnego pluginu `response-healing` dla odpowiedzi niestrumieniowanych;
- temperatury `0` jako wartości domyślnej.

Klient ma timeout, do trzech prób dla 429/5xx i błędów transportu, nie loguje body promptu ani klucza i waliduje/normalizuje dane po stronie runtime. Model nie może podmienić provenance nadanego przez ekstraktor.

## MCP — dual-era stdio

Serwer implementuje JSON-RPC przez stdio: jeden komunikat JSON na linię, odpowiedzi wyłącznie na stdout, logi wyłącznie na stderr.

### Nowoczesny profil `2026-07-28`

Profil jest bezstanowy i obsługuje:

- `server/discover` do publikowania wersji, capabilities i tożsamości serwera;
- `_meta.io.modelcontextprotocol/protocolVersion`, `_meta.io.modelcontextprotocol/clientInfo` i `_meta.io.modelcontextprotocol/clientCapabilities` w żądaniach;
- `resultType: "complete"` oraz `_meta.io.modelcontextprotocol/serverInfo` w odpowiedziach;
- `tools/list`, `tools/call`, `resources/list`, `resources/read`;
- `ttlMs` i `cacheScope` dla odpowiedzi, dla których cache ma sens;
- błąd `UnsupportedProtocolVersion` (`-32022`) dla nieobsługiwanej wersji.

`initialize` i `ping` nie należą do nowoczesnego profilu. Klient może rozpocząć od `server/discover` albo wysłać od razu żądanie z metadanymi wersji.

### Profil zgodności legacy

Ten sam proces obsługuje także handshake `initialize` dla hostów używających starszych wersji:

- `2025-11-25`;
- `2025-06-18`;
- `2025-03-26`;
- `2024-11-05`.

Po `initialize` dostępne są `ping`, `tools/list`, `tools/call`, `resources/list` i `resources/read`. Żądanie legacy przed handshake jest odrzucane. Profil nowoczesny pozostaje bezstanowy; tylko ścieżka legacy utrzymuje stan negocjacji procesu stdio.

Dostępne narzędzia: `extract_nl`, `extract_git`, `extract_ast`, `extract_markdown`, `extract_docs`, `link`, `diagnose`, `diff`, `diff_files`, `diff_git`, `reality`, `compare_workspace`, `summarize`, `pipeline`.

`extract_nl` przyjmuje `nlMode`, a `pipeline` dodatkowo `docExcludes`.
`compare_workspace` przyjmuje `base` (domyślnie `origin/main`) i zwraca
`t2c.workspace-comparison/v1` wraz ze ścieżkami artefaktów SVG/Markdown.

## A2A v1.0

Serwer wystawia:

- Agent Card: `/.well-known/agent-card.json`;
- endpoint JSON-RPC: `/a2a` (alias transportowy `/`);
- health check: `/healthz`;
- historia kompletnych runów `.intent`: `GET /api/runs` (od najnowszego);
- REST diff: `POST /api/diff`;
- frontend SVG diff: `GET /ui` (automatycznie porównuje dwa najnowsze runy);
- wersję interfejsu `1.0` w `supportedInterfaces` Agent Card.

REST diff zachowuje pełną odpowiedź jako wariant domyślny. Parametr wejściowy
`compact: true` zwraca `compact: true`, `diff.generatedAt`, fingerprinty,
`diff.summary` oraz opcjonalny `svg`, ale pomija `diff.records` i
`diff.relations`. Frontend używa tego wariantu, ponieważ do wizualizacji nie
potrzebuje pełnego materiału dowodowego.

Obsługiwane operacje JSON-RPC:

- `SendMessage` — tworzy lub kontynuuje task i zwraca `SendMessageResponse` z dokładnie jednym polem `task`;
- `GetTask` — zwraca task bez dodatkowego wrappera;
- `ListTasks` — filtruje po context/status/timestamp, stosuje page token, domyślnie pomija artefakty i zwraca `tasks`, `nextPageToken`, `pageSize`, `totalSize`;
- `CancelTask` — zwraca task bez dodatkowego wrappera albo `TaskNotCancelableError`.

Interfejs jest celowo **v1-only**. Każde żądanie musi wskazywać `A2A-Version: 1.0` albo parametr `?A2A-Version=1.0`. Brak lub pusty nagłówek jest interpretowany zgodnie z zasadami protokołu jako `0.3`, a następnie odrzucany przez ten interfejs kodem `VersionNotSupportedError` (`-32009`). Aliasy metod v0.3 nie są przyjmowane, aby uniknąć cichej zmiany semantyki.

Dodatkowe własności implementacji:

- idempotency dla `(principal, messageId)`;
- opcjonalne wykonanie asynchroniczne przez `configuration.returnImmediately`;
- opcjonalne ograniczenie historii;
- cursor pagination sortowane po czasie statusu malejąco;
- własność tasków przypisana do principalu;
- opcjonalny statyczny Bearer token z `T2C_A2A_TOKEN`;
- ETag i 5-minutowy cache Agent Card;
- limit rozmiaru body;
- artefakt wyniku jako `data` o media type `application/json`;
- `google.rpc.ErrorInfo` w `error.data` dla błędów specyficznych dla A2A.

Przy włączonym Bearer tokenie Agent Card publikuje `securitySchemes.bearerAuth.httpAuthSecurityScheme` oraz odpowiadające `securityRequirements`.

Task store jest domyślnie in-memory. `T2C_A2A_TASK_STORE` włącza trwały snapshot
`t2c.a2a-task-store/v1`. Każde żądanie ładuje aktualny stan pod blokadą
międzyprocesową, a zapis używa pliku tymczasowego, atomowego `rename` i trybu
`0600`. Dzięki temu restart zachowuje taski, a repliki na wspólnym wolumenie
zachowują idempotency `(principal, messageId)`. Współdzielony system plików musi
zapewniać atomowe operacje `mkdir` i `rename`; snapshot ma limit 256 MiB.

## SDK

`src/sdk/typescript.ts` udostępnia klienta Fetch API dla Node.js, TypeScript, JavaScript i przeglądarki. `sdk/python/todo2code_sdk.py` zapewnia odpowiednik oparty wyłącznie na bibliotece standardowej Python. Oba SDK obsługują health check, A2A `SendMessage` i REST diff; token Bearer jest opcjonalny.

CLI udostępnia ponadto lokalne, deterministyczne formaty bez transportu sieciowego: `t2c diff --mode files`, `t2c diff --mode git` oraz `t2c reality`. Mogą zapisywać dane JSON i projekcje SVG/HTML/Markdown.
