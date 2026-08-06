# Ticket preprompt

- **Task ID**: ticket-053
- **Task title**: Match the local governance gate to CI before push
- **Created**: 2026-08-06

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Wrap the existing `project/governance-check.sh` in its CI form. Do not write a
second checker, do not add or change a governance diagnostic, do not touch
`.governance/**` or the pinned standard, and do not install a Git hook.
Resolve the workstream question in the README before starting: `Makefile` is
owned by both `governance` and `integration`, and `integration` is currently
held by ticket-048.
