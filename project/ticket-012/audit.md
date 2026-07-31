# Ticket 012 audit

## Initial live failure

Run `20260731T141822Z-136712ee` failed after 48,865 ms in
`naturalLanguageExtraction`. `openrouter/auto-beta` returned `records[5]`
without `confidence`, `basis`, `target`, `sourceLines` and `text`.

The validator correctly failed closed. Two observability defects remained:

1. `StructuredResponseError.responseMetadata` was discarded by NL and other
   direct extraction fallback boundaries, leaving model/token/cost as unknown.
2. The audit summarized history before appending its own record, so rendered
   history lagged the persisted file by one run.

## Model selection

OpenRouter's model API was queried on 2026-07-31. Every candidate below
advertised `structured_outputs`.

| Model | Result |
|---|---|
| `deepseek/deepseek-v4-flash` | no schema violation; request hit the old 120,000 ms client timeout |
| `qwen/qwen3.7-plus` | NL and Markdown passed; documentation and communication violated their schemas twice |
| `openai/gpt-5.4-mini` | violated NL schema twice, including after receiving the exact schema in the corrective prompt |
| `google/gemini-3.6-flash` | **PASS 6/6**, 125,486 ms, 177,953 tokens, $0.412363 |

The DeepSeek attempt exposed a local configuration contradiction: live allowed
300,000 ms per stage while the client aborted each request after 120,000 ms.
The live runner now raises its request/document timeout to at least the stage
budget without shortening a larger explicit override.

The first Qwen run also exposed inconsistent recovery: task synthesis and
summary had a bounded corrective attempt, while NL, Markdown, documentation
and communication failed on their first contract miss. All four direct
extractors now allow exactly one correction, quote the rejection and the exact
JSON Schema, and validate the second response identically. Both attempts stay
in the audit. A second invalid response still aborts `require-llm`.

## Passing live run

| Stage | Latency | Tokens | Cost |
|---|---:|---:|---:|
| natural language | 16,199 ms | 3,192 | $0.021540 |
| Markdown | 13,529 ms | 3,048 | $0.018246 |
| documentation | 32,080 ms | 14,759 | $0.064613 |
| communication | 10,836 ms | 3,348 | $0.019662 |
| task synthesis | 38,516 ms | 85,659 | $0.176686 |
| summary | 14,326 ms | 61,947 | $0.111616 |

Result: `PASS`, six of six stages, no fallback or degradation, total
125,486 ms and $0.412363. Audit schema: `t2c.live-contract-check/v2`.

## Verification

Focused structured-output tests: 39/39 PASS. `npm run verify`: 286 tests,
285 pass, one local JDK skip; 101 modules, 470 internal imports, no cycles;
7 structured and 0 raw production calls. Gold v1/v2: 100% required metrics.
Five SDK examples: PASS with shared fingerprint `1dacf2edc8d603a2`.

Implementation and documentation were pushed to `main` in `11348c0`.
Unrelated staged `nlp2uri.yaml` was explicitly excluded and remains user-owned.
