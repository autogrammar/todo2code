# Ticket preprompt

- **Task ID**: ticket-010
- **Task title**: Incremental extraction cache
- **Owner**: unresolved:human
- **Repository**: todo2code

Add a fail-open, content-addressed cache for deterministic AST extraction and
documentation chunking. Preserve byte-for-byte-equivalent extraction output,
never cache provider responses, measure cold/warm behavior on real repository
snapshots, and keep all executable implementation outside this ticket directory.
