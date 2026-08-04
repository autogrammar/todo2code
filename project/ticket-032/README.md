# Ticket 032: Restore declared Git author mismatch warning

- **ID**: ticket-032
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Restore the participant-registry warning lost while communication extraction
was split into helpers. The refactor computes both declared and registry-owned
Git authors, but retains only the resolved list. Warning logic consequently
compares the registry list with itself and can never report a mismatch.

The repair will retain the declared authors as internal metadata and compare
them with the trusted registry value before continuing to publish only the
registry-owned authors. It will not trust front matter, change participant
identity resolution or edit tests. One production file is allowed and the
expected implementation time is under 30 minutes.

## Planned changed paths

- `src/extractors/communication-file-helpers.ts`: preserve declared Git authors
  for validation and use them in the mismatch check.
- `project/ticket-032/**`, `TODO.md`, `project/TICKETS.md`: intent and evidence.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: A declaration differing from the participant registry emits the
      existing `git-authors differ` warning.
- [x] AC-03: Emitted record metadata still uses registry-owned Git authors and
      never accepts the conflicting declaration.
- [x] AC-04: Communication identity tests, build and full suite are rerun
      without weakening assertions.
- [x] AC-05: Only the allowed production and governance paths change.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `IN_PROGRESS / VALIDATION` after implementing and testing the
  bounded repair.
- Chat approval authorizes this interactive implementation only; merge still
  requires trusted independent evidence for the final SHA.

## Validation evidence

- `npm run build`: PASS.
- Focused communication identity suite: 2 passed, 0 failed.
- Full fresh suite on isolated base: 338 tests, 327 passed, 10 failed and one
  skipped. The `git-authors differ` failure is removed. The remaining failures
  are covered by independent ticket-030/ticket-031 changes plus the two prompt
  path failures reserved for the next interfaces ticket.
- `git diff --check`: PASS.
- `make governance`: only four inherited ticket-018/ticket-019 diagnostics;
  no ticket-032 scope or workstream finding.
