# Ticket Changelog (ticket-040)

## [0.1.0] - 2026-08-05

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Defined a bounded read-only workspace preflight over local Git facts and the
  existing governance checker's machine report.
- Kept all repair actions, interfaces, network operations, leases and remote
  publication outside this ticket.
- Recorded the concurrent dirty-main incident as motivating evidence and
  isolated the plan in a clean worktree without modifying source or tests.
- Recorded explicit approval for exact protected base `db368c0` and entered
  `IN_PROGRESS / EDIT` without widening the two-file implementation scope.
- Added the deterministic `t2c.workspace-preflight/v1` runtime service and nine
  offline read-only Git/governance contract tests.
- Preserved authoritative `GOV-*` findings and checker-selected ticket identity
  while adding stable `WS-*` diagnostics and non-executable safe actions.
- Passed focused, full host, governance, Lizard and Docker core validation;
  moved the ticket to `IN_PROGRESS / VALIDATION` pending protected review.
- Repaired Koru's alternate-parser CC=16 finding and made subprocess failures
  preserve the correct workspace diagnostic family with non-secret digest
  evidence instead of raw stderr.
