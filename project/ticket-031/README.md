# Ticket 031: Restore semantic similarity contribution after linker refactor

- **ID**: ticket-031
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
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
- [ ] AC-02: `scorePair` adds object/text similarity to the aggregate score and
      continues to expose the same value as `textScore`.
- [ ] AC-03: The shared-path plan/AST and configuration/document regression
      tests pass without lowering the `0.42` relation threshold.
- [ ] AC-04: The versioned gold evaluation returns to its accepted precision,
      recall, known-gap and v1-compatibility results.
- [ ] AC-05: The full suite reduces by the seven linker-related failures; no
      unrelated test or fixture is weakened.
- [ ] AC-06: Clean build, focused tests, `git diff --check` and governance are
      recorded with inherited blockers kept separate.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `IN_PROGRESS / EDIT` after explicit chat approval.
- Chat approval authorizes this interactive implementation only.
- Trusted merge evidence still requires an independent protected review or
  signed attestation bound to the final head SHA.
