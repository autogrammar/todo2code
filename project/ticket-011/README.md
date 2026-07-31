# Ticket 011: AST-grounded NL symbol resolution

- **ID**: ticket-011
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Resolve explicit NL symbol targets against observed AST declarations without
guessing between modules. Make `AMBIGUOUS_REQUIREMENT` prescribe the exact field
and candidate path that a human must add or correct.

Executable implementation belongs under `src/` and tests under `test/`. This
ticket directory contains only governance and evidence.

## Acceptance criteria

- [x] AC-01: AST symbol declarations are indexed by normalized qualified and
  leaf aliases with their observed source paths.
- [x] AC-02: A short symbol owned by one source path remains exact evidence.
- [x] AC-03: A short symbol owned by several paths does not select all of them.
- [x] AC-04: An explicit path or qualified symbol selects exactly one matching
  owner; a conflicting path does not create symbol evidence.
- [x] AC-05: A not-yet-implemented symbol stays unresolved without being called
  ambiguous.
- [x] AC-06: Ambiguity diagnostics list candidate paths and prescribe
  `target.path`; known `missingFields` prescribe concrete edits.
- [x] AC-07: File names and all-caps prose are not emitted as implicit code
  symbols, while explicit backticked/qualified symbols remain supported.
- [x] AC-08: Gold v2 includes unique, ambiguous-hard-negative and explicit-path
  symbol cases with separate exact-target accounting.
- [x] AC-09: Full verification, gold v1/v2 and all SDK examples pass.
- [x] AC-10: Documentation is updated and the completed change is pushed to
  `main` without committing unrelated `nlp2uri.yaml`.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)

## Result

NL↔AST symbol evidence is now limited to a unique observed owner or an
explicitly selected path. Ambiguous and conflicting symbols abstain and produce
an actionable diagnostic with candidate paths. The implementation was
committed and published to `main` as `25df74a`.
