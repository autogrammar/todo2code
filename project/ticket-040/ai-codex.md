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

- None; waiting for approval.
- The main workspace changed concurrently while this plan was being created;
  the plan was therefore isolated from clean `origin/main` in its own worktree.

## Blockers

- Human approval is required before implementation.
