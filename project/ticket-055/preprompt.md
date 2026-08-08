# Ticket preprompt

- **Task ID**: ticket-055
- **Task title**: Project-derived OpenRouter application identity
- **Created**: 2026-08-08T17:53:47Z

Implement one deterministic OpenRouter application-name precedence rule:

1. use a trimmed, non-empty `OPENROUTER_APP_NAME`;
2. otherwise use the basename of the resolved project root;
3. retain a non-empty final fallback for an exceptional filesystem root.

Do not change model selection, credentials, network routing, provider request
bodies or public interfaces. Keep executable implementation outside this
governance/evidence directory and never create or edit a `user-*.md` file.
