# Ticket preprompt

- **Task ID**: ticket-044
- **Task title**: Adopt immutable new-project 0.11.0
- **Created**: 2026-08-05T09:07:38Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

- Use only release SHA `cc9b04673bbd85cb4e35fb683d288ef34be1485f`.
- Preserve customized workstreams, stacks, Docker settings and delivery limits.
- Use the local Goal repository's `.venv/bin/goal`; the globally installed
  command does not expose the governance adapter.
- Do not implement runtime classification in this adoption ticket.
