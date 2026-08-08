# Ticket Changelog (ticket-062)

## [0.1.0] - 2026-08-08

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Recorded the unowned Python SDK bridge test and immutable-lock constraint.
- Selected protected upstream extension/adoption instead of a local authority
  edit.
- Passed governance with zero errors and zero warnings.
- Recorded human approval and moved to `BLOCKED / WAIT_FOR_EXTERNAL` without
  changing governance authority.

## [0.2.0] - 2026-08-09

- Verified immutable upstream v0.14.0 release SHA `a22eb47` after its
  protected and clean detached validation.
- Bound the approved atomic adoption from installed v0.13.2 SHA `85631ea` to
  exact v0.14.0 SHA and entered `IN_PROGRESS / EDIT` before mutation.

## [0.3.0] - 2026-08-09

- Atomically adopted the full v0.14.0 managed payload and added the exact
  Python bridge test path to the now target-owned SDK workstream.
- Passed idempotent adoption, exact-base governance, managed hash/base
  invariants and all 405 project tests (one explicit JDK-unavailable skip).
- Completed all local acceptance criteria and advanced to `VALIDATION`.
