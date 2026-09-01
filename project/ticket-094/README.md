# Ticket 094: Reconcile linker split governance evidence

- **ID**: ticket-094
- **Owner**: agent:codex under the current human retention approval
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-01

## Goal and scope

Reconcile the protected merge of PR #110 without rewriting its history. The PR
split `src/graph/linker.ts` into focused modules and is functionally healthy,
but it reused `ticket-088`, whose approved goal and acceptance criteria cover a
different same-source contradiction defect. The PR changed only that ticket's
`intent.json` plus executable linker files; it did not add a matching ticket
goal, plan, acceptance criteria or execution log.

If the human owner approves retention, restore `ticket-088/intent.json` to the
scope delivered by its own protected PR #103, append the PR #110 scope mismatch
as immutable audit evidence, and explicitly accept the already-merged linker
split at exact audited main `aa20ec43e284a7f47ecbe8386978b6b2a8058341`
under this reconciliation ticket. Do not claim that the new approval existed
before PR #110, and do not change executable code.

## Acceptance criteria

- [x] AC-01: A human owner explicitly chooses to retain the audited linker
      split and approves this documentation-only reconciliation.
- [ ] AC-02: The record binds PR #110, implementation HEAD `dd5fa3a080c5611`,
      merge `dcbf9ef2729b2174`, reviewer `ifuri-validator-agent[bot]`, the
      mismatched `ticket-088` binding and final audited main `aa20ec43e284a7f`.
- [ ] AC-03: `ticket-088` again describes only the scope approved and delivered
      through PR #103; an appended note preserves PR #110 as a historical scope
      violation rather than laundering it into that ticket.
- [ ] AC-04: No executable source, test, workflow, dependency, generated
      runtime artifact or human-owned participant file changes.
- [ ] AC-05: Governance, full offline verification, Docker smoke and whitespace
      checks pass on the exact reconciliation diff.

## Participants

- Human participant: the current session user; explicit approval is still
  required and no `user-*` file was created or modified.
- Agent participant: [ai-codex.md](ai-codex.md)
