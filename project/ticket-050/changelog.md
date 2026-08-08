# Ticket Changelog (ticket-050)

## [0.1.0] - 2026-08-06

- Scaffolded plan for owning or excluding `CHANGELOG.md` and `.env.example`.

## [0.2.0] - 2026-08-08

- Recommended Option A with the existing governance workstream as sole owner.
- Documented the required upstream release and immutable Goal adoption path.
- Added regression, rollback and ticket-049 dependency constraints to the plan.

## [0.3.0] - 2026-08-08

- Recorded human approval of ticket-049 and Option A.
- Recorded the governance dependency gate: ticket-050 remains
  `PLAN / WAIT_FOR_APPROVAL` until ticket-049 is formally completed.

## [0.4.0] - 2026-08-08

- Bound adoption to immutable new-project `v0.12.0` at full release SHA
  `7be2e266dfebfe91de1b78abf30ac8e518453216`.
- Transitioned to `IN_PROGRESS / EDIT` after all dependencies completed.

## [0.5.0] - 2026-08-08

- Recorded immutable new-project `v0.13.0` at
  `12158ef0c009428deddceebb1049ddc3cb898eb3` with the approved atomic-adoption
  contract.
- Prepared the intent transition from installed v0.11.0 to v0.13.0 and resumed
  `IN_PROGRESS / EDIT` after explicit user authorization.

## [0.6.0] - 2026-08-08

- Adopted the complete hash-locked v0.13.0 managed package and preserved local
  workstream customization.
- Assigned `CHANGELOG.md` and `.env.example` to governance, recorded the
  ticket-048 release note and reconciled its stale active header with merged
  PR #66 evidence.
- Passed exact-base governance, idempotent Goal check, full host verification
  and Docker smoke; advanced to `IN_PROGRESS / VALIDATION`.

## [0.7.0] - 2026-08-08

- Recorded protected Koru's deterministic rejection of five pre-existing
  complexity findings in the managed v0.13.0 payload and PR #70's unmerged
  closure.
- Recorded upstream v0.13.1 at
  `7979cfe76797a4da6925be49496ff2462e78b3f7`, containing the approved
  behavior-preserving repair.
- Returned from `VALIDATION` to `EDIT` for exact-SHA re-adoption.

## [0.8.0] - 2026-08-08

- Replaced the managed v0.13.0 payload atomically with exact immutable
  new-project v0.13.1 at
  `7979cfe76797a4da6925be49496ff2462e78b3f7`.
- Passed idempotent Goal, exact-base governance, Vallm 0.1.94 with zero
  deterministic findings, full host verification and Docker smoke.
- Advanced from `EDIT` to `IN_PROGRESS / VALIDATION` for protected exact-head
  review.

## [0.9.0] - 2026-08-08

- Recorded protected governance's rejection of the stale target-local
  reusable-workflow reference at pre-adoption SHA `9706e63`.
- Added `.github/workflows/ci.yml` to the approved governance-owned scope and
  returned to `EDIT` to align its resolver with exact v0.13.1.

## [1.0.0] - 2026-08-08

- Pinned both the reusable governance workflow and its `standard-ref` input to
  exact immutable v0.13.1 SHA `7979cfe...`.
- Passed exact-base governance and workflow YAML validation, then returned to
  `IN_PROGRESS / VALIDATION` for fresh protected review.

## [1.1.0] - 2026-08-08

- Recorded v0.13.1's protected REST acquisition failure for
  `deleteBranchOnMerge`.
- Bound the next adoption to immutable v0.13.2 release SHA `85631ea`, which
  uses typed GraphQL acquisition and retains the strict validator.
- Returned from `VALIDATION` to `EDIT` for atomic re-adoption and caller
  alignment.

## [1.2.0] - 2026-08-08

- Adopted the complete managed package at immutable new-project v0.13.2 SHA
  `85631ea24d127f1f4797d2a67f3524a63cbbc95a` and aligned both reusable
  workflow references to that revision.
- Confirmed Goal idempotency, exact-base governance, workflow YAML, full host
  verification and Docker smoke.
- Advanced from `EDIT` to `IN_PROGRESS / VALIDATION` for fresh exact-head
  protected review.

## [1.3.0] - 2026-08-08

- Recorded the exact-head Validator, Koru and PR-context governance passes.
- Identified the remaining merge blocker as a duplicate feature-branch push
  check without the base and PR bindings required for atomic adoption.
- Returned to `EDIT` to retain push governance on the default branch while
  leaving pull-request and review gates unchanged.

## [1.4.0] - 2026-08-08

- Limited the duplicate `push` governance invocation to the repository's
  default branch; feature branches remain governed by PR and review events.
- Passed workflow YAML and exact-base governance after the caller change.
- Advanced from `EDIT` to `IN_PROGRESS / VALIDATION` for a new exact-head
  protected review.

## [1.5.0] - 2026-08-08

- Confirmed that same-name failing check-runs remain conjunctive even after a
  later exact-head governance pass.
- Returned to `EDIT` to distinguish submitted and same-HEAD dismissed reviews
  from pre-approval PR events and stale-review auto-dismissals.
