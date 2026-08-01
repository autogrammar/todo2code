# Ticket preprompt

- **Task ID**: ticket-020
- **Task title**: Role-bound trusted intake with CQRS ES Protobuf MCP and A2A
- **Created**: 2026-08-01T11:23:59Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Treat manager-*, user-* and dev-* as human-owned projections. Only a trusted
intake boundary may create or update them. Keep identity, authorization,
schema, event integrity and required acceptance deterministic and LLM-free.
