---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-070
---
# Participant: codex (AI agent)

## Understanding

User-facing CLI, MCP and A2A defaults are owned by ticket-068. Direct
programmatic callers still route through PipelineOptions and service actions,
which default task synthesis to disabled. Those runtime-owned defaults require
this separate ticket.

## Execution plan

1. Wait for ticket-061 to release runtime and ticket-069 quality hardening.
2. Define one shared LLM-first/offline resolution rule for runtime callers.
3. Apply it to direct PipelineOptions and service dispatch.
4. Add focused fail-closed and explicit-offline regressions.
5. Run full, governance, Docker and live manifest validation.

## Actual changes

- Recorded the remaining runtime default gap and exact owner paths.
- Removed the interface-owned MCP/A2A work from this plan after ticket-068
  implemented one shared boundary resolver and truthful discovery descriptions.
- No executable path changed while runtime is reserved.

## Blockers

- Ticket-061 reserves runtime and `test/pipeline.test.ts`.
- Ticket-069 must prevent LLM enrichment from generating same-source blocking
  conflicts before the default is broadened.
