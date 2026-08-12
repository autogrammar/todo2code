# Ticket Changelog (ticket-073)

## [0.1.0] - 2026-08-12

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Proposed a standalone core-dsl contract for deterministic LLM-stage
  selection, exact cache identity and nested request/token/time ceilings.
- Reserved no runtime, CLI, provider, SDK or shared integration path.
- Committed the plan and intent independently as `f2e68ae`, then recorded the
  prior explicit continuation and entered `IN_PROGRESS / EDIT` before source
  mutation.
- Added the canonical typed policy codec, fail-closed validation, deterministic
  stage selection, exact fingerprints, usage aggregation and cost estimation.
- Added eight focused contract tests and passed full host, gold, governance,
  dependency and Docker validation.
- Measured a real all-semantic-stage LLM run at 43 responses, 651,709 total
  tokens and 1.303208672 USD; its 920,279 ms Markdown stage led to explicit
  elapsed-time ceilings.
- Applied the ticket-local LLM wording recommendation and retained no
  unsupported historical refactoring proposal.
