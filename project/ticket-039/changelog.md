# Ticket Changelog (ticket-039)

## [0.1.0] - 2026-08-04

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Defined the bounded read-only Git observation contract, risks, tests and
  explicit semantic/interface follow-up boundary.
- Recorded explicit human approval and entered `IN_PROGRESS / EDIT`.
- Corrected unique-work identity to use `merge-base..head`; the live branch
  audit showed that `base..head` assigns a reverse patch to contained branches.
- Added the bounded Git snapshot runtime and its offline seven-branch fixture.
- Verified deterministic fingerprints, exact topology, equivalent patch IDs,
  textual conflicts, stale-ref rejection and zero caller-repository mutation.
- Passed focused, full host, Docker, gold, governance and complexity gates.

## [0.2.0] - 2026-08-04

- Recorded exact-head Koru and Validator App evidence for `29df450`; the
  Validator used `openrouter/z-ai/glm-5.2` and returned no advisory findings.
- Re-ran the pre-approval pull-request governance job after the protected
  approval, clearing GitHub's duplicate required-context failure without a
  source change or policy bypass.
- Recorded protected CI completion and PR #44 merge as `main@2948f4a`.
- Closed ticket-039 while keeping semantic assembly, public interfaces and
  Goal/Koru/Validator consumer adapters in their declared follow-up scopes.
