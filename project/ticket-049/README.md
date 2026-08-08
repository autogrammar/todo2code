# Ticket 049: Validator autonomy audit, operator guide and refactor plan

- **ID**: ticket-049
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-06

## Goal and scope

Record what still blocks autonomous publication of governed PRs (ticket-048 /
PR #66 as the concrete case), publish an operator guide that agents must follow
before claiming "autonomy is configured", and produce a refactor plan that
closes the false-positive paths agents take when repo variables exist but the
reviewer never runs.

This ticket is **documentation and planning only**. It does not change
executable source, CI, or the external `subactor/validator-agent` repository.
Implementation work is split into sibling tickets (050–052) and, where the
code lives outside this repository, into explicit external follow-ups listed in
[AUTONOMY_AND_REFACTOR_PLAN.md](AUTONOMY_AND_REFACTOR_PLAN.md).

## Acceptance criteria

- [x] AC-01: A written audit names every layer that must be true for Validator
  App approval to land on `semcod/todo2code` without a human filling a form.
- [x] AC-02: The operator guide documents the difference between
  `DIRECT_PR_SCAN_*` variables, the `scan-direct` job matrix, `direct-pr`
  dispatch, and the trust root ("reviewed repository never triggers its own
  reviewer").
- [x] AC-03: The refactor plan lists ordered work items with owning repository,
  workstream, and whether the item is blocked on ticket-048 publication.
- [x] AC-04: Sibling tickets 050–052 exist in `PLAN`/`BACKLOG` with scoped
  intent stubs and no overlapping `IN_PROGRESS` claim against ticket-048.
- [x] AC-05: The user accepted the plan on 2026-08-08 before ticket-050 moved
  to `IN_PROGRESS`.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participants: [ai-grok.md](ai-grok.md),
  [ai-codex.md](ai-codex.md)

## Architecture and bounds

- Component 1: ticket-local evidence under `project/ticket-049/**`
  (audit, operator guide, refactor plan).
- Component 2: index updates in `TODO.md` and `project/TICKETS.md` only.
- No edits to `src/**`, `scripts/**`, `.github/**`, or
  `subactor/validator-agent` under this ticket.
- Complexity class: XS; documentation only.

## Non-goals

- No merge of PR #66 from this ticket.
- No change to the hash-locked `.governance/manifest.json` workstream map.
- No self-approval path that lets a PR in `todo2code` trigger its own Validator
  review.
- No executable refactor of validator-agent (tracked as external work items in
  the plan).

## Current blocker snapshot (2026-08-06)

| Layer | Expected | Observed |
| --- | --- | --- |
| PR #66 product checks | verify, Java, koru green | green |
| PR #66 governance structure | GOV-PASS for intent/ticket | GOV-PASS |
| PR #66 GOV-APPROVAL | trusted Validator (or human) review on exact head | **missing** — merge BLOCKED |
| `DIRECT_PR_SCAN_ENABLED` | true | true |
| `DIRECT_PR_SCAN_CONFIG` | includes `semcod/todo2code` | set (complete JSON) |
| `scan-direct` on `validator-agent` main | job + matrix leg for todo2code | **landed** via PR #8 merge `95c62a2` |
| Live `direct-pr` for #66 | bot review on head `95a4d91…` | **in flight / flaky** (Actions CDN 503, queue pressure) |
| Trust root | reviewer outside reviewed repo | preserved |

## Related tickets

| Ticket | Role |
| --- | --- |
| [ticket-048](../ticket-048/README.md) | Active publication of the GitHub event acquisition adapter (PR #66) |
| [ticket-050](../ticket-050/README.md) | Own or explicitly exclude unpublishable root paths |
| [ticket-051](../ticket-051/README.md) | Wire acquisition into CI without ambient env |
| [ticket-052](../ticket-052/README.md) | Operator checklist for external Validator App autonomy |

## Approval outcome

The user accepted this documentation plan on 2026-08-08. Sibling tickets may
now move independently to `IN_PROGRESS` only after their own scope is approved
and their dependency and ownership checks pass.
