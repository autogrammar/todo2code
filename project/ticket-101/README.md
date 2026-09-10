# Ticket 101: Exclude local worktrees from project analysis tools

- **ID**: ticket-101
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-10

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: the user's 2026-09-10 request to continue,
push, merge through independent validation, and test covers this delivery.
It does not supply trusted approval or authorize a production deployment.

Carry the exact project2.sh change from PR #117 (source commit
43ffff549f92a5fffe03dde68144578c61aabb43) onto current protected main:
pass the literal .worktrees/** exclusion to prefact alongside examples/**.
Assign project2.sh to the existing governance workstream in the extendable
target manifest. Do not alter protected gates or managed hashes.

Preserve the original PR branch and commit. Its historical checkout is clean
and now detached at protected main; effective systemd runtime is a different
deployment checkout and remains unchanged. Do not publish raw generated
reports or change the concurrent watcher work in ticket-100.

## Acceptance criteria

- [ ] AC-01: project2.sh is byte-identical to PR #117's version and retains the
  quoted prefact exclusion without executing the heavy generation pipeline.
- [ ] AC-02: Shell syntax, focused argument checking, full offline verification
  and smoke pass; required hosted checks and independent exact-head approval
  remain mandatory for protected merge.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
