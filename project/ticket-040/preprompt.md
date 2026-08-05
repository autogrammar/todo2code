# Ticket preprompt

- **Task ID**: ticket-040
- **Task title**: Detect unsafe workspace state before governed edits
- **Created**: 2026-08-05T07:01:26Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Plan a dependency-free, read-only runtime preflight over local Git facts and
the existing governance checker's JSON. Do not duplicate policy matching in
TypeScript and do not add a mutation, network, CLI or approval surface.
