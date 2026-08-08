# Ticket preprompt

- **Task ID**: ticket-047
- **Task title**: Collect bounded GitHub evidence into event logs
- **Created**: 2026-08-05T12:36:58Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Implement only the approved GitHub payload acquisition adapter and its bounded
integration evidence. Reuse the ticket-046 codec. Do not edit workflows, poll
GitHub APIs, add a second DSL/renderer, append completed logs, publish a public
command or convert ordinary/LLM review into trusted approval.
