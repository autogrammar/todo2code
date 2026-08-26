---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-088
---
# Participant: codex (AI agent)

## Understanding

PLF-8307 passed 1585 Core tests and governance but publication stopped with
`blocking_delta=1`. Exact replay proved the added contradiction joins a full
documentation sentence at lines 32-33 with a shorter NL projection at line 32
from the same ticket README. The shorter projection ends before "not as
Sprawdzanie", so it is not independent contrary evidence.

## Execution plan

1. Commit this source-bounded plan before implementation.
2. Add a linker regression for overlapping same-source excerpts while retaining
   a distinct-source contradiction control.
3. Apply the narrow source-overlap guard and run focused/full verification.
4. Replay the exact PLF-8307 patch, publish through Validator, then repin the
   coding-agent runtime and retry the governed Core ticket.

## Actual changes

- Plan prepared; the active Founder request supplies execution authorization.

## Blockers

- None inside the recorded bounded repair; trusted merge remains independent.
