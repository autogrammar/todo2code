# Ticket 055: Project-derived OpenRouter application identity

- **ID**: ticket-055
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
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

- [ ] AC-01: A non-empty `OPENROUTER_APP_NAME` remains the exact application
  title used by runtime configuration.
- [ ] AC-02: An absent or whitespace-only `OPENROUTER_APP_NAME` falls back to
  the basename of the resolved `T2C_ROOT`, not the constant `todo2code`.
- [ ] AC-03: The fallback is non-empty even for an exceptional root path whose
  basename is empty.
- [ ] AC-04: Focused configuration tests, the complete Node test suite,
  governance checks and required Docker checks pass before completion.
- [ ] AC-05: A human approves this bounded intent before implementation.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

Current state is `WAIT_FOR_APPROVAL`. No implementation or test file may be
changed until the human owner explicitly approves this ticket.
