# Ticket preprompt

- **Task ID**: ticket-018
- **Task title**: Enforce new-project governance as policy-as-code
- **Created**: 2026-08-01T09:54:58Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

The user requested automated code review using Koru. Plan a read-only, pinned
and attested pull-request check which cannot mutate source or self-approve,
uses the existing organization OpenRouter secret only in the safe
`pull_request` context, fails closed, and becomes a required `main` ruleset
check. Stop again in `WAIT_FOR_APPROVAL` before editing CI or external
repository rules.
