# Ticket 067: Enforce LLM-first todo2code analysis policy

- **ID**: ticket-067
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-11

## Goal and scope

Make LLM-first analysis the explicit operating policy for agents using
todo2code whenever a configured provider can improve semantic interpretation.
The policy requires every applicable audited LLM stage, retains deterministic
facts and authority boundaries, and permits an explicit, reported fallback
without pretending that the model succeeded.

This ticket changes the public LLM operating boundary only. `AGENTS.md` is
managed and hash-locked by `new-project`, so a target-local override is rejected
by governance and is not part of this change. The CLI default is implemented
and validated separately in ticket-068. The live evidence also found a
same-source false-conflict defect, while active version tickets reserve the
core and programmatic-runtime workstreams needed for the remaining changes.

## Acceptance criteria

- [x] AC-01: The human explicitly requires LLM use wherever it can improve a
  todo2code result.
- [x] AC-02: The public operating contract requires all applicable semantic LLM
  stages whenever a provider is configured, while allowing a separately
  reported offline or deterministic baseline.
- [x] AC-03: The policy distinguishes `require-llm` fail-closed behavior from a
  visible `prefer-llm` fallback and requires manifest verification.
- [x] AC-04: Git, AST, configuration, linking, diagnostics, validation,
  approval and mutation remain deterministic authority boundaries.
- [x] AC-05: A scoped live pipeline proves all six semantic LLM stages were
  actually used; failures and quality regressions are recorded rather than
  hidden.
- [x] AC-06: Governance, link and diff validation pass.

## Validation evidence

- Governance: PASS, 0 errors and 0 warnings.
- Host verification: PASS, 405 tests; 404 passed and one controlled local JDK
  skip.
- Docker smoke: PASS.
- Diff, intent JSON and ticket-local Markdown link checks: PASS.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization

The user explicitly instructed: always use LLM with todo2code where it can
produce better results, and enforce that logic for todo2code. This authorizes
the bounded governance change and transition to `EDIT`; it is not trusted
merge approval.

## Non-goals and follow-up boundary

- No weakening of structured-response validation or deterministic trust roots.
- No claim that an attempted LLM request equals a successful LLM stage.
- No executable default change inside this policy ticket.
- No edits in managed `AGENTS.md` or in core/runtime/interface source; those
  changes require their own governed tickets.
