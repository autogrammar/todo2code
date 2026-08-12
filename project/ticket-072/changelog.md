# Ticket Changelog (ticket-072)

## [0.1.0] - 2026-08-12

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Human continuation recorded as approval for the previously proposed bounded
  provider-error redaction.
- Ticket entered `IN_PROGRESS / EDIT` on exact base `2380dd8`.
- Added one common OpenRouter error sanitizer covering configured and
  credential-shaped values, contextual credential identifiers and provider
  management URLs.
- Added focused chat and model-list regression tests while retaining ordinary
  invalid-model diagnostics.
- Verified a real `require-llm` limit failure remains fail-closed with no graph,
  no fallback and no raw management identifier.
- Host, gold, governance, dependency audit and Docker checks passed; the ticket
  remains in implementation state `EDIT` until its executable diff is
  published.
