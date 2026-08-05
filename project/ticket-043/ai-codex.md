---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-043
---
# Participant: codex (AI agent)

## Understanding

Ticket-040 implemented the correct read-only semantics, but only tests import
the service. The main workspace currently demonstrates the gap: it can remain
dirty and behind while `project.sh` reports only governance. The smallest safe
integration is a separate explicit Make command, not a change to the managed
governance wrapper and not a second Git/policy implementation.

## Execution plan

1. Obtain approval for the exact three-file integration boundary.
2. Add a Make target with explicit expected-branch and local-baseline inputs.
3. Add a thin Node wrapper over the built `inspectWorkspace()` service.
4. Test help, validation, canonical output, exit mapping and zero Git mutation.
5. Run focused, full, governance and Docker validation.

## Actual changes

- The Founder approved the exact three-file boundary at
  `main@1d926eb1bc540ff25377c47bc7c22590f8579288`; governance transitioned to
  `EDIT` before any implementation path was changed.

## Blockers

- None for implementation. Independent exact-head protected review remains
  required before merge.
