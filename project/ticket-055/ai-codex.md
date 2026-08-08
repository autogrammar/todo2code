---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-055
---
# Participant: codex (AI agent)

## Understanding

OpenRouter's App column is populated from `X-OpenRouter-Title`. The existing
client already sends that header from `config.openRouter.appName`, and the env
template already exposes `OPENROUTER_APP_NAME`. The defect is the hard-coded
runtime fallback, which labels every project `todo2code` when the variable is
missing or blank.

## Execution plan

1. Wait for explicit approval and transition the ticket to `IN_PROGRESS / EDIT`.
2. Derive the default application name from the basename of resolved
   `T2C_ROOT`, retaining a defensive non-empty fallback.
3. Add focused tests for explicit override, missing value and blank value.
4. Run focused, full Node, governance and Docker validation.

## Actual changes

- Inspected the configuration and OpenRouter request boundary.
- Confirmed `.env.example` already declares `OPENROUTER_APP_NAME=todo2code`.
- Confirmed every `/chat/completions` attempt sends `X-OpenRouter-Title`.
- Added ticket planning evidence only; no implementation file was changed.
- Changed the runtime fallback to the basename of resolved `T2C_ROOT`, with a
  defensive non-empty fallback for filesystem roots.
- Added three focused tests covering explicit, absent, blank and exceptional
  root behavior.
- Host verification and Docker smoke pass. Docker E2E surfaced unrelated
  missing-`make` and missing-`Cargo.lock` defects.

## Blockers

- None. Ticket-056 repaired the independent Docker E2E blockers. Exact-head
  Validator approval, protected governance and hosted checks passed before PR
  #74 merged to `main`.
