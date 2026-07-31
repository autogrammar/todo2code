# Ticket changelog (ticket-006)

## [0.1.0] - 2026-07-31

- Initialized the canonical structured-output conformance ticket.
- Preserved human-file ownership instead of fabricating a `user-*` record.
- Entered `PLAN`; no implementation change yet.

## [0.2.0] - 2026-07-31

- Added the canonical semantic-reranker provider response definition and exact
  fail-closed runtime validator.
- Added a drift gate against the published result schema.
- Added offline regressions for wrong envelopes, non-numeric confidence and
  contradictory verdict/reason pairs.
- Transitioned from `PLAN` to `TOOLS`; live two-route comparison remains open.

## [0.3.0] - 2026-07-31

- Compared `qwen/qwen3.7-plus` and `qwen/qwen3.7-flash` on the same clean
  tracked platform shortlist.
- Rejected both routes before graph mutation; the new Flash diagnostic named
  the exact unknown `decision` property and response identity.
- Passed full verification, both gold datasets, examples, dependency audit and
  CLI/MCP/A2A/Docker smoke.
- Retained only contract hardening and closed the ticket without production
  semantic enablement.
