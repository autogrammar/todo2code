# Ticket 009 audit

## Before

| Boundary | Provider schema | Runtime behavior |
|---|---|---|
| NL extraction | manual | unchecked generic followed by field coercion |
| Document extraction | manual + separately published JSON | unchecked generic |
| Markdown enrichment | manual | separate permissive type guard |
| Communication enrichment | manual | separate permissive type guards |
| Summary | manual | separate hand-written assertions |
| Task synthesis | manual | coercion of enums, arrays and percentages |
| Semantic reranker | manual | separate exact validator |

Grounding checks are intentionally stronger than JSON Schema and remain a
second stage: referenced record, diagnostic, candidate and response-local keys
must exist in the exact input context.

## After

| Gate | Result |
|---|---|
| Production structured calls | 7 canonical / 0 raw JSON |
| Runtime constraints | exact keys, type, enum, bounds, pattern, array size, uniqueness |
| Rejected-response provenance | provider/model/response ID retained |
| Published document schema | generated, drift check PASS |
| `npm run verify` | 256 tests: 255 pass, 0 fail, 1 JDK skip |
| Module boundary | 98 modules, 453 imports, 0 cycles |
| Gold v2 / v1 | 100% required gates / PASS |
| Examples | 5 SDK, PASS |

## Intent boundary

Structural invalidity is no longer interpreted. Values such as `"90%"`,
`"issue"`, `"high"`, blank local keys and out-of-vocabulary actions are
rejected and enter the stage's retry/fallback policy. Repository grounding is
still checked after parsing. A conflict between human-owned and agent-owned
typed intent remains routed to the owner of the required role; this contract
does not authorize an agent to edit `user-*` on the human's behalf.
