# Ticket 080: Bind runtime version assertions to T2C_VERSION

- **ID**: ticket-080
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-17

## Goal and scope

Replace hardcoded `0.5.0` runtime version assertions in runtime-owned tests
with the shared `T2C_VERSION` constant so a later core-dsl version bump does
not require cross-workstream test edits.

## Acceptance criteria

- [x] AC-01: `test/pipeline.test.ts` and `test/code-change-plan.test.ts` assert
      against `T2C_VERSION`.
- [x] AC-02: Build, tests and governance pass for the runtime scope.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-gpt-5.6-sol.md](ai-gpt-5.6-sol.md)

## SESSION_EXECUTION_AUTHORIZATION

The user's instruction to continue outstanding work and push authorizes this
bounded runtime assertion fix.
