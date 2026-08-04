# Ticket Changelog (ticket-018)

## [0.6.0] - 2026-08-04

- Added a versioned, exact Validator GitHub App allowlist and current-head
  approval resolver while preserving independent human `User` reviews.
- Added deterministic rejection fixtures for unknown bots, stale/dismissed
  reviews, self-review and malformed or duplicate allowlist entries.
- Added the non-mutating `direct-pr` strategy to `validator-agent`, pinned it to
  explicit repository/PR/base/SHA inputs and `openrouter/z-ai/glm-5.2`, and
  scoped its workflow App token to one repository.
- Verified 96 Validator tests, 342 full Docker E2E tests with JDK 17, both gold
  datasets at 100%, all SDK examples, governance, smoke and Docker smoke.
- Entered `VALIDATION` pending a separately trusted bootstrap review and a real
  App review of todo2code PR #13.
- Removed Vallm's Python-only `--regression` plugin from the TypeScript Koru
  review after live evidence showed it called missing `pytest` for every TS
  file. Regression remains strictly enforced by the separate `verify` and Java
  checks; Koru retains syntax, complexity, security and GLM 5.2 semantic review.
- Replaced the LLM-derived Koru gate verdict with commit-bound advisory evidence
  (`t2c.koru-code-review/v2`). Added a 420-second/8192-token/zero-retry provider
  boundary and TypeScript parser normalization; deterministic CI remains the
  only required decision source.
- Corrected the allowlisted actor to the observed GitHub review identity
  `ifuri-validator-agent[bot]` from existing Validator App approvals.
- Bound trusted App evidence to the exact active `ticket-NNN` and safe
  correlation ID recorded in the current-head review body; human review
  behavior remains unchanged.
- Adopted central standard 0.9.0 at immutable commit `d082373`, including the
  reusable protected resolver and ephemeral current-event approval evidence.
- Verified PR #14 remotely: Koru v2, Node/Docker verification and required Java
  passed. Live Validator run `30918035304` stopped before review because the App
  is not installed in `semcod/todo2code`; ticket state moved to `BLOCKED` and
  releases its reservation until that external installation is completed.
- Rechecked installation in non-mutating run `30918421022` after user approval;
  token creation still returned 404, confirming that the remaining step is the
  interactive GitHub App installation rather than a code or secret defect.
- Recorded the user's completed App installation and returned ticket-018 to
  `IN_PROGRESS` before producing the new current-head validation request.
- Advanced the immutable standard pin to `d082373` after its push-event fix
  excluded only the injected standard checkout through `.git/info/exclude`.
- Confirmed the central push gate, Node/Docker, Java and Koru checks on exact
  head `4ab9c254`. Live run `30921738666` still received installation 404, and
  the organization API reports `semcod` installation count zero; returned the
  ticket to `BLOCKED` without emitting a review.
- Confirmed the new `semcod` installation `151227156` for
  `ifuri-validator-agent` with repository selection `all`; resumed
  `IN_PROGRESS / VALIDATION` before creating fresh current-head evidence.
- Completed AC-40: production Validator runs approved exact heads for PR #14
  (`ticket-018`) and PR #13 (`ticket-034`), and the governance reruns accepted
  the App evidence while merge remained human-controlled.
- Recorded central PR #2 as the sole remaining publication blocker: it is green
  and mergeable, but `wellmanifest` has no Validator App installation and the
  author cannot supply an independent self-review. Released the workstream at
  `BLOCKED / PUBLICATION`.

## [0.5.0] - 2026-08-04

- Planned AC-30..AC-40 for allowlisted independent Validator App approvals
  bound to the exact PR head SHA.
- Planned a non-mutating `direct-pr` validator strategy alongside the existing
  Project-queue strategy.
- Kept arbitrary bots, stale reviews, self-review, metadata commits and merge
  authority outside the trusted path.
- Updated the deployed Validator model variable to
  `openrouter/z-ai/glm-5.2` without dispatching a live review.
- Stopped at `IN_PROGRESS / WAIT_FOR_APPROVAL`; no executable implementation
  file changed.
- Recorded explicit approval of AC-30..AC-40 and entered `EDIT` before any
  executable change.

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
- Planned AC-29 to assign the Python runtime adapter test to its owning
  runtime workstream before correcting the stale release assertion.
- Completed AC-17 and AC-28 on the current aggregate: local verification,
  deterministic governance, Docker smoke and Docker core/full all pass.
- Confirmed the historical locked Rust dependency failure no longer reproduces;
  full Docker runs 338 tests with zero skips.

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
