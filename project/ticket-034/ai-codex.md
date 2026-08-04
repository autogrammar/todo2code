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
- Responded to the first Koru gate by decomposing request execution into
  credential/deadline setup, bounded retries, one HTTP attempt, response
  parsing and error normalization. Local Lizard now reports zero complexity
  warnings while the focused and full suites preserve behavior.
- Reproduced and removed the remaining pinned Vallm parser ambiguity, then
  obtained a passing Koru review for the exact implementation head.
- Obtained validator-agent approval for exact head
  `e09e8323b96cfdd7543e851b57bd1035d640eb84` with
  `openrouter/z-ai/glm-5.2` and merged protected PR #31 as
  `main@6116961d8c9674b24c1161903e43f3a7dbb2147b`.

## Blockers

- None. Implementation, independent exact-head review and protected merge are
  complete.
