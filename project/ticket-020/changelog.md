# Ticket Changelog (ticket-020)

## [0.1.0] - 2026-08-01

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Expanded the plan with role-bound trusted intake, CQRS/event sourcing,
  strict JSON Schema, Protobuf, Python/TypeScript CLI, MCP and A2A contracts.
- Kept implementation in WAIT_FOR_APPROVAL and isolated from active
  governance and SDK workstreams.
- Recorded the pre-existing ticket-019 governance findings without modifying
  that concurrent ticket.
- Recorded explicit interactive approval and transitioned to `EDIT` in a
  dedicated implementation worktree.
- Implemented role-bound CQRS/event sourcing, registry v2, strict schemas,
  deterministic diagnostics, projections and transport parity across both
  CLIs, MCP and A2A.
- Added TypeScript/Python golden Protobuf compatibility and security/concurrency
  regression coverage.
- Reached `VALIDATION`: application and Docker core gates pass; the first
  governance run was blocked by the inherited v0.7.0 single-ticket rule.
- Refreshed the isolated implementation branch to the committed 0.8.0
  workstream baseline so parallel tickets are evaluated by scope and ownership
  instead of a repository-wide single-ticket rule.
- Confirmed that 0.8.0 accepts tickets 018 and 020 concurrently; the remaining
  global findings belong only to ticket-019's declared dependency, conflict,
  ownership and overlap state.
- Confirmed implementation commit `06a2faa` is already contained in protected
  `main@68b4514`; no stale-branch merge is required.
- Revalidated the current main implementation with 9 focused intake tests and
  an explicit invalid-Base64 rejection probe.
- Re-ran full verification after installing the locked dependencies: 335
  tests, 334 passed, 0 failed and one explicit local missing-JDK skip.
- Closed ticket-020 under policy 0.10.0 after governance passed with 0 errors
  and 0 warnings; the closure is documentation-only and awaits exact-head App
  review before merge.
