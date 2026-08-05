# Ticket Changelog (ticket-043)

## [0.1.0] - 2026-08-05

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Defined an XS integration-only plan for an explicit Make/Node invocation of
  ticket-040's existing read-only workspace observer.
- Kept runtime semantics, project.sh, governance, public interfaces,
  dependencies and all Git mutation outside the approved delivery boundary.

## [0.2.0] - 2026-08-05

- Added `make preflight PREFLIGHT_EXPECTED_BRANCH=<branch>` over the existing
  ticket-040 observer without duplicating runtime semantics.
- Reserved stdout for one canonical JSON report and mapped `PASS`/`BLOCKED`
  to stable exit codes 0/2.
- Added deterministic argument, shell-quoting, report and complete Git-state
  non-mutation tests.
- Passed focused, full offline, governance, Docker and complexity validation.
- Isolated nested Make test output after hosted CI exposed an inherited
  `Entering directory` banner; product stdout remains one canonical report.
