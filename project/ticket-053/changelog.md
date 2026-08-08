# Ticket Changelog (ticket-053)

## [0.3.0] - 2026-08-08

- Reconciled PR #67 with the merged ticket-048 baseline without changing the
  executable deliverable.
- Kept ticket-053 active in `VALIDATION`, moved ticket-048 to the completed
  index, and retained tickets 049–052 as non-reserving plans.
- Replaced the expired GitHub Actions outage note with the current exact-head
  revalidation and protected-publication requirement.

## [0.2.0] - 2026-08-06

- Approved with workstream `governance` and a blocking failure policy.
- Verified that `Makefile` cannot be carried by this ticket
  (`GOV-INTEGRATION-001`) and that `AGENTS.md`, `project/governance-check.sh`
  and the other agent-facing wrappers are hash-locked (`GOV-SYNC-001`), so the
  deliverable is a `README.md` section rather than a `make` target.
- Proved the gate against real history in isolated worktrees: the squashed
  ticket-047 topology fails `GOV-TICKET-001`, the ticket-048 topology passes.
- Recorded that the check reads the active ticket from the working tree, so it
  must be run from the branch being pushed.

## [0.1.0] - 2026-08-06

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Recorded the working-tree versus base..head divergence between
  `make governance` and the CI governance job.
- Declared a wrap-only boundary over the existing `project/governance-check.sh`
  with no new diagnostic and no automatically installed Git hook.
