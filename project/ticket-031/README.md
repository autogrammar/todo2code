# Ticket 031: Restore semantic similarity contribution after linker refactor

- **ID**: ticket-031
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Restore the semantic score contribution accidentally dropped while
`scorePair` was split into focused helpers. The helper still computes and
records object/text similarity, but the caller no longer adds its numeric
value to the aggregate score. Exact path evidence therefore stops at `0.28`
or `0.41` and valid cross-source relations fall below the `0.42` threshold.

This is a bounded regression repair, not a change to the scoring model. The
architecture remains: candidate selection in `linker-candidates.ts`, scoring
in `linker.ts`, and relation direction in `linker-relations.ts`. Only
`src/graph/linker.ts` may change. No threshold, fixture, gold expectation or
generated analysis artifact may be edited. Expected implementation time is
under 30 minutes.

## Planned changed paths

- `src/graph/linker.ts`: add the already computed object-similarity value to
  the aggregate score exactly once.
- `project/ticket-031/**`, `TODO.md`, `project/TICKETS.md`: intent and evidence.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: `scorePair` adds object/text similarity to the aggregate score and
      continues to expose the same value as `textScore`.
- [x] AC-03: The shared-path plan/AST and configuration/document regression
      tests pass without lowering the `0.42` relation threshold.
- [x] AC-04: The versioned gold evaluation returns to its accepted precision,
      recall, known-gap and v1-compatibility results.
- [x] AC-05: The full suite reduces by the seven linker-related failures; no
      unrelated test or fixture is weakened.
- [x] AC-06: Clean build, focused tests, `git diff --check` and governance are
      recorded with inherited blockers kept separate.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `IN_PROGRESS / VALIDATION` after implementing and testing the
  bounded repair.
- Chat approval authorizes this interactive implementation only.
- Trusted merge evidence still requires an independent protected review or
  signed attestation bound to the final head SHA.

## Validation evidence

- `npm run build`: PASS.
- Focused AST, linker-pairing and gold evaluation: 27 passed, 0 failed.
- Full fresh suite: 338 tests, 333 passed, 4 failed and one skipped. The seven
  linker failures are gone. The remaining failures are the three separately
  diagnosed communication regressions plus the confidence-hierarchy test
  repaired independently by ticket-030/PR #7.
- `git diff --check`: PASS.
- `make governance`: reports only the four inherited ticket-018/ticket-019
  diagnostics; ticket-031 adds no scope or workstream finding.
