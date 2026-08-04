# Ticket 032: Restore declared Git author mismatch warning

- **ID**: ticket-032
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
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

- [ ] AC-01: Scope is approved by a human owner.
- [ ] AC-02: A declaration differing from the participant registry emits the
      existing `git-authors differ` warning.
- [ ] AC-03: Emitted record metadata still uses registry-owned Git authors and
      never accepts the conflicting declaration.
- [ ] AC-04: Communication identity tests, build and full suite are rerun
      without weakening assertions.
- [ ] AC-05: Only the allowed production and governance paths change.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `PLAN / WAIT_FOR_APPROVAL`.
- Chat approval authorizes this interactive implementation only; merge still
  requires trusted independent evidence for the final SHA.
