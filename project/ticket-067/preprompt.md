# Ticket preprompt

- **Task ID**: ticket-067
- **Task title**: Enforce LLM-first todo2code analysis policy
- **Created**: 2026-08-11T16:37:52Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Human instruction: always use LLM with todo2code wherever it can produce a
better result, and enforce this logic for todo2code.

Interpretation boundary: LLM-first applies to audited semantic interpretation;
deterministic facts, validation, approval and mutation remain authoritative.
