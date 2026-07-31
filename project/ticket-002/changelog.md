# Ticket changelog (ticket-002)

## [0.1.0] - 2026-07-31

- Initialized the ticket from the `wellmanifest/new-project` governance
  standard.
- Recorded the human instruction, Codex execution plan, acceptance criteria,
  risks and initial environment evidence.
- Entered `WAIT_FOR_APPROVAL`; no source-code or external benchmark execution
  has started.

## [0.2.0] - 2026-07-31

- Recorded user approval (`kontynuuj`) and transitioned from
  `WAIT_FOR_APPROVAL` to `TOOLS`.

## [0.3.0] - 2026-07-31

- Ran the normalized offline pipeline successfully against seven detached,
  tracked-only external repositories.
- Added `baseline.json` with machine-readable commits, fingerprints, counts,
  diagnostics, coverage and timings, plus `baseline.md` with reviewed results.
- Transitioned to `ANALYSIS` and selected non-actionable release-note mechanics
  as the first independently measurable diagnostic defect.

## [0.4.0] - 2026-07-31

- Added a red/green regression that separates changelog bookkeeping from
  substantive release claims.
- Added a narrow deterministic classifier for placeholders, compact file
  summaries and known generated analysis targets under `project/`.
- Re-ran the unchanged seven-repository corpus from a clean runtime containing
  only this patch: removed 1,024 false `review_required` findings across five
  repositories, retained substantive findings, and kept every graph fingerprint
  unchanged.
- Gold v2 remains perfect; transitioned to `VERIFY`.

## [0.5.0] - 2026-07-31

- Passed `npm run verify` (241 tests: 240 pass, 1 local JDK skip), gold v2,
  examples for five SDKs, CLI/MCP/A2A smoke, npm production audit and Docker
  smoke.
- Updated readiness and validation documentation with the seven-repository
  baseline and controlled iteration result.
- Completed all acceptance criteria and transitioned `VERIFY -> DONE`.

## [0.6.0] - 2026-07-31

- Reproduced a `project.sh` false positive caused by generated HTML quoting a
  tracked audit log that named an untracked file.
- Added a red/green regression and taught generated-analysis verification to
  accept only references already present in tracked, non-generated text.
- Kept the original hard negative for newly introduced untracked references.
- Re-ran tracked-only `project.sh`, full verify (242 tests: 241 pass, one Java
  skip) and Docker smoke successfully.
