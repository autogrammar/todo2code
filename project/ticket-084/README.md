# Ticket 084: Honor deterministic NL mode in workspace comparison CLI

- **ID**: ticket-084
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-21

## Goal and scope

Make `t2c compare-workspace --nl-mode deterministic` authoritative for both
workspace pipelines and their deadline calculation. The command must run a
task-file comparison without an LLM credential when every selected semantic
mode is deterministic, and its help must expose the option.

## Acceptance criteria

- [x] AC-01: The human owner explicitly requested implementation and continued
      autonomous testing on 2026-08-21.
- [ ] AC-02: CLI `--nl-mode deterministic` overrides an ambient
      `require-llm` default for compare-workspace.
- [ ] AC-03: CLI help documents the accepted NL modes.
- [ ] AC-04: Focused, full Node, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The user's implementation request authorizes this bounded CLI correction.
Protected exact-head Validator evidence remains the separate merge boundary.

## Non-goals

- No change to pipeline, extractor, graph or comparison contracts.
- No weakening of `require-llm`; deterministic mode remains explicit opt-in.
- No automatic execution or merge authority.
