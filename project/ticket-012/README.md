# Ticket 012: Reliable live structured-output model

- **ID**: ticket-012
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Replace the opaque `openrouter/auto-beta` default with an explicit model that
advertises structured-output support, retain rejected-response metadata in
stage audits, and make the live history include the run just recorded.

Executable implementation belongs under `src/` and `scripts/`; tests under
`test/`. This directory contains governance and evidence only.

## Acceptance criteria

- [x] AC-01: The selected model is present in the current OpenRouter model API
  and advertises `structured_outputs`.
- [x] AC-02: Invalid JSON or runtime-contract responses retain response ID,
  resolved model, provider, tokens and cost when OpenRouter supplied them.
- [x] AC-03: NL, Markdown, documentation and communication stage failures
  propagate rejected-response metadata into their audits.
- [x] AC-04: The persisted and rendered live history includes the current run
  without double-counting rewrites.
- [x] AC-05: Offline tests cover invalid response metadata and current-history
  accounting.
- [x] AC-06: Full verify, gold v1/v2 and SDK examples pass.
- [x] AC-07: A paid six-stage `require-llm` run is attempted with the explicit
  model and its exact outcome is documented.
- [x] AC-08: Documentation is updated and changes are pushed to `main` without
  committing unrelated `nlp2uri.yaml`.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
