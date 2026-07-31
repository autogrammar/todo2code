# Participant: Codex (AI agent)

- **Ticket**: ticket-007
- **Role**: agent

## Understanding

Communication analysis must not emit an empty response route when it knows the
required role. Missing identity is a first-class unresolved state, not
permission to infer or manufacture a person.

## Execution plan

1. Reproduce the agent-only ticket case in an offline test.
2. Centralize fallback routing at communication-issue construction.
3. Preserve known stable participant IDs.
4. Document the sentinel contract and update readiness evidence.
5. Run focused tests, gold evaluation and the full offline verification gate.

## Ownership boundary

Do not create or edit a human-owned `user-*` file. Do not create a participant
registry entry on behalf of the repository owner.
