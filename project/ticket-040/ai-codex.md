---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-040
---
# Participant: codex (AI agent)

## Understanding

The repository already detects scope violations, but agents can begin from an
incorrect assumption before running the gate: a stale branch, a dirty main or
a parallel generator can appear between two commands. The safe first slice is
an observation service, not an auto-fixer. It combines exact local Git facts
with the current governance checker's JSON and emits deterministic diagnostics
and non-executable next-action categories.

Policy matching must remain owned by `wellmanifest/new-project`. Reimplementing
its glob and workstream semantics in TypeScript would create a second source of
truth and could incorrectly bless a change rejected by `make governance`.

## Execution plan

1. Obtain approval for this exact read-only input/output and diagnostic scope.
2. Transition the ticket to `IN_PROGRESS / EDIT` without widening paths.
3. Implement strict option validation, bounded porcelain-v2 parsing, exact
   local ref comparison and governance JSON ingestion.
4. Emit stable diagnostics, safe-action enums and a content fingerprint.
5. Add offline temporary-repository fixtures for clean, stale, dirty, renamed,
   conflicted, detached, ambiguous-ticket and malformed-checker states.
6. Prove zero mutation of HEAD, index, refs, stash and remote configuration.
7. Run focused, full, governance, complexity and Docker core validation.
8. Publish only after protected exact-head review.

## Actual changes

- The user approved the exact contract and current protected base by replying
  `tak` after plan PR #47 merged.
- Transitioned to `IN_PROGRESS / EDIT` before creating either implementation
  file; scope, budgets and architecture remain unchanged.
- The main workspace changed concurrently while this plan was being created;
  the plan was therefore isolated from clean `origin/main` in its own worktree.
- Added a dependency-free workspace observer that binds exact local Git facts,
  sorted porcelain-v2 entries and managed governance JSON into one canonical
  `t2c.workspace-preflight/v1` report.
- Kept ticket resolution inside `.governance/governance_check.py`; the service
  passes a bounded changed-path union and neither reproduces ownership globs
  nor converts advisory output into approval.
- Added nine offline fixture tests covering clean, dirty, rename, conflict,
  stale, detached, wrong-branch, governance-failure, malformed-checker and
  read-only invariants.
- Split the two initially over-complex validation functions after Lizard found
  CC 23 and CC 20; final analysis has zero threshold violations and the service
  is 497 physical lines.
- Focused, full host, governance and Docker core validation pass. A live run on
  this worktree blocked its two uncommitted files while resolving ticket-040,
  proving the motivating path without mutating it.

## Blockers

- Protected exact-head review and merge remain required before `DONE`.
