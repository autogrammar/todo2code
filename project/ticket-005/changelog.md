# Ticket changelog (ticket-005)

## [0.1.0] - 2026-07-31

- Initialized the audited cross-language reranking plan.
- Made the source/evidence directory boundary explicit.
- Entered `PLAN` and stopped before implementation for owner review.

## [0.2.0] - 2026-07-31

- Recorded owner approval without modifying the human participant file.
- Added the governance-standard participant extraction and response-owner audit
  as a prerequisite to semantic reranking.
- Transitioned from `PLAN` to `TOOLS`.

## [0.3.0] - 2026-07-31

- Recognized section-owned intent in `user-*` and `ai-*`.
- Excluded ticket specifications, iterations, audits and agent logs from the
  participant channel.
- Added `responseRequiredRole` and `responseRequiredFrom` to every detected
  divergence.
- Added unconfirmed-human-decision detection without allowing the agent to
  modify the human-owned record.
- Validated migration behavior against historical Opus and GPT56Luna material
  from `wellmanifest/new-project`.

## [0.4.0] - 2026-07-31

- Added bounded semantic candidate and grounded accept/reject/abstain contracts,
  JSON Schemas and offline regression tests.
- Added captured gold decisions that recover 6/6 cross-language positives with
  zero forbidden-pair violations and one hard-negative abstention.
- Restricted live evaluation to a clean tracked snapshot and moved the
  reproducer to `scripts/research/`.
- Rejected the production candidate after three live
  `qwen/qwen3.7-plus` responses violated the structured contract before a
  relation could be created.
- Removed semantic reranker exports from the public package and closed the
  ticket through the explicit rejection branch.
