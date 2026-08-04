# Ticket preprompt

- **Task ID**: ticket-036
- **Task title**: Canonical multi-source truth map DSL
- **Created**: 2026-08-04T20:20:26Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Use the existing `IntentGraph` as the canonical evidence boundary. Build a
deterministic derived map; do not create a parallel extractor contract, infer
human approval, call an LLM, overwrite conflicts or edit paths outside the
core-dsl allowlist. Preserve every input record through an exactly-once reverse
mapping and reject malformed/dangling graph data before projection.
