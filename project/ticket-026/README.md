# Ticket 026: Repair current runtime action dispatch

- **ID**: ticket-026
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-04

## Goal and scope

Repair the current action-dispatch split by calling `executeDiffGitAction` with
its actual two-argument contract. The extra configuration argument is unused
and became a strict TypeScript error after extraction. No diff behavior changes
are in scope.

## Acceptance criteria

- [x] AC-01: The human instructed the agent to continue iterative repair.
- [ ] AC-02: Runtime action dispatch compiles and diff-git behavior remains
      covered by existing tests.
- [ ] AC-03: Aggregate verification and governance pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- The user's `kontynuuj` authorizes this exact runtime repair; protected review
  remains required for merge.
