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
- Refreshed `acceptedBaseSha` from the historical routing point to the actual
  branch/main merge-base `738d7be` before protected review.

## [0.4.0] - 2026-08-09

- Opened draft owner PRs #78-#82 for the approved remote ticket branches,
  resolving deterministic branch lifecycle ownership.
- Recorded protected `GOV-SYNC-001`: the target workflow still ran the v0.13.2
  parser against the adopted v0.14.0 package contract.
- Returned to `EDIT`, expanded the ordinary adoption budget from two to three
  files, and aligned both workflow references to exact SHA `a22eb47`.

## [0.5.0] - 2026-08-09

- Passed fresh verify, Java, Koru, deterministic exact-head Validator and
  review-triggered governance on final head `b33e49c`.
- Merged protected PR #77 as `main@a762580` and recorded the transient
  no-PR-base push diagnostic while the completed adoption ticket remained
  active.
- Completed all acceptance criteria and closed the ticket as `DONE / DONE`,
  unblocking ticket-063.
