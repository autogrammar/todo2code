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

1. Confirm the active LLM repair is closed and its behavior is present in the
   current split implementation.
2. Add a pure bounded timeout calculator with explicit baselines and factor.
3. Apply it once per chat request before creating the abort timer.
4. Keep external cancellation and retry behavior unchanged.
5. Expose the policy in safe audit configuration and timeout errors.
6. Run boundary tests, full verification, Docker smoke and governance.

## Actual changes

- Created ticket-034 and recorded the proposed formula.
- Recorded the user's explicit continuation as approval and entered `EDIT`.
- Configured the ignored local OpenRouter environment to use `z-ai/glm-5.2`;
  no API key or other secret was changed.
- Added a pure timeout policy and applied one effective deadline across HTTP
  retries and their abortable backoff.
- Added timeout policy fields to secret-free audit configuration and base plus
  effective durations to timeout errors.
- Added seven boundary, cap, malformed-input, audit and cancellation tests.
- Full verify, gold, SDK examples, governance and Docker smoke pass on the
  validated ticket-027 publication base.
- The installed Validator App approved the exact PR #13 head after all required
  hosted checks passed, and the human maintainer merged it into the publication
  branch.

## Blockers

- None. Implementation, independent validation and publication are complete.
