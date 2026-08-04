---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-037
---
# Participant: codex (AI agent)

## Understanding

The merged truth map can preserve multi-source semantic evidence, but it does
not yet answer which of many immutable branch snapshots overlap, conflict,
duplicate or depend on one another. The next safe unit is a pure core
projection over supplied evidence. Git discovery and effects must remain
outside this ticket so deterministic classification can be tested without a
remote, credentials or mutable refs.

Goal currently cannot consume such evidence, while Koru can invoke the
todo2code pipeline only for code-change plans. Both adapters therefore depend
on a stable contract from this ticket and later runtime/interface tickets.

## Execution plan

1. Obtain approval for the exact evidence and recommendation vocabulary.
2. Transition the ticket to `IN_PROGRESS / EDIT` without widening paths.
3. Implement strict input/output types, validation and canonical hashing in
   `src/core/branch-portfolio.ts`.
4. Add offline fixtures for disjoint, textual conflict, semantic conflict,
   equivalent patch, contained/stale, ordering and tampering cases.
5. Run focused tests, full verification, governance, Lizard and Docker core
   E2E.
6. Publish for protected exact-head Koru and Validator review.

## Actual changes

- Governance plan only; no implementation has started.

## Blockers

- Human approval is required before editing either implementation path.
