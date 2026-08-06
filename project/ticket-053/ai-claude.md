---
participant-id: agent:claude
participant: claude
role: agent
ticket: ticket-053
---
# Participant: claude (AI agent)

## Understanding

The two governance gates answer different questions. `make governance` compares
the working tree to `HEAD`; the CI job compares `base..head`. Diagnostics that
are properties of the *branch* rather than of the *edit* — `GOV-INTENT-003`,
`GOV-TICKET-001`, and workstream scope over the full diff — are therefore
structurally invisible before a push.

This is not a missing feature. `project/governance-check.sh` already accepts
`--actor ci --base --head` and reproduces the CI verdict locally in under a
second. The gap is purely that nothing prompts anyone to run it, so the
verdict arrives from a failed pull request instead.

## Execution plan

1. Resolve the workstream question with the owner; it decides when this ticket
   may become active, because `integration` is held by ticket-048.
2. Add one `Makefile` target resolving the base via
   `git merge-base origin/main HEAD` and delegating to the existing checker.
3. Prove the gate against real history: the squashed ticket-047 topology must
   fail, the ticket-048 topology must pass.
4. State in `AGENTS.md` that this gate, not `make governance`, is what must be
   green before a push.

## Actual changes

- None; waiting for approval.

## Blockers

- Human approval is required before implementation.
- The workstream assignment is undecided, and `integration` is unavailable
  while ticket-048 is active.
