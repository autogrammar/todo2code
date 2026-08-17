# Ticket 078: Make governed ticket README NL extraction section-aware

- **ID**: ticket-078
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-17

## Goal and scope

Make deterministic NL extraction of governed ticket README files safe for
human ticket review. Parse by semantic sections rather than treating
`Status`, `Owner` and wrapped lines as independent requirements.

Follow-up tickets own missing-path create policy (`src/synthesis`) and
runtime version identity (`src/core/version.ts`).

## Acceptance criteria

- [x] AC-01: Governed ticket metadata is excluded from NL intent and wrapped
      goals/acceptance criteria remain single records with correct source lines.
- [x] AC-02: Acceptance criteria are classified as validation intent and are not
      flagged for missing action/evidence solely because they use `AC-NN`.
- [x] AC-03: Typecheck, tests and governance pass for the extractors scope.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-gpt-5.6-sol.md](ai-gpt-5.6-sol.md)

## SESSION_EXECUTION_AUTHORIZATION

The user's instruction to repair and test the audited tools authorizes this
bounded ticket-safety correction in the extractors workstream.
