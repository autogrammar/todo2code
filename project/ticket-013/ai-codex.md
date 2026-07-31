---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-013
---
# Participant: codex (AI agent)

## Plan

1. Verify current structured-output support and prices.
2. Run identical 6/6 Live checks for Gemini 3 Flash Preview, Codestral 2508
   and DeepSeek V4 Pro.
3. Compare each result with the Gemini 3.6 Flash baseline.
4. Retain or change the default only on complete measured evidence.

## Outcome

Codestral 2508 is the measured default. Gemini 3 Flash Preview is the fallback
candidate. DeepSeek V4 Pro is rejected for exceeding the complete-run budget.
The external-repository run additionally caused bounded Markdown batch
concurrency; no validation rule or schema was relaxed.

## Safety

The user explicitly authorized live comparison. Each run keeps the existing
$0.50 total cost ceiling and 15-minute total latency ceiling. Provider output
remains fail-closed and redacted in reports.
