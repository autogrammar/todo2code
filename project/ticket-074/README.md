# Ticket 074: Route semantic LLM calls through SubLLM

- **ID**: ticket-074
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-12

## Goal and scope

Route Subactor-owned semantic executions of `todo2code` through the central
Python `subllm` package instead of requiring a separately configured direct
OpenRouter client. Add the stable `todo2code/semantic` route, preserve the
standalone deterministic mode, and keep provider credentials out of command
output, persisted audits and logs.

The todo2code implementation is limited to the existing internal LLM boundary
and its focused tests. Central policy and the Platform intent-gate caller are
changed in their owning repositories. No new npm runtime dependency or public
todo2code API is introduced.

## Acceptance criteria

- [x] AC-01: A human owner approves this exact scope and transition to `EDIT`.
- [ ] AC-02: SubLLM resolves `todo2code/semantic` to direct Z.AI GLM 5.2 when
  the shared Z.AI credential is valid, with OpenRouter ordered second.
- [ ] AC-03: The Node LLM boundary consumes SubLLM's resolved public route and
  the selected credential without printing or persisting the credential.
- [ ] AC-04: Z.AI requests carry `user_id=todo2code`, a bounded unique
  `request_id`, `model=glm-5.2`, and no OpenRouter-only fields.
- [ ] AC-05: Existing explicit standalone OpenRouter behavior remains
  available outside the Subactor integration; an explicitly requested but
  unavailable SubLLM route fails closed rather than silently bypassing policy.
- [ ] AC-06: Focused tests, full todo2code verification, governance checks,
  Docker checks and SubLLM verification pass.
- [ ] AC-07: One minimal structured-output request through the production
  todo2code LLM boundary returns HTTP 200 from direct Z.AI and reports
  `glm-5.2`, without exposing the credential.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The human owner approved continuation on 2026-08-12 after reviewing the bounded
plan. The ticket is now `IN_PROGRESS / EDIT`. This approval permits the scoped
implementation; it does not authorize merge, deployment or secret disclosure.

## Non-goals

- No automatic replay of a failed paid Z.AI request through OpenRouter.
- No provider or model policy copied into todo2code.
- No new npm runtime dependency or public SDK contract.
- No changes to deterministic extraction semantics.
- No commit of `.env`, API key IDs, secrets or response payloads containing
  sensitive input.
