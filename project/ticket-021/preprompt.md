# Ticket preprompt

- **Task ID**: ticket-021
- **Task title**: Restore reproducible project analysis generation
- **Created**: 2026-08-04T20:09:52Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

This phase is governance-only. Do not run `code2llm`, regenerate `project/*`,
add an analysis container or modify the managed `project.sh`. Limit any approved
implementation to the target manifest and its genuine lock evidence. Preserve
the separation between root-level generated analysis and ticket communication.
