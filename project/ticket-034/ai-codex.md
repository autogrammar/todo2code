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
requested output. Large strict JSON requests can therefore receive the same
time as much smaller generic calls.

## Execution plan

1. Commit this governance plan before executable edits.
2. Add a pure bounded timeout calculator with explicit baselines and factor.
3. Apply it once per chat request before creating the abort timer.
4. Keep external cancellation immediate and retry backoff inside one deadline.
5. Expose the policy in safe audit configuration and timeout errors.
6. Run focused tests, full verification, Docker smoke and governance.
7. Submit an exact-head protected PR and use validator-agent with GLM 5.2.

## Actual changes

- Created the active ticket and recorded the approved deterministic formula.
- Confirmed the current main branch is a clean compatible base.
- No executable source, test, build or CI file changed in this plan commit.
- Added a pure timeout-decision module with validated load inputs, power-of-two
  pressure scaling, an 8x multiplier ceiling and a 600-second absolute cap.
- Applied the decision once to the complete chat request, including retry
  backoff, while preserving immediate external cancellation.
- Added base/effective timeout diagnostics and a non-secret audit policy.
- Passed focused tests, the complete 342-test suite, full verification, Docker
  smoke and governance.

## Blockers

- None for implementation or local validation. External exact-head review
  remains a merge gate.
