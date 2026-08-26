---
participant-id: agent:antigravity
participant: antigravity
role: agent
ticket: ticket-090
---
# Participant: antigravity (AI agent)

## Understanding

Ticket-089 intentionally changes the production default to SubLLM. The test
runner currently inherits that default and therefore allows ambient runner
credentials to alter offline gold-evaluation results.

## Execution plan

1. Pin the test process to the explicit legacy compatibility route.
2. Remove ambient test-helper mutation.
3. Re-run the complete repository verification and hosted checks.

## Actual changes

- Made the test command explicitly hermetic with `T2C_USE_SUBLLM=false`.
- Kept production and explicit SubLLM bridge tests unchanged.
- Verified the complete suite on Node 22: 429 passed, 1 skipped, 0 failed.

## Blockers

- None.
