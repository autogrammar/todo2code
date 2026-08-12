# Ticket Changelog (ticket-074)

## [0.1.0] - 2026-08-12

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Added the bounded SubLLM integration design, allowed paths, acceptance
  criteria, rollback and validation evidence requirements.
- Recorded human approval and transition to `IN_PROGRESS / EDIT`.
- Added the SubLLM route bridge and provider-specific direct Z.AI transport at
  the existing internal LLM boundary, with standalone OpenRouter compatibility
  and fail-closed explicit enablement.
- Passed focused SubLLM/Z.AI tests, governance and Docker smoke; verified the
  central SubLLM package with 43 tests, Ruff and package build.
- Proved the production boundary with a live direct Z.AI `glm-5.2` structured
  response using provider-visible `todo2code` identity and no secret output.
- Transitioned to `IN_PROGRESS / VALIDATION` pending protected exact-head
  review and publication evidence.
