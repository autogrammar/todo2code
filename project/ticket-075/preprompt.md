# Ticket preprompt

- **Task ID**: ticket-075
- **Task title**: Ignore generated remediation projections as participant communication
- **Created**: 2026-08-12T15:58:06Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Reproduce with a deterministic pipeline over a target ticket containing
generated `REMEDIATION.task.md` and `REMEDIATION.todo.md`. Preserve explicit
participant front matter as the only opt-in when an evidence-like filename is
deliberately used for communication. Do not infer or create a human identity.
