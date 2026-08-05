---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-044
---
# Participant: codex (AI agent)

## Understanding

todo2code is pinned to new-project 0.10.0 at
`9706e63d5f121323e9087d0db47a16acdbd276bb`. The published 0.11.0 package adds
the canonical classification DSL, its schema and the current approval evidence
contract. The adoption generator intentionally refuses the current target
manifest until its declared standard version is reviewed and changed to
0.11.0.

## Execution plan

1. After approval, transition ticket-044 to `IN_PROGRESS / EDIT`.
2. Change only the target manifest's standard version, preserving customization.
3. Run local Goal's immutable adoption adapter with `--check`, review the plan,
   then apply it with `--upgrade`.
4. Verify lock provenance and managed DSL hashes.
5. Run governance, focused/full Node checks and Docker smoke validation.
6. Publish a ticket-scoped PR for independent exact-head validation.

## Actual changes

- None; waiting for approval.

## Blockers

- Human approval is required before implementation.

## Preflight evidence

- Docker client/server: 29.1.3 / 29.1.3.
- Global Goal lacks the governance command.
- Local `.venv/bin/goal` exposes `governance adopt`.
- Read-only adoption preflight stops on the expected 0.10.0 -> 0.11.0 manifest
  compatibility boundary before writing.
