# Ticket 018: Enforce new-project governance as policy-as-code

- **ID**: ticket-018
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-01

## Goal and scope

Turn `wellmanifest/new-project` from documentation-only guidance into a
deterministic policy-as-code standard, then adopt that standard in `todo2code`.
The gate must make intent visible before implementation: after a completed
ticket, a new multi-step code change requires a new plan-only ticket and a
separate human approval before source, test, build or CI implementation files
may be changed.

This ticket covers two coordinated repositories:

- `wellmanifest/new-project`: machine-readable governance contract, validator,
  stable `GOV-*` diagnostics, reusable GitHub Actions workflow, stack profiles,
  tests and documentation. No ticket, task file or execution log will be
  created in the read-only Governance Hub.
- `semcod/todo2code`: pinned adoption metadata, persistent `AGENTS.md`, local
  wrappers/hooks where appropriate, required governance CI job and
  deterministic semantic validation. Existing unrelated/concurrent worktree
  changes remain outside this ticket.

The implementation will not treat an agent-edited Markdown field as trusted
human approval. GitHub PR review/CODEOWNERS is the merge-time trust boundary;
local validation reports approval as unverified when no trusted CI context is
available.

The evolved scope also supports safe parallel work by several humans or agents
without splitting the repository prematurely. `todo2code` remains one modular
repository, but tickets are assigned to declared workstreams such as
`core-dsl`, `extractors`, `llm`, `runtime`, `interfaces`, `sdk`, `governance`
and `integration`. At most one active implementation ticket is allowed per
workstream, and active tickets may not claim overlapping write paths. Explicit
dependency and conflict edges replace implicit coordination; cross-workstream
contract changes require an integration ticket instead of silently widening an
existing ticket.

## Planned changed paths

- Governance Hub: manifest/schema, validator and tests, reusable workflow,
  stack profiles, templates/scripts, policy documentation and version notes.
- `todo2code`: `.governance/**`, `AGENTS.md`, governance workflow integration,
  package/Make targets only where required, and ticket-018-owned governance
  records.
- Application source changes are excluded unless a focused test proves they
  are necessary for the deterministic `todo2code` governance command.

## Planned generated-analysis normalization

The current verification gate found a volatile `/tmp/t2c-analysis.*` worktree
root embedded in tracked generated analysis. This follow-up assigns exactly
`project/README.md`, `project/analysis.toon.yaml` and `project/index.html` to
the governance workstream, runs the existing deterministic root normalizer,
and verifies that no temporary analysis root remains. It does not regenerate
the analysis and does not run `project2.sh`.

## Planned multi-agent contract

- Extend the manifest with named workstreams, owned path patterns and a policy
  for active-ticket limits, overlap rejection and integration work.
- Version the ticket intent contract with `workstream`, `dependsOn`,
  `conflictsWith` and optional `integrationTicket`, while retaining an explicit
  migration path for existing v1 tickets.
- Validate unknown workstreams, overlapping active scopes, dependency cycles,
  unfinished prerequisites, incompatible tickets and missing integration
  routing through stable `GOV-*` diagnostics.
- Keep branch/worktree isolation and a merge queue as CI/repository controls;
  do not infer that a local filesystem lock is a trusted distributed lock.
- Preserve deterministic enforcement. LLM analysis may explain a divergence,
  but cannot classify it away or approve a scope expansion.

## Planned Koru code-review extension

The user requested automated code review through Koru. The implementation will
add a read-only GitHub check named `koru / code-review`, run for pull requests
and explicit historical-review dispatches. It will pin Koru 0.1.444 and Vallm
0.1.94, select only changed supported source files, and let Koru execute one
bounded Vallm review round. The review combines deterministic syntax,
complexity and security checks with an OpenRouter semantic judge supplied by
the existing organization-level `OPENROUTER_API_KEY` secret.

The workflow will never use `pull_request_target`, check out untrusted code
with a write-capable token, modify source, auto-fix, commit, push or submit a
GitHub `APPROVE` review. A missing secret or semantic-provider failure is
recorded explicitly in the attested advisory report. It cannot decide the
required merge gate; deterministic `verify` and Java checks remain separate
required checks. Forked pull requests never receive organization secrets.

The machine-readable report will be bound to repository, base SHA, head SHA,
tool versions and verdict, uploaded as a CI artifact and covered by a GitHub
artifact attestation. A repository ruleset will require both the existing
governance check and `koru / code-review`; the Koru attestation is independent
read-only review evidence, not evidence that the implementation author or this
agent self-approved.

## Planned autonomous Validator approval extension

The user authorizes a dedicated `subactor/validator-agent` identity to review
and approve pull requests after deterministic checks and a bounded semantic
review. This is an independent reviewer, not the implementation agent and not
an arbitrary GitHub bot.

The coordinated implementation is bounded as follows:

- `todo2code` will version an allowlist of trusted Validator GitHub App review
  identities. CI will accept an App approval only when its login and account
  type match the allowlist, the reviewer differs from the PR author, the review
  is `APPROVED`, and its `commit_id` equals the current PR head SHA.
- Human `User` approvals remain supported. Unknown bots, stale approvals,
  dismissed reviews, review authors matching the PR author and mutable
  Markdown claims remain rejected.
- `validator-agent` will add an explicit `direct-pr` strategy for a repository,
  PR number and expected head SHA. Repository and base-branch allowlists are
  mandatory; the existing `if-uri/Agents #2` project-queue strategy remains
  unchanged.
- Direct validation is read-only with respect to the reviewed branch: it does
  not edit `VERSION`, `CHANGELOG.md`, repair TODOs, Issues or Project fields.
  Its only successful mutation is one GitHub `APPROVE` review from the
  dedicated Validator identity; rejection uses `REQUEST_CHANGES`.
- The direct strategy verifies the exact head twice, evaluates unsafe diff
  markers, requires configured hosted checks other than the circular
  `governance / enforce` approval gate, and performs the bounded OpenRouter
  review with `openrouter/z-ai/glm-5.2`.
- Workflow dispatch will require explicit `strategy=direct-pr`, repository,
  PR and expected SHA inputs. The GitHub App token is scoped to the selected
  owner/repository and merge remains disabled.

Planned `todo2code` paths are already covered by ticket-018:
`.governance/**`, `.github/workflows/ci.yml`, `AGENTS.md`, `TODO.md` and this
ticket. Planned `validator-agent` paths are `.github/workflows/validator.yml`,
`src/validator_agent/{cli,direct_validation,github}.py`, focused tests and the
existing README/runbook/permissions documentation. No application source in
`todo2code` and no unrelated dirty `validator-agent` file is in scope.

## Acceptance criteria

- [x] AC-01: A human approves this understanding and execution checklist before
      any implementation file is changed.
- [x] AC-02: A versioned machine-readable manifest and schema define ticket,
      approval, ownership, scope, Docker, evidence and stack requirements.
- [x] AC-03: A dependency-light deterministic validator emits documented stable
      `GOV-*` codes with message, affected paths/evidence and remediation, plus
      machine-readable JSON/SARIF output where applicable.
- [x] AC-04: The validator rejects code changes without a preceding active and
      approved ticket, multiple active tickets, malformed tickets, out-of-scope
      paths, agent edits of `user-*.md`, executable files in ticket directories,
      manifest drift, missing Docker declarations and forbidden secrets/paths.
- [x] AC-05: Approval provenance is checked against a trusted GitHub review
      boundary in CI; local or Markdown-only approval is never presented as a
      cryptographically trusted fact.
- [x] AC-06: A centrally maintained reusable GitHub workflow is pinned by
      immutable revision and documented together with the required repository
      ruleset/CODEOWNERS settings.
- [x] AC-07: Stack profiles provide appropriate gates for Node, Python, Go,
      Rust, Java, Docker, frontend E2E and infrastructure repositories without
      silently claiming unavailable tools.
- [x] AC-08: `todo2code` adopts the manifest lock, persistent agent instructions
      and a governance CI gate; its existing offline application and Docker E2E
      checks remain operational.
- [x] AC-09: Central validator fixture tests demonstrate both allowed and denied
      state transitions, including the exact ticket-017 DONE -> ticket-018 PLAN
      sequence used here.
- [x] AC-10: Relevant checks run in Docker where required, raw evidence is
      recorded, diffs are reviewed and no commit or push occurs unless requested.
- [x] AC-11: The manifest defines named workstreams, their path ownership,
      per-workstream active-ticket limits and a fail-closed overlap policy.
- [x] AC-12: The versioned intent schema represents workstream, dependencies,
      conflicts and integration routing without invalidating archived v1
      tickets or silently upgrading their meaning.
- [x] AC-13: Stable diagnostics reject unknown workstreams, two active tickets
      in one workstream, overlapping active write scopes, dependency cycles,
      unfinished prerequisites and unresolved cross-workstream changes.
- [x] AC-14: Fixture tests cover safe parallel tickets and every rejection
      above, including path patterns whose apparent non-overlap still resolves
      to a shared concrete file.
- [x] AC-15: CI validates every active intent together, emits JSON/SARIF
      evidence and documents worktree/branch isolation, CODEOWNERS and merge
      queue requirements without treating those local declarations as trusted
      server configuration.
- [x] AC-16: `todo2code` adopts the workstream map and demonstrates at least
      two parallel non-overlapping intents plus one rejected overlap in Docker.
- [x] AC-17: Existing application and Docker E2E checks still pass; unrelated
      concurrent changes in `.env.example`, `src/`, `test/` and
      `tests/fixtures/` are neither modified nor attributed to this ticket.
- [x] AC-18: A human approves the Koru review design, bounded scope and
      AC-18..AC-25 before the workflow or repository rules are changed.
- [x] AC-19: A pinned pull-request/workflow-dispatch job exposes the stable
      required-check name `koru / code-review` and resolves exact base/head
      SHAs without evaluating a merge-ambiguous working tree.
- [x] AC-20: Koru 0.1.444 runs exactly one read-only Vallm 0.1.94 review round
      over changed supported source files; auto-fix, commit, push and mutable
      dependency versions are absent.
- [x] AC-21: Deterministic project verification fails closed independently;
      Koru/Vallm semantic findings, missing credentials and provider failures
      remain explicit advisory evidence, with no secret value in logs.
- [x] AC-22: The structured report records repository, base/head SHA, selected
      files, tool/model versions and verdict, is uploaded with fixed retention,
      and receives GitHub artifact provenance attestation.
- [x] AC-23: The workflow uses least-privilege read permissions, never uses
      `pull_request_target`, and treats fork PRs without secrets as requiring a
      trusted rerun rather than exposing organization credentials.
- [x] AC-24: A repository ruleset requires `governance / enforce` and
      `koru / code-review`, blocks direct updates to `main`, dismisses stale
      evidence after new commits and cannot be bypassed by the implementation
      agent.
- [x] AC-25: Workflow syntax, local Koru/Vallm probes, negative failure paths,
      `npm run verify`, governance and relevant Docker checks pass; the
      pre-existing ticket-019 findings remain separately attributed.
- [x] AC-26: The governance manifest and ticket intent explicitly own only the
      three tracked generated-analysis artifacts that require normalization.
- [x] AC-27: The existing deterministic normalizer replaces every persisted
      temporary analysis root without regenerating analysis or running
      `project2.sh`.
- [x] AC-28: `verify:generated-analysis`, governance and the complete project
      verification pass on the repaired aggregate branch.
- [x] AC-29: The runtime workstream owns its Python runtime adapter test so the
      canonical `0.5.2` release assertion can be repaired without cross-stream
      scope laundering.
- [x] AC-30: A human approves AC-30..AC-40 and the exact cross-repository paths
      before governance, workflow, source or test implementation changes.
- [x] AC-31: The manifest/schema version a narrow trusted Validator review
      actor allowlist without treating every GitHub bot as trusted.
- [x] AC-32: Pull-request CI accepts an allowlisted independent Validator App
      approval only for the exact current head SHA and retains existing human
      `User` approval behavior.
- [x] AC-33: Deterministic fixtures reject unknown bots, stale/dismissed
      reviews, same-author reviews and malformed allowlist entries.
- [x] AC-34: `validator-agent` exposes an explicit direct-PR strategy bound to
      repository, PR number, allowed base branch and expected head SHA while
      preserving the existing Project-queue strategy.
- [x] AC-35: Direct validation never commits release metadata, edits the PR
      branch, mutates Issues/Projects or merges; its verdict mutation is limited
      to `APPROVE` or `REQUEST_CHANGES` from the dedicated identity.
- [x] AC-36: The direct strategy checks the exact diff, unsafe markers, required
      hosted checks and head stability, excluding only the documented circular
      approval gate from its prerequisite set.
- [x] AC-37: The semantic review uses `openrouter/z-ai/glm-5.2`, preserves cost,
      timeout and schema limits, and cannot become the required merge decision.
- [x] AC-38: Workflow dispatch requires explicit direct strategy inputs and
      creates a repository-scoped Validator App token; arbitrary repositories
      and mutable/unpinned heads are rejected.
- [x] AC-39: Focused negative/positive tests, both complete repository suites,
      governance, Java, gold, SDK examples and Docker smoke pass.
- [x] AC-40: After a separately trusted bootstrap review merges the policy,
      the real Validator App reviews PR #13 at its exact SHA and the rerun
      proves `governance / enforce` accepts that independent agent evidence.

Central adoption for AC-31..AC-33 is pinned to
`wellmanifest/new-project@d082373f314191dba794aba58aca2d4475ea497a`.
The caller passes `ifuri-validator-agent[bot]` through the App-only allowlist;
the reusable workflow resolves the ticket and writes current-event approval
evidence under `runner.temp`, outside the pull-request checkout.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Risks and constraints

- Git hooks are bypassable and therefore cannot be the final authority; branch
  protection or organization rulesets must require the server-side check.
- A workflow stored only in the target repository can be weakened in the same
  pull request; the design must pin central code and document external required
  workflow/ruleset enforcement.
- The current Governance Hub `project.sh` installs unpinned latest packages on
  the host and suppresses some failures. It must not be used as evidence that
  strict, reproducible governance already exists.
- `todo2code` currently has a large dirty worktree with concurrent changes.
  Implementation must use path-specific diffs and must not rewrite or attribute
  unrelated files to ticket-018.
- Live LLM behavior is nondeterministic and provider-dependent. It may produce
  advisory findings but cannot be a required merge gate.

## Validation result and publication blockers

The multi-workstream extension was explicitly approved by the user in chat on
2026-08-01. The results below describe the already executed 0.7.0 baseline and
remain historical evidence, not evidence for AC-11..AC-17.

- Central scaffolder and validator fixtures pass, including allowed/denied
  approval, ownership, scope, executable-ticket content, manifest integrity and
  commit-order cases.
- Target-scoped governance validation passes locally and in the offline Docker
  image. Negative probes return the expected stable codes.
- Docker E2E core passes 328 tests with 7 explicit optional-toolchain skips;
  Docker E2E full passes 328/328 with zero skips, both gold datasets, CLI, MCP,
  A2A and all five SDK examples.
- A concurrent human commit `5f1f4bd` included the ticket, governance adoption
  and unrelated runtime work in one commit. Validation against its parent fails
  with `GOV-INTENT-003` because `intent.json` was not present in an ancestor and
  `GOV-SCOPE-001` for eight paths outside ticket-018.
- The central 0.7.0 working tree has not been committed or published, so the
  target lock honestly records `publicationStatus: uncommitted` and cannot yet
  reference an immutable central workflow revision.
- Repository Ruleset/CODEOWNERS configuration is external state and remains
  unverified. A trusted GitHub owner/team must be selected without guessing.
- `new-project` 0.8.0 central schema, fixture and catalog checks pass. The
  catalog contains 27 stable codes and exactly covers every emitted `GOV-*`
  finding. Target manifest/intent Draft 2020-12 validation and its scoped
  governance gate pass.
- Docker workstream E2E accepts two active, non-overlapping `core-dsl` and `sdk`
  tickets, then rejects their concrete overlap on `src/core/graph.ts` with
  `GOV-WORKSTREAM-004`.
- Fresh core E2E passes; the focused Node result is 329 tests, 322 passed, zero
  failed and 7 optional-toolchain skips.
- The historical AC-17 Rust lock mismatch no longer reproduces on current HEAD.
  `cargo fetch --locked` succeeds in the full image and `make e2e-full` passes
  all 338 tests with zero skips. Ticket-018 did not rewrite or claim an SDK
  artifact; the current aggregate supplied the already corrected SDK state.
- Pull request #1 ran `koru / code-review` successfully as run `30703151199`.
  Its `t2c.koru-code-review/v1` report binds base `06a2faa`, head `4cfd2f9`,
  the pinned tool/model versions and an empty supported-source set. The report
  was uploaded for 14 days and has a GitHub Sigstore provenance attestation.
- Historical dispatch `30703292661` exercised the live semantic path over
  `src/comparison/workspace.ts` and `test/workspace.test.ts`. Koru rejected
  both files with exit 1; the required check failed while report construction,
  artifact upload and attestation still succeeded. The attested report digest
  is `sha256:fa0f4d0c1f780bb8d21f56ca74d8ae901e184fb4996f9e84832a87846adfc1d8`.
  No credential value appears in the workflow output.
- Repository ruleset `20186914` is staged with no bypass actors and
  `current_user_can_bypass: never`. It targets the default branch, requires a
  pull request, dismisses stale review evidence, rejects deletion/force-push,
  and requires strict `governance / enforce` plus `koru / code-review` checks.
  Enforcement remains disabled only until this bootstrap evidence commit is
  merged; AC-24 is not claimed until the rule is activated and queried back.

## Validator App publication evidence

- Installation `151227156` makes `ifuri-validator-agent` available to
  `semcod/todo2code`; repository-scoped App-token creation passes.
- Validator run `30924588549` approved PR #14 at exact head
  `17715cc6af4d983918462a23d0f37a810b910eec` for `ticket-018`; governance,
  verify, Java and Koru passed, and the human maintainer merged it as
  `944feda7b3914f747cc67d3682ce8427a7305ff4`.
- Validator run `30925171580` approved PR #13 at exact head
  `68b0c0985f0aa95f8a41e252399491fe7aea29ca` for `ticket-034`; the rerun proved
  `governance / enforce` accepts the independent App evidence. Validator did
  not merge either pull request.
- The remaining blocker is central `wellmanifest/new-project` PR #2 at exact
  head `d082373f314191dba794aba58aca2d4475ea497a`. It is green and mergeable but
  has no independent review, and the `wellmanifest` organization currently has
  no Validator App installation. Ticket-018 therefore remains
  `BLOCKED / PUBLICATION` and does not reserve its write scope while waiting.
