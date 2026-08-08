# Ticket 063: Use canonical version in Python SDK runtime assertion

- **ID**: ticket-063
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-08

## Goal and scope

Replace the current CLI version literal inside the Python SDK bridge test with
the canonical `T2C_VERSION`. The edit may start only after ticket-062 assigns
this currently unowned test path to the `sdk` workstream through protected
governance evolution.

## Acceptance criteria

- [x] AC-01: A human approves the one-test-file SDK scope.
- [ ] AC-02: Ticket-062 proves deterministic SDK ownership before `EDIT`.
- [ ] AC-03: The Python bridge compares CLI output with `T2C_VERSION`, not a
      copied `0.5.0` literal.
- [ ] AC-04: The focused Python runtime test passes with ticket-059.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md).

## Approval gate

The human approved ticket-063 on 2026-08-09. It remains non-active and no test
edit is permitted until the ownership contract from ticket-062 is adopted.

## Non-goals

- No Python SDK behavior, runtime source, dependency or Docker change.
- No governance manifest or lock edit in this ticket.
