# Ticket preprompt

- **Task ID**: ticket-051
- **Task title**: Wire github-event-log acquisition into CI without ambient env reads
- **Created**: 2026-08-06

## Rules

- Wait until ticket-048 is on protected `main` unless the human explicitly
  allows a stacked PR.
- Pass Actions context into **argv only**.
- Do not expand this ticket into Validator approval logic.
