# Ticket Changelog (ticket-009)

## [0.1.0] - 2026-07-31

- Audited provider/runtime schema drift across all structured LLM stages.
- Added one typed schema/parser source and migrated all seven production
  OpenRouter boundaries.
- Replaced silent provider-value coercion with fail-closed retry/fallback.
- Added production-call and published-schema drift gates.
- Passed full verify, both gold datasets and all SDK examples.
- Published the implementation to `main` as `d0fc143`.
