---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-031
---
# Participant: codex (AI agent)

## Understanding

The refactor preserved `scoreObjectSimilarity(...)` and its evidence basis but
assigned its return value only to `objectSimilarity`; the aggregate `score`
never receives it. This single semantic omission explains seven fresh-suite
failures: two direct linker cases, the AST integration case and four gold
evaluation cases. Restoring the addition is safer than changing thresholds or
test expectations because it recreates the pre-refactor algorithm.

## Execution plan

1. Wait for explicit human approval; do not edit production source beforehand.
2. Add the computed similarity contribution exactly once in `scorePair`.
3. Run build plus focused AST, linker-pairing and gold-evaluation tests.
4. Run the full suite and verify that only the three separately diagnosed
   communication failures remain.
5. Run diff/scope checks and governance; publish only with truthful evidence.

## Actual changes

- The human explicitly approved ticket-031 by replying `kontynuuj`; the
  interactive implementation may enter `EDIT`.
- Restored the pre-refactor scoring contract in `src/graph/linker.ts`: raw
  similarity remains available to relation classification, while its weighted
  `0.48` contribution is added exactly once to the aggregate score.
- Clean build and all 27 focused AST/linker/gold tests pass. The full suite no
  longer contains any of the seven linker failures and stops only on three
  communication regressions plus ticket-030's independently repaired test.

## Blockers

- Repository governance already has four unrelated ticket-018/ticket-019
  blockers; ticket-031 must not rewrite them.
- Trusted merge approval for the final head SHA is still required.
