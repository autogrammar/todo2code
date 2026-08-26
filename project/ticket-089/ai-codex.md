---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-089
---
# Participant: codex (AI agent)

## Understanding

The existing bridge already resolves and executes public SubLLM routes, but it
only activates automatically when local SubLLM-specific environment variables
or a sibling source checkout are present. Ordinary installations therefore
silently continue through the legacy OpenRouter transport.

## Execution plan

1. Make SubLLM the default routing policy while preserving explicit opt-out.
2. Update the direct Z.AI fixture to GLM 5.3 and the canonical repository URL.
3. Run the repository verification suite and publish through the governed PR flow.

## Actual changes

- Changed semantic LLM routing to SubLLM-by-default.
- Preserved `T2C_USE_SUBLLM=false` for explicit compatibility and isolated legacy unit fixtures.
- Updated the central-route contract fixture from GLM 5.2 to direct Z.AI GLM 5.3.
- Verified TypeScript, module boundaries, environment/workflow contracts, generated schemas and 430 tests (429 passed, 1 skipped, 0 failed).

## Blockers

- None.
