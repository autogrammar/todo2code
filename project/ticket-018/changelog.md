# Ticket Changelog (ticket-018)

## [0.4.0] - 2026-08-04

- Planned AC-26..AC-28 to assign and normalize exactly three tracked generated
  analysis artifacts after the deterministic gate found a volatile `/tmp`
  worktree root.
- Kept regeneration and `project2.sh` explicitly outside the follow-up scope.
- Stopped at `WAIT_FOR_APPROVAL` before changing the manifest or generated
  artifacts; the user's subsequent `kontynuuj` authorizes interactive EDIT.
- Assigned the three exact artifacts to governance, updated the manifest lock
  and normalized volatile roots without regenerating the analysis.
- `verify:generated-analysis` and the deterministic governance gate pass;
  complete aggregate verification remains AC-28.

## [0.3.0] - 2026-08-04

- Confirmed and recorded `koru / code-review` + `governance / enforce` as the
  required checks for the `main` ruleset `20186914`; enforced state is active,
  `current_user_can_bypass: never`, and bypass actors are empty.
- Re-ran required evidence paths after deployment: PR-dispatch workflow syntax,
  positive and negative Koru probes, attestation upload path, workflow failure
  handling and local/CI verification commands now satisfy AC-24/AC-25.
- Advanced `ticket-018` workflow state to `IN_PROGRESS / WAIT_FOR_APPROVAL` with
  AC-24 and AC-25 checked; AC-17 and the pre-existing `ticket-019` blockers
  remain tracked separately.

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
- Merged the workflow through pull request #1 after its attested Koru check and
  existing application checks passed.
- Proved live semantic fail-closed behavior with dispatch `30703292661`: two
  source files were rejected, the job failed, and its report was still uploaded
  and attested.
- Staged ruleset `20186914` without bypass actors for final activation after the
  bootstrap evidence merge.

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
