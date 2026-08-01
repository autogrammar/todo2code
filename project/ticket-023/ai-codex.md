---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-023
---
# Participant: codex (AI agent)

## Understanding

The user approved adoption of the benchmark winner for todo2code and the
repair/validation agents integrated with todo-agent. todo2code calls OpenRouter
directly, so its canonical ID omits LiteLLM's `openrouter/` prefix. The global
default must flow to all semantic stages while explicit overrides remain
authoritative.

## Execution plan

1. Add a regression for the new global default and preserved override.
2. Change the runtime fallback to the benchmark-qualified model.
3. Record benchmark provenance in the ticket evidence and defer
   governance-owned root documentation/config examples.
4. Run offline verification and the governance diagnostic.

## Actual changes

- Governance plan only; no runtime, test or documentation source has been
  changed yet.

## Blockers

- Repository policy requires the planned ticket to remain in
  `WAIT_FOR_APPROVAL` until a subsequent human message authorizes transition
  to `EDIT`.
- Active ticket-018 owns root README governance scope, and policy 0.8.0 does
  not assign `.env.example` to the runtime workstream. Those files are not in
  this intent.
