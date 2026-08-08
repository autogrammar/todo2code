# Ticket 059: Align core runtime version with release identity

- **ID**: ticket-059
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-08

## Goal and scope

Correct the single core runtime constant from `0.5.0` to the accepted release
identity `0.5.1`. This makes CLI output and newly generated provenance truthful
without changing schemas, dependencies, historical artifacts or authority.

The one implementation path is `src/core/version.ts`, owned by `core-dsl`.
Tests with stale current-version literals are owned by sibling tickets under
the ticket-058 integration plan.

## Acceptance criteria

- [x] AC-01: A human approves this exact one-file implementation scope.
- [ ] AC-02: `T2C_VERSION` and `t2c --version` report `0.5.1`.
- [ ] AC-03: New runtime provenance reports `0.5.1`; historical fixtures are
      unchanged.
- [ ] AC-04: TypeScript check/build pass locally and the combined ticket-058
      branch passes the complete verification suite.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md).

## Approval gate

The human approved tickets 059–063 and transition to `EDIT` after dependencies
on 2026-08-09. Ticket-059 has no unfinished implementation dependency;
ticket-058 is its coordinator, not a prerequisite.

## Non-goals

- No release bump, package manifest, test, SDK or Docker change.
- No rewriting of already materialized evidence.
- No model command execution or mutation/authority change.
