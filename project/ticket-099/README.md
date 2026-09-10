# Ticket 099: Ignore repository-local worktrees and operational state

- **ID**: ticket-099
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-10

## Goal and scope

Publish the remaining local Git ignore rules on the current protected main.
Both hidden delivery worktrees and legacy worktrees must stay outside the Git
index, together with private operational state. Extend the target's existing
governance workstream ownership to .gitignore, without modifying protected gates.

PR #117 remains a separate, unmerged project2.sh change in a checkout bound to
the coding-agent runtime. The overlap guard rejected a competing script edit;
this ticket therefore does not change project2.sh or that runtime checkout.
Git ignore rules do not establish exclusion by external analysis tools.

SESSION_EXECUTION_AUTHORIZATION records the user's 2026-09-10 request to continue,
push, merge through independent validation, and test. This audit record supplies
no protected approval. Preserve local generated reports and tool state; do not
publish duplicate checkout inventories or raw logs.

## Acceptance criteria

- [ ] AC-01: Root ignore rules exclude local worktrees and operational state while
  the tracked .subactor/manifest.json remains visible.
- [ ] AC-02: The governance workstream explicitly owns .gitignore; preserve
  PR #117, generated reports and the runtime checkout unchanged.
- [ ] AC-03: Ignore boundaries and managed governance pass before
  publication; retain required CI and independent Validator approval.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
