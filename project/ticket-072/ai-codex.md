---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-072
---
# Participant: codex (AI agent)

## Understanding

Provider HTTP errors are currently propagated verbatim through the common
OpenRouter adapter. A weekly-limit response can therefore place a stable key
fingerprint and a provider account-management URL into CLI stderr and a failed
pipeline manifest. Live-contract reports redact a narrower copy later, which
does not protect the ordinary pipeline.

## Execution plan

1. Add a bounded provider-error sanitizer at the OpenRouter adapter boundary.
2. Cover API keys, contextual key IDs and management URLs with hard negatives
   proving ordinary diagnostic text is retained.
3. Reproduce `require-llm` fail-closed behavior and run host, governance and
   Docker validation.

## Blockers

- The configured OpenRouter key still rejects paid analysis at its weekly
  limit. The implementation must still attempt the live `require-llm` check
  and fail closed; deterministic fallback is not permitted.
