---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-034
---
# Participant: codex (AI agent)

## Understanding

The configured timeout is currently a fixed deadline for the complete request,
including transport retries. It does not account for prompt/schema size or
requested output. Documentation has a separate 45-second base, but large strict
JSON requests can therefore receive less time than much smaller generic calls.

## Execution plan

1. Wait for the active LLM repair and openrouter refactor to integrate.
2. Add a pure bounded timeout calculator with explicit baselines and factor.
3. Apply it once per chat request before creating the abort timer.
4. Keep external cancellation and retry behavior unchanged.
5. Expose the policy in safe audit configuration and timeout errors.
6. Run boundary tests, full verification, Docker smoke and governance.

## Actual changes

- Created ticket-034 and recorded the proposed formula.
- No executable source, test, build or CI file was changed.

## Blockers

- Ticket-027 is still active in the `llm` workstream.
- Unrelated uncommitted OpenRouter refactoring exists in the main worktree.
- Human approval of this exact plan is required after integration.
