# Ticket preprompt

- **Task ID**: ticket-068
- **Task title**: Default user-facing semantic pipelines to LLM-first
- **Created**: 2026-08-11T16:44:09Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Human instruction: always use LLM with todo2code wherever it can produce a
better result, and enforce this logic for todo2code.

Bound this slice to user-facing CLI, MCP and A2A defaults; keep explicit offline
and fallback controls. Direct service/runtime defaults remain separately owned.
