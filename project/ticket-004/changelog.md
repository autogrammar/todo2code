# Ticket changelog (ticket-004)

## [0.1.0] - 2026-07-31

- Created the separately scoped language-independent matching experiment.
- Recorded user continuation as approval.
- Entered `TOOLS` with precision, provenance and offline-CI guardrails.

## [0.2.0] - 2026-07-31

- Added a multilingual synthetic benchmark with six positive and six nearby
  negative pairs across Polish, German, Spanish and French.
- Evaluated pinned MiniLM and E5 models locally.
- Rejected a global cosine threshold because positive and negative score ranges
  overlap.

## [0.3.0] - 2026-07-31

- Ranked 66 actionable targetless platform declarations against 133 module
  aggregates.
- Rejected two new forward-threshold candidates during manual review.
- Confirmed reciprocal top-1 removes the false positives but adds no coverage;
  no production matcher was retained.
- Added a separately reported cross-language gold cohort with six known
  positives and six gated hard negatives; transitioned to `VERIFY`.

## [0.4.0] - 2026-07-31

- Passed 244 tests (243 pass, zero fail, one allowed local Java skip), gold
  v1/v2, all five SDK examples, dependency audit, CLI/MCP/A2A and Docker smoke.
- Updated `READINESS.md`, `TEST_REPORT.md`, `VALIDATION.md` and `TODO.md`.
- Closed the rejected matcher experiment in `DONE` without a production
  semantic rule.

## [0.4.1] - 2026-07-31

- Corrected repository layout after review: moved both executable embedding
  experiment reproducers from the ticket evidence directory to
  `scripts/research/`.
- Preserved benchmark inputs, captured outputs and decisions in the ticket.
