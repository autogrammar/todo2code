# Ticket Changelog (ticket-018)

## [0.2.0] - 2026-08-01

- Evolved the plan for concurrent humans/agents: named workstreams,
  dependency/conflict edges, non-overlapping active write scopes and explicit
  integration tickets.
- Returned the ticket to `PLAN / WAIT_FOR_APPROVAL`; no multi-workstream
  implementation file was changed and no new ticket was created.
- The user explicitly approved the evolved plan; transitioned to
  `IN_PROGRESS / EDIT` before implementation.
- Added and adopted `new-project` 0.8.0 workstream policy-as-code with intent
  v2, deterministic dependency/conflict/integration checks and stable codes.
- Central fixtures, target schema/gate checks, Docker overlap probes and core
  E2E pass.
- Transitioned to `BLOCKED` because concurrent Rust SDK version drift prevents
  official full E2E before tests; no out-of-scope Cargo artifact was rewritten.
- Planned an AC-18..AC-25 extension for pinned Koru/Vallm pull-request review,
  fail-closed semantic validation, an attested review artifact and a required
  `main` ruleset; no CI or external repository setting changed in this phase.
- Recorded explicit human approval of AC-18..AC-25 and transitioned to
  `IN_PROGRESS / EDIT` before changing CI or repository rules.
- Added the pinned `koru / code-review` workflow with exact diff selection,
  one bounded semantic/security review round, structured evidence, artifact
  upload and GitHub provenance attestation.

## [0.1.0] - 2026-08-01

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Recorded the policy-as-code scope, trust boundaries, planned paths, risks,
  acceptance criteria and implementation checklist.
- Stopped before implementation pending explicit human approval.
- Human explicitly approved ticket-018; transitioned from
  `WAIT_FOR_APPROVAL` to `EDIT` before implementation changes.
- Added and tested central policy-as-code plus pinned target adoption.
- Recorded successful central fixtures, scoped governance checks and Docker E2E
  core/full results.
- Transitioned to `BLOCKED` after the gate rejected concurrent commit order and
  eight paths outside this ticket; no history rewrite or scope laundering was
  performed.
