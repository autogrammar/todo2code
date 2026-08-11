# Ticket 065: Prove decision evidence exclusion

- **ID**: ticket-065
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-11

## Goal and scope

Add the interfaces-owned regression proving that unannotated governance
`decisions.md` files remain ticket evidence rather than anonymous participant
communication, while explicit communication front matter still opts in.

## Acceptance criteria

- [ ] AC-01: The test fails against the current omission and passes with
  `ticket-064`.
- [ ] AC-02: Unannotated decision evidence yields zero communication records and
  zero participant warnings.
- [ ] AC-03: Explicit front matter retains the documented override behavior.
- [ ] AC-04: Focused, full, governance, and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization and blocker

The user authorized the audit-driven cleanup with `tak` on 2026-08-11. This
test ticket remains blocked on the extractor implementation in `ticket-064`.
