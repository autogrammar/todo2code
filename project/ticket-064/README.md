# Ticket 064: Exclude decision evidence from participant communication

- **ID**: ticket-064
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-11

## Goal and scope

Stop treating governance decision evidence such as `decisions.md` as anonymous
participant communication. Explicit communication front matter must continue to
override the evidence-file exclusion.

This ticket owns only the extractor change. A separate interfaces-workstream
ticket must own the regression test because `test/communication*` is not owned
by `extractors`.

## Acceptance criteria

- [ ] AC-01: An unannotated `project/ticket-*/decisions.md` produces no
  participant records or identity warnings.
- [ ] AC-02: A `decisions.md` file with explicit communication front matter is
  still parsed.
- [ ] AC-03: A separately governed interfaces test proves both cases.
- [ ] AC-04: Deterministic pipeline, governance, and Docker validation pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization and blocker

The user authorized the audit-driven cleanup with `tak` on 2026-08-11. The
implementation remains blocked while active `ticket-060` reserves the
`extractors` workstream; no source edit is authorized until that reservation is
released.
