# Ticket 009: Canonical structured-response contracts

- **ID**: ticket-009
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Generate the OpenRouter JSON Schema and the TypeScript runtime parser from one
canonical response contract at every production LLM boundary. Provider output
must fail closed instead of being silently coerced into a different intent.

Executable implementation belongs under `src/` and tests under `test/`. This
ticket directory contains only governance and evidence.

## Acceptance criteria

- [x] AC-01: A reusable typed contract builder emits JSON Schema and parses the
  same supported constraints at runtime.
- [x] AC-02: Every production structured OpenRouter response is parsed through
  its canonical contract before fields are read.
- [x] AC-03: Unknown/missing properties, invalid enums, bounds, patterns and
  uniqueness constraints fail with a precise response path.
- [x] AC-04: Grounding and cross-field semantic checks remain a separate,
  explicit validation stage.
- [x] AC-05: Published document response schema is generated from and tested
  against its runtime contract.
- [x] AC-06: Invalid provider output is retried or visibly degraded according
  to the stage policy; it is never silently normalized into another intent.
- [x] AC-07: Full repository verification and gold/example gates pass.
- [x] AC-08: Documentation records the contract boundary and measured drift.
- [x] AC-09: The completed change is committed and pushed to `main`.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)

## Result

Seven production OpenRouter boundaries now use `chatStructuredWithMetadata`;
the repository gate found zero raw JSON calls outside the client. Provider
schema and runtime parsing share one typed contract, while grounding remains a
separate evidence check. The implementation was published as `d0fc143`.
