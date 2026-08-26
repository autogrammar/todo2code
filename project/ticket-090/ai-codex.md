---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-090
---
# Participant: codex (AI agent)

## Understanding

Production may default to SubLLM, while the offline test suite must remain
deterministic regardless of credentials inherited from the developer or CI
environment.

## Execution plan

1. Pin only the default test process to the explicit compatibility route.
2. Preserve independent SubLLM bridge coverage.
3. Run the complete repository verification and governance checks.

## Actual changes

- Made the test command explicitly hermetic with `T2C_USE_SUBLLM=false`.
- Kept production and explicit SubLLM bridge tests unchanged.

## Blockers

- None.
