# Ticket 079: Withhold invented create plans for missing nested paths

- **ID**: ticket-079
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-17

## Goal and scope

Deterministic code-change plans must not invent `create` actions for missing
nested repository paths when the source only describes or updates them.
Explicit add/create/implement intents may still propose missing files.

## Acceptance criteria

- [x] AC-01: Descriptive update intents keep existing paths as `modify` and
      withhold missing nested paths instead of inventing `create`.
- [x] AC-02: Explicit add/create intents may still propose `create` for missing
      nested paths.
- [x] AC-03: Typecheck, tests and governance pass for the llm workstream scope.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-gpt-5.6-sol.md](ai-gpt-5.6-sol.md)

## SESSION_EXECUTION_AUTHORIZATION

The user's instruction to continue repairing audited tools authorizes this
bounded create-safety correction after ticket-078.
