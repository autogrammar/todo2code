# Ticket preprompt

- **Task ID**: ticket-046
- **Task title**: Generate canonical pipeline event logs
- **Created**: 2026-08-05T11:44:07Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Implement only the approved per-run event-log codec and pipeline persistence.
Do not acquire or invent GitHub events, mutate completed logs, add a dependency
or widen the public API in this ticket.
