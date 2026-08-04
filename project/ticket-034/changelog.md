# Ticket Changelog (ticket-034)

## [0.1.0] - 2026-08-04

- Created the adaptive LLM timeout governance plan.
- Defined deterministic `1x`/`2x`/`4x`/`8x` scaling and a 600-second cap.
- Confirmed the earlier workstream and dirty-worktree blockers are resolved.
- Activated the approved ticket before executable changes.

## [Implementation and validation] - 2026-08-04

- Added deterministic pressure calculation from serialized input characters,
  output-token budget, messages, strict JSON Schema and response healing.
- Applied one bounded effective deadline to fetch attempts and retry backoff;
  preserved immediate pipeline cancellation.
- Added safe audit configuration and timeout errors with base, effective,
  multiplier and cap state.
- Passed 7 focused tests, 342 complete tests, full verification, Docker smoke
  and governance with zero failures.
- Split the original high-complexity request loop into bounded helper stages
  after Koru reported two cyclomatic-complexity violations; Lizard now reports
  no threshold violations and all validation remains green.
- Worked around a pinned Vallm TypeScript parser ambiguity where `<` inside an
  object literal was interpreted as a generic delimiter; the exact Lizard API
  now reports no function above the configured CC=15 limit.

## [Closure] - 2026-08-04

- Koru accepted the exact implementation head after the complexity and parser
  repairs.
- validator-agent run `30948334597` approved exact head
  `e09e8323b96cfdd7543e851b57bd1035d640eb84` using
  `openrouter/z-ai/glm-5.2`; the LLM assessment remained advisory while the
  deterministic decision was the approval trust root.
- All protected checks passed and PR #31 merged as
  `main@6116961d8c9674b24c1161903e43f3a7dbb2147b`.
- Marked ticket-034 `DONE` and cleared the active-ticket list.
