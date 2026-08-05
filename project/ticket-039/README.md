# Ticket 039: Bound aggregate LLM deadline for workspace comparison

- **ID**: ticket-039
- **Owner**: human:founder
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-05

## Goal and scope

Bound the total wall-clock budget of `compare-workspace` semantic analysis.
The existing per-request adaptive timeout is correct, but a comparison runs two
pipelines and may issue many document chunks; therefore sequential waves can
outlive the intended task budget even though every request is bounded.

Authorization is the Founder's explicit instruction in the active Codex
session to scale timeout to task/input complexity, use 2x growth when the
default is insufficient, continue execution, and use `z-ai/glm-5.2` instead of
Gemini 3.1 Pro Preview. No human-owned participant file is synthesized.

## Acceptance criteria

- [x] AC-01: The active Founder instruction authorizes adaptive task/input
  timeout handling and continued implementation.
- [x] AC-02: The aggregate deadline accounts for both pipelines, document
  chunks and semantic stages using bounded 2x steps.
- [x] AC-03: Expiry aborts in-flight OpenRouter requests and leaves no detached
  comparison process or partial success claim.
- [x] AC-04: Focused, full, governance and Docker validation pass.

## Participants

- Human participant: `human:founder`, evidenced by the active conversation;
  no `user-*` file was generated or edited.
- Agent participant: [ai-codex.md](ai-codex.md)
