# Ticket Changelog (ticket-047)

## [0.2.0] - 2026-08-05

- Ticket-047 was explicitly approved and moved to `IN_PROGRESS / EDIT`.
- Declared one-event-payload acquisition adapter boundary for push, PR, PR review
  and completed workflow_run payloads.
- Reused the ticket-046 codec and atomic publication contract for
  `t2c.event-log/v1` streams.
- Added deterministic GitHub→event mapping with strict allowlisted evidence
  projections and repository/ticket/sha/actor validation.
- Added bounded integration tests for mapping, repeatability, review trust class,
  unsupported-event fail-closed behavior and evidence sanitization.

## [0.1.0] - 2026-08-05

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Defined a bounded GitHub payload acquisition plan dependent on ticket-046.
- Split acquisition from later workflow wiring so integration and governance
  paths do not overlap in one ticket.
- Kept the existing `t2c.event-log/v1` codec as the single renderer, validator,
  digest-chain and atomic-publication authority.
