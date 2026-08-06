# Ticket preprompt

- **Task ID**: ticket-049
- **Task title**: Validator autonomy audit, operator guide and refactor plan
- **Created**: 2026-08-06

## Context

Ticket-048 is in `VALIDATION` behind `GOV-APPROVAL`. Autonomy configuration of
`subactor/validator-agent` was incomplete: variables without `scan-direct` on
main and without a matrix leg for `semcod/todo2code`.

## Instructions for agents

- Read `AUTONOMY_AND_REFACTOR_PLAN.md` and `OPERATOR_GUIDE.md` first.
- Do not propose workflows in this repository that dispatch the Validator App.
- Do not mark autonomy "done" without matrix ∩ config ∩ enabled ∩ App ∩ green
  required checks ∩ attributable PR.
- Keep executable implementation outside this governance evidence directory.
- Read a human-owned `user-*.md` only when one exists.
