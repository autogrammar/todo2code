---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-073
---
# Participant: codex (AI agent)

## Understanding

Unbounded repository-wide LLM passes waste context on low-risk files, while a
deterministic-only analysis misses errors of intent. The useful boundary is a
deterministic policy that chooses semantic stages and evidence slices, followed
by required LLM reasoning inside every selected semantic stage. Token/request
ceilings and exact cache identity make cost auditable without silently changing
the analysis method.

## Execution plan

1. Commit this plan and intent before any implementation file.
2. Define a closed policy vocabulary, typed representation and canonical text
   codec in the core-dsl workstream.
3. Validate stage topology and nested budgets fail closed.
4. Add deterministic selection, usage aggregation and exact policy
   fingerprinting with focused tests.
5. Attempt a real todo2code `require-llm` analysis, then run host, governance,
   dependency and Docker gates.

## Actual changes

- Plan and intent committed independently as `f2e68ae`; implementation has not
  started before the separately recorded approval transition `84690c1`.
- Added the dependency-free `t2c.analysis-policy/v1` contract with a canonical
  parser/renderer, closed vocabulary, fail-closed validation, deterministic
  stage selection, usage aggregation, policy/cache fingerprints and a
  provider-rate cost estimator.
- Made global and per-stage budgets bound requests (including retries and
  response repair), input tokens, output tokens and elapsed time. Selected
  semantic stages require LLM; provider failure never becomes a deterministic
  semantic result.
- Added eight focused tests covering byte identity, selection, exact evidence
  caching, cost bounds, invalid vocabulary/topology/budgets and malformed text.
- Ran the real todo2code pipeline with all semantic modes set to `require-llm`.
  It issued 43 provider responses, consumed 498,533 input and 153,176 output
  tokens and cost 1.303208672 USD. The 920,279 ms Markdown stage caused the
  contract to gain explicit elapsed-time ceilings.
- Applied the LLM's ticket-local wording finding by replacing ambiguous nominal
  constraints with explicit operational verbs. Historical findings lacking
  evidence in the owned paths were rejected.
- Final local validation: focused 8/8; full host 414 pass, 0 fail, 1 JDK skip;
  gold gates 100%; governance 0 findings; audit 0 vulnerabilities; Docker
  smoke PASS.

## Blockers

- None. The prior explicit continuation is now recorded as approval.
