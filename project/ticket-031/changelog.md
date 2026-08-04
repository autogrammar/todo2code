# Ticket Changelog (ticket-031)

## [Unreleased] - 2026-08-04

- Recorded human approval and entered the bounded `EDIT` state.
- Added canonical repository-root provenance to record identity with strict
  validation and unchanged legacy IDs when provenance is omitted.
- Added four focused tests; verification on the direct base is blocked by
  three inherited parser errors outside this ticket's allowed paths.
- Reused the existing ticket-023..027 aggregate repair as a temporary
  validation base: full verification and Docker smoke pass with this change.
  No duplicate repair implementation or automatic ticket was created.
- Integrated the completed repair chain, repeated every required gate on the
  exact publication branch and marked ticket 031 DONE.
- Planned a 25-minute core-only identity slice for repository-qualified Intent
  records after the Subactor Core run exposed missing sibling Docs evidence.
- Kept warning suppression, external reads, linker changes and automatic ticket
  creation outside the approved scope.

## [0.1.0] - 2026-08-04

- Initial governance scaffold created.
- No human participant identity or content was generated.
