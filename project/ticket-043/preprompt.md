# Ticket preprompt

- **Task ID**: ticket-043
- **Task title**: Add a governed workspace preflight command
- **Created**: 2026-08-05T08:24:13Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Plan one explicit, read-only `make preflight` boundary over the existing
ticket-040 service. Do not duplicate Git/governance semantics and do not edit
implementation before exact human approval.
