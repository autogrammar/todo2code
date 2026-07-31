# Ticket 007 audit

## Measured case

The tracked `project/ticket-006` contains agent communication and deliberately
has no agent-authored human participant file or participant registry entry.

| Measure | Before | After |
|---|---:|---:|
| Communication issues | 3 | 3 |
| Required role `human` | 3 | 3 |
| Empty `responseRequiredFrom` | 3 | 0 |
| `unresolved:human` routes | 0 | 3 |
| Invented human identities | 0 | 0 |

The issue count, severity and semantic classification did not change. Only the
previously empty routing state became explicit.

## Regression coverage

- Agent-only ticket: `AGENT_WORK_OUTSIDE_REQUEST` routes to
  `unresolved:human`.
- Human-only ticket: `REQUEST_WITHOUT_AGENT_RESPONSE` routes to
  `unresolved:agent`.
- Existing mixed-participant fixtures retain their actual participant IDs.
- Markdown rendering and diagnostic projection retain the sentinel.

## Gates

- `npm run verify`: PASS — 253 tests, 252 pass, 1 JDK skip.
- `npm run evaluate:gold`: PASS — gold v2 unchanged at required quality.
- `npm run evaluate:gold:v1`: PASS.
- `npm run examples:check`: PASS — five SDKs.
