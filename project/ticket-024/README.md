# Ticket 024: Repair current CLI and interface contracts

- **ID**: ticket-024
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-04

## Goal and scope

Repair current-HEAD interface regressions without changing command semantics:
close the graph-diff write call, adapt A2A startup to the CLI handler's
`Promise<void>` contract, narrow the optional extractor key before indexing,
correct the communication extractor import after its module move, and resolve
the prompt root from the newly split helper's compiled depth. Core/semantic
repairs remain owned by ticket-023.

## Acceptance criteria

- [x] AC-01: The human instructed the agent to continue the diagnosed repair.
- [x] AC-02: The CLI parses and preserves graph-diff output behavior.
- [x] AC-03: A2A startup and extractor selection satisfy their TypeScript
      contracts and existing usage errors.
- [x] AC-04: Communication imports the root extractor and finds its fail-closed
      prompt after compilation.
- [x] AC-05: Complete verification, gold, governance and Docker E2E pass on the
      aggregate current-HEAD repair.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- The user's `kontynuuj` instruction authorizes this exact non-overlapping
  current-HEAD interface repair.
- Protected independent review remains required for merge.
