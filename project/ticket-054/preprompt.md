# Ticket preprompt

- **Task ID**: ticket-054
- **Task title**: Todo2code-driven repair and skills expansion
- **Created**: 2026-08-08T17:27:54Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

## Technical directives

- Preserve the Doctor / Repair / Validator separation of duties.
- Todo2code output is evidence and advisory planning, never merge authority.
- Repair may mutate only through a bounded ticket branch and pull request.
- Validator must use a clean checkout of the current exact PR head.
- Keep `AUTO_MERGE=false`; do not let a target repository trigger its own
  trusted Validator review.
- Preserve unrelated changes in repair-agent's local main worktree.
