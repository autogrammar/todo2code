# Ticket 023: Adopt benchmark-qualified Gemini model

- **ID**: ticket-023
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-01

## Goal and scope

Adopt `google/gemini-3.1-pro-preview` as todo2code's runtime fallback after the
human-approved `llm-code-benchmark` run qualified it for both repair and
validation. Keep every stage-specific `OPENROUTER_*_MODEL` override and the
fully deterministic modes unchanged. This ticket changes runtime configuration
and its regression test only; it does not make a paid provider request.

## Acceptance criteria

- [ ] AC-01: `getConfig()` defaults `OPENROUTER_MODEL` and all inherited
  semantic stage models to `google/gemini-3.1-pro-preview` when no model
  environment variable is present.
- [ ] AC-02: Explicit global and stage-specific model overrides continue to
  take precedence.
- [ ] AC-03: A regression test covers the default and override behavior.
- [ ] AC-04: `npm run verify` passes without a paid LLM request.
- [ ] AC-05: Governance reports no ticket-023 ownership or scope error. The
  pre-existing ticket-018/ticket-019 conflict remains outside this scope.

## Participants

- Human participant: unresolved; approval was supplied in the supervised chat
  and no human-owned `user-*` file was created or edited.
- Agent participant: [ai-codex.md](ai-codex.md)

## Deferred governance-owned alignment

`README.md` and `.env.example` are deliberately excluded because the active
governance ticket-018 already claims `README.md`, while `.env.example` has no
declared runtime ownership in policy 0.8.0. Align them after ticket-018 releases
the governance workstream or through a separately approved ownership change.
