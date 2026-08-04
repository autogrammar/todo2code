# Ticket Changelog (ticket-034)

## [0.1.0] - 2026-08-04

- Created the adaptive LLM timeout governance plan.
- Defined deterministic `1×`/`2×`/`4×`/`8×` scaling and a 600-second cap.
- Recorded ticket-027 and the dirty OpenRouter refactor as blockers.
- Stopped at `BACKLOG / WAIT_FOR_APPROVAL`; no executable files changed.
- Recorded the user's approval and moved to `IN_PROGRESS / EDIT`.
- Confirmed ticket-027 is closed on its validated repair line and that the
  current split base already carries the relevant behavior.
- Selected `z-ai/glm-5.2` in the ignored local OpenRouter configuration.
- Added deterministic timeout pressure from serialized input, output token
  budget, message count, strict JSON Schema and response healing.
- Kept retry backoff inside one adaptive deadline and external cancellation
  immediate.
- Persisted the non-secret scaling policy in audits and expanded timeout errors
  with base/effective values.
- Passed governance, 349-test verification, gold v2, five SDK examples and
  Docker smoke on the validated publication base.
