# Ticket preprompt

- **Task ID**: ticket-047
- **Task title**: Collect bounded GitHub evidence into event logs
- **Created**: 2026-08-05

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Implement only the approved single-payload GitHub acquisition adapter. Do not
call the GitHub API, edit `.github/workflows/**`, mutate or commit a completed
`logs.dsl.txt`, add a dependency or widen the public API in this ticket.

> Restored by ticket-048. The original file was never committed with the
> ticket-047 implementation, so only the date is recorded; the exact scaffold
> timestamp is unknown and is not reconstructed here.
