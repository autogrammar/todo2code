# Ticket Changelog (ticket-018)

## [0.5.0-plan] - 2026-08-04

- Planned adoption of one canonical, reviewed `new-project` 0.10.0 full SHA
  that combines safe lifecycle/adoption behavior with bounded delivery.
- Planned replacement of the executable Koru judge
  `openrouter/google/gemini-3.1-pro-preview` with the less costly
  `openrouter/z-ai/glm-5.2`; no live provider request was made.
- Returned the follow-up to `PLAN / WAIT_FOR_APPROVAL`. No managed governance,
  workflow, application, test, build or human-owned file was changed.
- Human approved AC-36..AC-40; transitioned to `IN_PROGRESS / EDIT` before
  changing managed governance or workflow configuration.
- Replaced the executable Koru judge with `openrouter/z-ai/glm-5.2` and updated
  current guidance without rewriting historical Gemini evidence or making a
  live provider request.
- Full deterministic verification passes 334/335 tests with one JDK skip;
  governance reports zero findings. Final 0.10 lock adoption remains blocked
  on independent review and merge of upstream PR #1.
- Read-only adoption preflight against the PR head made zero writes and stopped
  on the expected target-manifest 0.9.0 versus source 0.10.0 precondition.
- Verified independent Validator App approval for the exact upstream head and
  publication as merge commit `5267cf3`; resumed the approved immutable-SHA
  adoption without treating the former review branch as a release.
- Adopted canonical 0.10.0 and regenerated the managed lock against published
  merge `5267cf3`; migrated lifecycle status classes and trusted App evidence.
- Central fixtures, target governance, workflow validation, all 335 Node tests
  (one JDK skip) and Docker smoke pass without a live LLM request. Marked
  AC-37, AC-38 and AC-40 complete and entered `VALIDATION`.
- Exact-head GLM run `30934859353` failed closed on Vallm
  `semantic.parse_error`; reopened AC-39/AC-40 to require provider-enforced
  JSON rather than accepting an advisory verdict without parseable evidence.
- Verified and fixed the App review findings in canonical upstream ticket-005:
  invalid authority/binding evidence no longer projects trust, and external
  evidence uses a no-follow regular-file read boundary.
- Adopted independently reviewed upstream merge `9706e63`, pinning both the
  target governance lock and reusable CI workflow to the same published SHA.
- Moved the exact Validator App login to protected repository variable
  `TRUSTED_VALIDATOR_APPS`; removed the local resolver that accepted any
  non-author User and ignored App reviews.
- Revalidated governance, workflow YAML, 335 Node tests and Docker smoke; all
  required local checks pass with one explicit JDK skip.
- Fresh Validator App review approved exact head `d716c6e`; reusable governance,
  Koru, full verify and Java checks passed. PR #4 merged as `6ad85bd`, and the
  post-merge main CI passed before the ticket moved to `DONE`.

## [0.4.1] - 2026-08-04

- Refactored the managed governance validator at upstream commit `1ae86a1` so
  every function remains within CC 15 and 100 lines while preserving byte-for-
  byte JSON/SARIF results for the PR #4 range; refreshed the pinned lock.
- Published that exact upstream commit on `feat/bounded-delivery-contract` and
  updated the target lock provenance from `local-commit` to `remote-branch`.

## [0.4.0] - 2026-08-04

- Approved and implemented the upstream bounded-delivery contract as
  `wellmanifest/new-project` 0.9.0 with <=30-minute XS/S slices,
  architecture-first planning, component ownership and deterministic budgets.
- Added positive/negative fixtures for checkpoints, timebox stop, stale bases,
  ambiguous ownership and actual-diff overflow; central tests pass.
- Staged pinned `todo2code` adoption without retroactively enabling the new
  five-file limit against the historical ticket-018 branch.
- Fixed conservative wildcard ownership containment with central regression
  coverage; the false ticket-020 workstream finding is gone.
- Target schemas and lock pass; four inherited ticket-018/019 coordination
  findings remain separately attributed and block full activation.
- Re-ran full local verification and Docker core E2E successfully; Docker full
  reproduces only the separately owned Rust lock mismatch before tests.
- Audited every bounded upstream and target commit at no more than five files
  and completed AC-21, AC-25 and AC-35 evidence without claiming AC-34.

## [0.2.1] - 2026-08-01

- Replaced the stale DeepSeek Koru judge with benchmark-qualified
  `google/gemini-3.1-pro-preview`.
- Removed Vallm's Python-specific regression mode from the TypeScript review;
  the independent required `verify` job remains the authoritative regression
  gate.
- Recorded pull request #3 run `30712589077`: Koru evidence generation and
  attestation worked, while the live semantic call failed with OpenRouter 401
  `User not found`. Secret rotation remains an external trusted-owner action.
- Verified the new judge in pull request #4's attested no-source report; Koru,
  Node/Docker verification and the required Java fixture passed remotely.
- Ran a bounded live dispatch over pull request #3's TypeScript diff. It proves
  the regression/`pytest` error is gone and the Gemini ID is active, while
  preserving fail-closed 401 and Vallm uppercase-language parser evidence.
- Reopened AC-21 instead of claiming successful Koru syntax/semantic evidence;
  the required `verify` job continues to own TypeScript compilation/regression.
- Rotated the repository-scoped Actions credential after explicit user
  authorization and proved it with live dispatch `30714664770`: Gemini ran for
  both files without a provider error. Remaining rejection is attributable to
  Vallm parser/context findings, not authentication or provider limits.
- Reduced the GitHub job ceiling from 20 to 10 minutes and bounded the active
  Vallm/LiteLLM round at 420 seconds, leaving time for fail-closed evidence.
- Added an 8192-token response cap, zero provider retries so 404 fails
  immediately, lowercase tree-sitter language normalization, and deterministic
  post-policy that keeps semantic pass-level warnings advisory while every
  other finding remains blocking and visible.
- Proved the repair with workflow dispatch `30746421293` against pull request
  #3's exact two-file source diff: Gemini completed in 1 minute 24 seconds,
  both files passed, no parser/provider finding remained, and the attested
  report retained five advisory observations with zero blocking findings.
- Revalidated failure timing through LiteLLM's actual HTTP stack: a local 404
  and a deliberately slow endpoint each generated exactly one request and
  failed promptly. Revalidated all 335 Node tests and Docker `e2e-core`; the
  full image continues to fail only on the pre-existing stale Rust lock.

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
