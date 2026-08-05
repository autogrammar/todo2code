---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-047
---
# Participant: codex (AI agent)

## Understanding

Ticket-046 intentionally stopped before GitHub acquisition. The existing codec
already owns the DSL grammar, evidence/event hashes, strict validation and
atomic publication, so this ticket needs only an adapter at the integration
boundary. Editing a workflow in the same ticket would overlap the governance
workstream and make the change harder to review and finish within 30 minutes.

## Execution plan

1. Obtain explicit approval for the closed mappings and workflow-artifact
   boundary.
2. Implement one dependency-free GitHub payload adapter that allowlists fields
   before creating runtime event inputs.
3. Delegate rendering, validation, chain construction and atomic writing to the
   built ticket-046 codec.
4. Add bounded fixtures and focused tests for supported mappings, rejection,
   evidence safety, trust class and byte stability.
5. Document how a later governance ticket invokes the collector without
   committing or appending generated artifacts.
6. Run focused, full host, governance and Docker checks before exact-head
   independent review.

## Actual changes

- Human approval received; ticket transitioned from
  `PLAN / WAIT_FOR_APPROVAL` to `IN_PROGRESS / EDIT`.
- Declared implementation boundary remains `project/ticket-047`, with no public
  interface changes and no workflow or API polling.
- Implementing a bounded GitHub event acquisition adapter that emits one
  canonical stream per payload and reuses the ticket-046 `t2c.event-log/v1`
  codec and atomic writer.
- Added deterministic mapping for supported event/action combinations
  (`push`, `pull_request`, `pull_request_review`, `workflow_run`), explicit
  rejection of unsupported transitions, and canonicalized allowlisted evidence
  projections.
- Added focused integration tests proving deterministic replay, SYSTEM_FACT review
  recording and fail-closed unsupported actions.

## Blockers

- Implementation is complete in the approved scope; no blockers remain.
