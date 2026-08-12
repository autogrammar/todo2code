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

## Actual changes

- Centralized provider error redaction in `src/llm/openrouter.ts` for chat,
  model-list and non-JSON responses.
- Redacted the configured credential exactly, Bearer values, OpenRouter key
  shapes, generic secret assignments, contextual credential IDs and provider
  key/credential management URLs.
- Preserved normal explanations and invalid-model discovery.
- Added focused fixtures and changed pre-existing credential fixtures from an
  unsafe secret-shaped spelling to the governance-safe `test-*` convention.
- Proved the real weekly-limit response still fails closed without a graph or
  fallback while no longer exposing its management identity.

## Blockers

- The configured OpenRouter key still rejects paid analysis at its weekly
  limit. This is external availability, not a validation gap in the redaction.
