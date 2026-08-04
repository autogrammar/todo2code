# Ticket 037: Reconcile protected completion narrative

- **ID**: ticket-037
- **Issue**: [#37](https://github.com/semcod/todo2code/issues/37)
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PLAN
- **Created**: 2026-08-04

## Goal and scope

Reconcile the ticket-036 participant narrative with the immutable protected
merge evidence already recorded by PRs #35 and #36. Ticket 036 is `DONE`, but
its `Blockers` section still says exact-head review and merge are pending.

This ticket owns only that stale statement plus its own governance records. It
does not change the truth-map implementation, reopen ticket 036 or absorb the
separate Goal, Koru and Validator follow-up workstreams.

## Delivery boundary

- Workstream: `documentation`.
- Complexity: `XS`.
- Expected managed change: `project/ticket-036/ai-codex.md`.
- Supporting records: `TODO.md` and `project/ticket-037/*`.

## Acceptance criteria

- [ ] AC-01: Ticket 036 no longer claims that completed exact-head review and
      protected merge are pending.
- [ ] AC-02: The correction preserves the boundary around separate
      cross-repository follow-up work.
- [ ] AC-03: Governance and repository verification pass.
- [ ] AC-04: An autonomous exact-head review uses
      `openrouter/z-ai/glm-5.2` before protected merge.
- [ ] AC-05: Completion evidence is recorded and issue #37 is closed.

## Participants

- Human participant: unresolved; no human-authored participant file is
  fabricated.
- Agent participant: [ai-codex.md](ai-codex.md).
