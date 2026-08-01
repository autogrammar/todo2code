# Ticket Changelog (ticket-017)

## [0.1.0] - 2026-08-01

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Recorded the audit scope, risks, pre-existing worktree boundary and acceptance
  criteria; implementation remains blocked on human approval.
- User approved the plan and the ticket entered `IN_PROGRESS / TOOLS`.

## [0.2.0] - 2026-08-01

- Repaired non-mutating command help and Polish active-prohibition polarity with
  focused CLI, text and documentation regressions.
- Audited concurrent path/action planning and bounded Markdown path resolution
  against absolute, Windows and parent traversal.
- Passed 314 host tests (313 pass, one JDK skip) and 314 Docker tests (307 pass,
  seven optional-toolchain skips), gold v2/v1 at 100% gated precision/recall,
  and host plus Docker examples.
- On `wellmanifest/new-project@72e5f6c`, removed the sole false
  `CONFLICTING_INTENT`; recorded all 183 remaining diagnostics rather than
  claiming a clean repository.
- Refreshed `project/analysis.toon.yaml`; no commit, push or auto-apply occurred.
- Continued the active ticket for the user-requested Docker E2E core/full
  environments; no new ticket or human-owned participant file was created.

## [0.3.0] - 2026-08-01

- Added isolated `e2e-core` and `e2e-full` Docker/Compose environments plus
  operator documentation and stable `T2C-E2E-*` failure codes.
- Core E2E passed with 318 tests (311 pass, seven explicit optional-toolchain
  skips), both gold benchmarks, protocol smoke checks and core examples.
- Full E2E passed with 318/318 tests and zero skips, both gold benchmarks,
  CLI/MCP/A2A smoke checks and shared fingerprints from all five SDK examples.
- Added the native build toolchain required to link the Rust example after the
  first full run exposed the missing `cc` executable as `T2C-E2E-108`.
- Marked ticket-017 `DONE`; no commit, push or auto-apply occurred.
