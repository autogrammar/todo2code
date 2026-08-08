# Ticket 061: Use canonical version in runtime behavior assertions

- **ID**: ticket-061
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-08

## Goal and scope

Replace two literals that assert current runtime output in the pipeline and
code-change tests with `T2C_VERSION`. This prevents those tests from freezing
the stale `0.5.0` identity while preserving explicitly historical fixtures.

## Acceptance criteria

- [ ] AC-01: A human approves the two-test-file scope.
- [ ] AC-02: Current pipeline manifest and code-change close-result assertions
      use `T2C_VERSION`.
- [ ] AC-03: Focused runtime tests pass when combined with ticket-059.
- [ ] AC-04: No historical/live-contract input fixture is rewritten.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md).

## Approval gate

Ticket-058 approval authorized creation only. No test edit is allowed before
explicit approval of ticket-061.

## Non-goals

- No runtime source, Python SDK test, dependency, Docker or fixture change.
- No broad mechanical replacement of every `0.5.0` occurrence.
