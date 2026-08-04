---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-018
---
# Participant: codex (AI agent)

## Understanding

The user wants `new-project` to control the operating logic of both humans and
agents rather than merely describe it. A multi-step change must have auditable
intent, bounded scope and acceptance criteria in a target-repository ticket
before implementation. Once a ticket is complete, the next change receives the
next ticket number. Follow-up work reuses an unfinished ticket. Human-owned
participant files remain outside agent control.

The enforcement model needs layered trust: fast local feedback, deterministic
CI policy checks, stack-specific verification and repository rules that prevent
merging around those checks. `todo2code` can compare declared intent with the
actual diff, but offline deterministic output—not an LLM response—must decide
the required gate.

The follow-up request extends this model for concurrent agents whose local
intentions may diverge but compose into a larger long-term capability. The
project should not be split into repositories yet. Instead, the governance
contract will model independent workstreams, non-overlapping write scopes and a
ticket dependency DAG. Divergence that changes a shared contract is routed to
an explicit integration ticket and fresh approval; it is never absorbed by
retroactively widening one agent's scope.

The current follow-up asks Koru to provide automated code review. This is a
read-only second-AI boundary: Koru orchestrates pinned Vallm checks for the
exact PR diff, produces a commit-bound attested report, and exposes a required
GitHub status. It may reject a change but may not edit it, push it or impersonate
a human `APPROVE` review.

Current verified baseline:

- Docker CLI and engine are available; engine version reported `29.1.3`.
- `ticket-017` is `DONE`, so `project/new-ticket.sh` correctly created
  `ticket-018` in `PLAN / WAIT_FOR_APPROVAL`.
- the copied ticket scripts in `todo2code` match the Governance Hub by SHA-256,
  but are not yet published in the current HEAD;
- the current `todo2code` CI tests the application and optional live provider,
  but has no governance job and no persistent `AGENTS.md`;
- no trusted human participant identity is available, so ownership remains
  `unresolved:human`.

## Execution plan

1. Stop at the plan-only boundary and obtain explicit human approval.
2. In the Governance Hub, define a versioned JSON contract and JSON Schema,
   stable diagnostic catalog and stack-profile contract without creating any
   ticket/task/log there.
3. Implement a deterministic validator with text, JSON and SARIF reporting;
   validate repository structure, ticket state, actor ownership, approval
   provenance inputs, manifest drift, diff scope, Docker and stack evidence.
4. Add fixture-driven allow/deny tests and a pinned reusable GitHub Actions
   workflow with least-privilege permissions.
5. Replace unsafe governance automation behavior relevant to the gate (unpinned
   host installs, swallowed validator failures) with a reproducible validation
   entry point, while preserving unrelated analysis generators.
6. Adopt the pinned governance contract in `todo2code`: add `.governance/`, a
   persistent `AGENTS.md`, local commands and the required CI integration.
7. Connect deterministic `todo2code` intent-vs-diff analysis as an additional
   gate or evidence producer; keep live LLM checks advisory/opt-in.
8. Run central governance fixtures, target manifest checks, negative probes,
   application verification and Docker E2E. Record raw command output here and
   map every failure to a stable code/remediation.
9. Review path-specific diffs, update acceptance evidence and report uncommitted
   status. Do not commit or push without a separate user request.
10. Return to `PLAN / WAIT_FOR_APPROVAL` for the multi-workstream scope
    evolution before changing schemas, validators, CI or documentation. The
    user explicitly approved AC-11..AC-17 in chat; transition to `EDIT`.
11. Add manifest and intent contracts for named workstreams, path ownership,
    dependency/conflict edges and explicit integration routing, with a
    deliberate v1 migration policy.
12. Extend deterministic validation and stable diagnostics for per-workstream
    active-ticket limits, concrete path overlap, cycles, unmet dependencies and
    missing integration tickets.
13. Add positive and negative central fixtures, then adopt the workstream map
    in `todo2code` and prove parallel non-overlap plus rejected overlap.
14. Validate in Docker, run existing E2E gates, review only ticket-018 paths and
    preserve all concurrent application changes.
15. Return to `PLAN / WAIT_FOR_APPROVAL` for the Koru review extension before
    changing workflows or external rules; record AC-18..AC-25 and the current
    tool/secret/ruleset baseline.
16. Add a least-privilege `pull_request` plus `workflow_dispatch` workflow with
    stable check name `koru / code-review`, exact base/head resolution and
    immutable action/tool pins.
17. Use Koru 0.1.444 loop mode for one read-only Vallm 0.1.94 round over changed
    supported source files, with deterministic and OpenRouter semantic checks.
18. Generate a sanitized structured review report, upload it with bounded
    retention and create a GitHub provenance attestation bound to the reviewed
    commit.
19. Exercise passing and failing review probes, missing-secret/provider failure,
    workflow validation, existing Node/Docker gates and scoped governance.
20. Configure a `main` ruleset requiring governance and Koru review only after
    the check exists; verify direct pushes and stale evidence are rejected.
21. Record the exact generated-analysis normalization scope and stop at
    `WAIT_FOR_APPROVAL` before changing the manifest or generated artifacts.
22. Assign `project/README.md`, `project/analysis.toon.yaml` and
    `project/index.html` to the governance workstream and ticket intent.
23. Run the existing deterministic root normalizer without regenerating the
    analysis and without invoking `project2.sh`.
24. Verify the focused generated-analysis gate, governance and the complete
    repaired aggregate.
25. Route `test/python-runtime*` to the runtime workstream after full
    verification exposes its stale release assertion.
26. Return to `WAIT_FOR_APPROVAL` for AC-30..AC-40 before changing approval
    policy, workflows, Validator source or tests.
27. Add a versioned, narrow allowlist for independent Validator App review
    actors and bind accepted reviews to the exact current PR head SHA.
28. Add negative governance fixtures for arbitrary bots, stale/dismissed
    reviews and same-author evidence while preserving human review behavior.
29. Add `validator-agent` strategy `direct-pr` with explicit repository, PR,
    base and SHA boundaries, hosted-check evidence and no branch metadata
    mutation or merge.
30. Keep the existing Project-queue strategy unchanged and select the strategy
    explicitly at workflow dispatch.
31. Validate locally, publish scoped PRs, obtain the required bootstrap review,
    then exercise the dedicated Validator identity against todo2code PR #13.

## Actual changes

- Created only the plan scaffold for `ticket-018` and updated the project-level
  ticket index/checklist. No implementation, source, test or CI file was
  changed for ticket-018.
- The user explicitly approved ticket-018 in chat after reviewing the plan;
  implementation is now authorized. Merge-time trust remains an external CI
  concern and is not claimed by this record.
- Implemented `wellmanifest/new-project` 0.7.0 policy-as-code: versioned
  manifest/intent schemas, diagnostic catalog, stack profiles, dependency-light
  validator, wrappers, safe `project.sh` entry point, fixture suite, reusable
  workflow and enforcement documentation.
- Updated the ticket scaffolder to create JSON-safe `intent.json` before code.
- Adopted the package in `todo2code` through `.governance/`, SHA-256 lock,
  `AGENTS.md`, Make/preflight commands and the `governance / enforce` CI job.
- Kept LLM findings outside the required decision path. All required governance
  checks are deterministic.
- Did not create or edit any `user-*.md` file.
- Implemented `new-project` 0.8.0 workstream coordination, intent v2,
  dependency/conflict/integration validation, 27-code catalog coverage,
  multi-active CI routing and manager/developer/two-AI operating guidance.
- Adopted eight workstreams in `todo2code` and synchronized the managed
  validator, schemas, diagnostics and scaffolder with updated SHA-256 lock
  evidence.
- Preserved archived v1 readability while requiring every active ticket under
  manifest v2 to migrate explicitly and receive fresh approval.
- Observed a concurrently created ticket-019 in the `sdk` workstream. It is
  non-overlapping and remains untouched; the final whole-workspace gate accepts
  ticket-018 (`governance`) and ticket-019 (`sdk`) as parallel PLAN/VALIDATION
  records while routing this implementation diff uniquely to ticket-018.
- Assigned exactly the three generated-analysis artifacts to governance and
  ticket-018, refreshed the manifest lock, and normalized their volatile
  analysis-worktree roots with the existing deterministic script.
- The focused generated-analysis and governance gates pass. No analysis was
  regenerated and `project2.sh` was not executed.
- Planned only the Koru code-review extension requested by the user. Verified
  published Koru 0.1.444 and Vallm 0.1.94, an organization-level OpenRouter
  secret visible to this repository, and the absence of branch protection,
  rulesets or an existing PR review for commit `06a2faa`. No workflow, source,
  test, external ruleset or human-owned file was changed in this plan phase.
- After explicit approval, added `.github/workflows/koru-code-review.yml` with
  immutable action pins, exact base/head selection, changed-source filtering,
  one Koru/Vallm round, fail-closed credential handling, structured evidence,
  bounded artifact retention and GitHub provenance attestation. The job is
  read-only with respect to repository contents and cannot approve or mutate a
  pull request.
- Published the workflow through pull request #1 after the Koru check, Node
  verification and Java adapter passed. The unrelated deterministic governance
  failure remains assigned to ticket-019.
- Exercised the real OpenRouter semantic path through historical dispatch
  `30703292661`. Koru/Vallm rejected two TypeScript files and propagated a
  failing required check while preserving an attested, commit-bound report.
- Staged repository ruleset `20186914` with no bypass actors, strict governance
  and Koru status checks, mandatory pull requests, stale-evidence dismissal and
  force-push/deletion prevention. It remains disabled solely for the final
  bootstrap evidence merge and will be activated afterward.
- Planned only AC-30..AC-40 for independent Validator App approval and the
  `direct-pr` strategy. No governance, workflow, source or test implementation
  file was changed in this planning phase.
- Changed the deployed `subactor/validator-agent` GitHub Actions variable from
  Gemini 3.1 Pro Preview to `openrouter/z-ai/glm-5.2`; no validation run was
  dispatched and no secret value was read.
- Implemented AC-31..AC-39 after the explicit approval: exact current-head
  trust resolution in todo2code and a repository/PR/base/SHA-bound direct
  strategy in Validator. The direct path cannot edit a branch, release
  metadata, Issues, Projects, or merge state.
- Full local and container validation passes, including Validator 96/96,
  todo2code full E2E with JDK 17 at 342/342, gold v1/v2, SDK examples,
  governance and Docker smoke.
- Audited Koru's failed PR #13 artifact and found a deterministic tool mismatch:
  the Python-only Vallm regression plugin invoked missing `pytest` for every
  TypeScript file. Removed that plugin from Koru while retaining the real npm
  verify/JDK checks and syntax, complexity, security and GLM 5.2 semantics.
- Corrected the trust boundary after policy 0.9.0 review: GLM findings and
  provider availability are recorded in `t2c.koru-code-review/v2` as advisory.
  The required merge decision remains in deterministic governance, verify and
  Java checks; the Koru job enforces exact report bindings, not an LLM verdict.
- Adopted central standard 0.9.0 at immutable revision
  `d082373f314191dba794aba58aca2d4475ea497a`. CI now calls that exact reusable
  workflow and passes only the observed `ifuri-validator-agent[bot]` App login.
  Approval evidence is generated in `runner.temp` and bound to repository, PR,
  current head, ticket and actor. The earlier checkout-owned resolver is detached
  from CI and retained only until the tracked generated-analysis index is refreshed.

## Publication blocker

- Central standard 0.9.0 is published at immutable commit
  `d082373f314191dba794aba58aca2d4475ea497a`; its PR #2 is green and still
  awaits an independent merge review. The `wellmanifest` organization reports
  zero App installations, so the existing Validator identity cannot yet
  provide that review.

## Approval boundary

- Current state: `BLOCKED / PUBLICATION`. GitHub now reports installation
  `151227156` for App `ifuri-validator-agent` in organization `semcod`, with
  repository selection `all`; todo2code publication evidence is complete.
  Central PR #2 still requires an independent reviewer or installation of the
  Validator App in `wellmanifest`.
- Required response from: `unresolved:human`.
- The user explicitly approved AC-18..AC-25 in chat. This authorizes the
  implementation workflow but is not itself merge-time review evidence.
- The user explicitly approved AC-26..AC-40 on 2026-08-04. Those criteria are
  complete; current `BLOCKED / PUBLICATION` state concerns only the independent
  review of central PR #2.
