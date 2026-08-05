# Ticket 042: Bound aggregate LLM deadline for workspace comparison

- **ID**: ticket-042
- **Owner**: human:founder
- **Status**: DONE
- **Workflow state**: DONE
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

## Protected completion evidence

- Koru run
  [30987747726](https://github.com/semcod/todo2code/actions/runs/30987747726)
  passed exact head `5b51880cd448c295fbfdcb7bcc2e892864ac910f`.
- Validator run
  [30987864973](https://github.com/subactor/validator-agent/actions/runs/30987864973)
  approved that same head for `ticket-042` and correlation ID
  `todo2code-pr52-5b51880cd448` using `openrouter/z-ai/glm-5.2`. The semantic
  verdict remained advisory rather than the approval trust root.
- Review-triggered CI run
  [30987963474](https://github.com/semcod/todo2code/actions/runs/30987963474)
  passed governance, full verification, Docker smoke and the required Java
  fixture with current-head Validator evidence.
- Protected PR [#52](https://github.com/semcod/todo2code/pull/52) merged exact
  head `5b51880` as
  `main@2c164492e7aa751b0fd159b80e07ee0fcc22384f` without an administrative
  bypass.
