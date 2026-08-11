---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-070
---
# Participant: codex (AI agent)

## Understanding

The CLI can own its default independently, but programmatic callers and MCP/A2A
route through PipelineOptions and service actions, which still default task
synthesis to disabled. Those runtime-owned defaults require a separate ticket.

## Execution plan

1. Wait for ticket-061 to release runtime and ticket-069 quality hardening.
2. Define one shared LLM-first/offline resolution rule for runtime callers.
3. Apply it to direct PipelineOptions and service/MCP/A2A dispatch.
4. Add focused fail-closed and explicit-offline regressions.
5. Run full, governance, Docker and live manifest validation.

## Actual changes

- Recorded the remaining runtime default gap and exact owner paths.
- No executable path changed while runtime is reserved.

## Blockers

- Ticket-061 reserves runtime and `test/pipeline.test.ts`.
- Ticket-069 must prevent LLM enrichment from generating same-source blocking
  conflicts before the default is broadened.
