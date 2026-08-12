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
  started.

## Blockers

- None. The prior explicit continuation is now recorded as approval.
