# Ticket 055: Project-derived OpenRouter application identity

- **ID**: ticket-055
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-08

## Goal and scope

Ensure OpenRouter attributes every todo2code-generated application's usage to
the project being analysed. `OPENROUTER_APP_NAME` remains the explicit
override; when it is absent or blank, runtime configuration derives the title
from the basename of the resolved project root instead of using the constant
`todo2code`.

The OpenRouter client already sends `openRouter.appName` as
`X-OpenRouter-Title` on every `/chat/completions` request, and
`.env.example` already exposes `OPENROUTER_APP_NAME=todo2code`. This ticket is
therefore limited to correcting the fallback and proving its precedence. It
does not change the Codex model, OpenRouter routing, credentials, provider
selection or the `/models` discovery request.

## Acceptance criteria

- [x] AC-01: A non-empty `OPENROUTER_APP_NAME` remains the exact application
  title used by runtime configuration.
- [x] AC-02: An absent or whitespace-only `OPENROUTER_APP_NAME` falls back to
  the basename of the resolved `T2C_ROOT`, not the constant `todo2code`.
- [x] AC-03: The fallback is non-empty even for an exceptional root path whose
  basename is empty.
- [x] AC-04: Focused configuration tests, the complete Node test suite,
  governance checks and required Docker checks pass before completion.
- [x] AC-05: A human approved this bounded intent in the active conversation on
  2026-08-08 before implementation.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The human owner explicitly approved ticket-055 in the active conversation on
2026-08-08. This Markdown note records the transition to `EDIT`; it is not
trusted merge authorization.

## Validation result

After ticket-056 landed, focused tests, the complete host suite, governance,
Docker smoke, `e2e-core` and `e2e-full` all passed. Koru and Validator App
approved exact head `7aae64385a5e3b85b7127340f809b7bfaf934f33`; the Validator
used `openrouter/z-ai/glm-5.2` for advisory findings. Protected governance and
hosted checks passed, and PR #74 merged as
`main@d0659cafa2612d5628ce9cfbc744c3e7af94d43d`.
