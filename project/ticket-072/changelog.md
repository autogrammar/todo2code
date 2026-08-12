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
- Restructured regex constants after the first protected Koru run exposed a
  Lizard parsing false positive; no redaction behavior or policy was weakened.

## [0.2.0] - 2026-08-12

- Split the approved plan and intent into their own pre-implementation commit
  to satisfy the protected `new-project` history invariant without changing
  the final source tree.
- Passed Koru, hosted verify, required JDK, independent GLM-5.2 review and
  review-triggered governance on exact head `7522928`.
- Merged protected PR #84 as `main@790b867`; the complete post-merge CI passed.
- Closed the ticket as `DONE / DONE` in a documentation-only publication step.
