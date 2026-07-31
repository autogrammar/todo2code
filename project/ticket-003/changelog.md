# Ticket changelog (ticket-003)

## [0.1.0] - 2026-07-31

- Created the separately scoped residual changelog audit.
- Recorded user continuation as approval.
- Entered `TOOLS` with a deterministic sampling and reject-unsafe-hypothesis
  policy.

## [0.2.0] - 2026-07-31

- Reproduced 1,853 residual findings on all seven current deterministic runs.
- Added a reproducible 168-record stratified sample with labels and rationale.
- Selected exact `Update <file>` bookkeeping: 28 sampled and 547 census records
  across five repositories.
- Deferred roadmap checkboxes and retained 1,275 substantive or unverified
  claims; transitioned to `ANALYSIS`.

## [0.3.0] - 2026-07-31

- Added a red/green regression for exact file-only updates with behavioral hard
  negatives.
- Added the minimal diagnostic-signal correction.
- Removed 547 review-required findings and 188 secondary unlinked warnings
  across five repositories with 7/7 stable graph fingerprints.
- Gold v2 remains perfect; transitioned to `VERIFY`.

## [0.4.0] - 2026-07-31

- Passed full verification: 242 tests, 241 passed, zero failed and one allowed
  local Java skip; module, LLM-boundary, environment, workflow and generated
  analysis checks also passed.
- Passed all five SDK examples, the production dependency audit, CLI/MCP/A2A
  smoke checks and Docker smoke.
- Updated `docs/READINESS.md`, recorded the next ranked roadmap-lifecycle
  hypothesis and transitioned from `VERIFY` to `DONE`.

## [0.4.1] - 2026-07-31

- Corrected repository layout after review: moved the executable audit
  reproducer from the ticket evidence directory to `scripts/research/`.
- Preserved the ticket input, captured output and documentation in place.
