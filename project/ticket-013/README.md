# Ticket 013: Compare qualified Live LLM models

- **ID**: ticket-013
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Run the same six-stage `require-llm` contract check against benchmark-qualified
OpenRouter models and determine whether any is a better todo2code default than
the measured `google/gemini-3.6-flash` baseline.

This directory contains governance and redacted evidence only. Runtime code
belongs under `src/` and operational scripts under `scripts/` if a measured
failure requires an implementation change.

## Acceptance criteria

- [x] AC-01: Every candidate is currently available and advertises
  `structured_outputs`.
- [x] AC-02: Gemini 3 Flash Preview receives a complete six-stage live attempt.
- [x] AC-03: Codestral 2508 receives a complete six-stage live attempt.
- [x] AC-04: DeepSeek V4 Pro receives a bounded live attempt; crossing the
  900-second run budget is recorded as a failed candidate, not retried away.
- [x] AC-05: Results compare stage success, fallback/degradation, latency,
  tokens and cost against Gemini 3.6 Flash.
- [x] AC-06: The selected default or retained baseline is justified by measured
  evidence; no model is promoted from catalog metadata alone.
- [x] AC-07: Documentation and validation gates pass before push to `main`.
- [x] AC-08: Unrelated `nlp2uri.yaml` remains uncommitted.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
