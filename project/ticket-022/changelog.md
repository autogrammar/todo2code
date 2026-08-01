# Changelog — ticket-022

## Planned

- Discover bounded nested Git repositories below an umbrella root.
- Namespace repository paths so Git evidence links to shared workspace paths.
- Preserve single-repository extraction and read-only operation.
- Validate against the real Subactor workspace.

## Implemented

- Split Git extraction into one-repository evidence collection and bounded,
  deterministic umbrella orchestration.
- Added breadth-first real-directory discovery, repository/directory caps,
  symlink refusal, checkout pruning and stable four-reader concurrency.
- Namespaced changed/renamed paths and recorded each repository-relative root.
- Bumped deterministic Git provenance to `t2c/git@2`.
- Added regressions for collision-safe paths, pruning, symlink refusal, empty
  repositories, rename paths, repeatability and the single-repository contract.

## Validated

- Focused tests, full Node verification and Docker smoke pass.
- Subactor supplies 326 commit records from 39 member repositories; 82.2% link
  to other graph evidence and same-snapshot diagnostics fall by 275.
- A composed check with ticket-021 preserves zero unsafe remediation plans.
- The global governance gate remains blocked only by pre-existing ticket-018/019
  findings; ticket-022 is not merged or pushed.
