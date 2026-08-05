# Ticket Changelog (ticket-046)

## [0.1.0] - 2026-08-05

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Defined the bounded runtime producer plan dependent on ticket-045.
- Split immutable pipeline-run logging from later GitHub workflow event
  acquisition to avoid post-run append and stale-evidence recursion.
- Human owner approved ticket-046; implementation started in the declared
  five-file runtime boundary.
- Corrected the evidence design after finding that receipt registration
  legitimately mutates `manifest.files`; the stable manifest projection
  prevents false digest drift without weakening semantic coverage.
- Split the initial 580-line module into codec/writer and pipeline persistence
  adapter so the feature does not introduce another GOD-file candidate.
- Removed a draft `evaluation.generated: ALLOWED` event because a pipeline run
  is analysis evidence, not a merge authorization boundary.
- Added the closed event-log codec, pipeline persistence adapter and atomic
  per-run publication for succeeded, degraded and failed manifests.
- Added canonical fixture, tamper, safety, determinism, immutable overwrite,
  all-outcome and receipt-registration regression coverage.
- Passed focused tests, full host verification, deterministic governance,
  Docker smoke and whitespace validation; publication awaits independent
  exact-head review.
