# Ticket 044: Adopt immutable new-project 0.11.0

- **ID**: ticket-044
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-05

## Goal and scope

Upgrade the repository's immutable governance package from new-project 0.10.0
to the published 0.11.0 release SHA
`cc9b04673bbd85cb4e35fb683d288ef34be1485f`. Preserve todo2code's customized
workstreams and Docker/stack settings, while installing the canonical
work-classification DSL and Validator App evidence contract.

This ticket changes governance artifacts only. Adding `kind`, `origin` or the
canonical comparator to todo2code runtime output is a subsequent `core-dsl`
ticket.

## Acceptance criteria

- [ ] AC-01: Scope and immutable source SHA are approved by a human owner.
- [ ] AC-02: The target manifest keeps repository-specific ownership and uses
  standard version 0.11.0.
- [ ] AC-03: `goal governance adopt --check` reports only the reviewed upgrade,
  then `--upgrade` installs it without unmanaged drift.
- [ ] AC-04: The lock records version 0.11.0, published status and the exact
  release SHA; both work-classification files are managed.
- [ ] AC-05: Governance, Node verification and Docker smoke tests pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Risks

- `ticket-043` remains in validation on `main`; ticket-044 stays `PLAN` and
  does not reserve scope until approved.
- The target manifest version must be advanced before the immutable adoption
  generator can calculate a cross-version upgrade.
