# Ticket 026: Repair current runtime action dispatch

- **ID**: ticket-026
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-04

## Goal and scope

Repair the current action-dispatch split by calling `executeDiffGitAction` with
its actual two-argument contract. The extra configuration argument is unused
and became a strict TypeScript error after extraction. No diff behavior changes
are in scope.

Full aggregate tests also found three runtime/interface assertions pinned to
the retired `0.5.0` value even though the package and canonical runtime now
report `0.5.2`. This follow-up updates only those exact assertions; it does not
change runtime behavior.

## Acceptance criteria

- [x] AC-01: The human instructed the agent to continue iterative repair.
- [x] AC-02: Runtime action dispatch compiles and diff-git behavior remains
      covered by existing tests.
- [x] AC-03: Aggregate verification and governance pass.
- [x] AC-04: Code-change CLI, offline pipeline and Python runtime adapter tests
      assert the canonical `0.5.2` release.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- The user's `kontynuuj` authorizes this exact runtime repair; protected review
  remains required for merge.
