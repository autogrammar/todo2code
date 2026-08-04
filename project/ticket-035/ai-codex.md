---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-035
---
# Participant: codex (AI agent)

## Understanding

Ticket-019 is now unblocked by ticket-018, but its five implementation paths
still cross `sdk`, `governance` and unowned root metadata. The validator does
not transfer ownership through `integrationTicket`; therefore widening the
ticket-019 allowlist alone would remain invalid.

The target manifest is intentionally customizable. Its lock can be refreshed
with the immutable adoption generator while preserving the pinned standard
revision. This is narrower than changing the upstream standard or weakening
the ownership check.

## Execution plan

1. Commit this plan and intent without implementation changes.
2. In a later commit, add only the five Python publication paths to the
   existing integration workstream and `requiredForPaths`.
3. Refresh the adoption lock from the pinned upstream revision.
4. Run governance on the real diff and on a temporary simulated ticket-019
   integration intent.
5. Record evidence, push a dedicated PR and request exact-head validator review.

## Actual changes

- Plan and machine scope only; no implementation changed in this commit.

## Risks and boundaries

- The target-specific manifest changes policy scope, so the exact path list is
  explicit and the standard provenance must remain unchanged.
- No Python packaging implementation belongs in this ticket.
