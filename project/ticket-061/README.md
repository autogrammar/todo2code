# Ticket 061: Use canonical version in runtime behavior assertions

- **ID**: ticket-061
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-08

## Goal and scope

Replace two literals that assert current runtime output in the pipeline and
code-change tests with `T2C_VERSION`. This prevents those tests from freezing
the stale `0.5.0` identity while preserving explicitly historical fixtures.

## Acceptance criteria

- [x] AC-01: A human approves the two-test-file scope.
- [x] AC-02: Current pipeline manifest and code-change close-result assertions
      use `T2C_VERSION`.
- [ ] AC-03: Focused runtime tests pass when combined with ticket-059.
- [x] AC-04: No historical/live-contract input fixture is rewritten.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md).

## Approval gate

The human approved tickets 059–063 and transition to `EDIT` after dependencies
on 2026-08-09. Ticket-058 remains the integration coordinator, not an
unfinished implementation prerequisite.

## Non-goals

- No runtime source, Python SDK test, dependency, Docker or fixture change.
- No broad mechanical replacement of every `0.5.0` occurrence.
