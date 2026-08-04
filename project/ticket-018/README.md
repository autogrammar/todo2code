# Ticket 018: Enforce new-project governance as policy-as-code

- **ID**: ticket-018
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
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
bounded Vallm review round. The review runs deterministic complexity and
security checks, attempts Vallm syntax analysis, and uses an OpenRouter
semantic judge supplied by the existing organization-level
`OPENROUTER_API_KEY` secret.

The semantic judge is `google/gemini-3.1-pro-preview`, selected from the current
live `llm-code-benchmark/v1` report because it is the only compared model that
qualified for both repair and validation (repair 1.000, validation 0.929,
security 1.000 and availability 100%). Vallm's Python-oriented `--regression`
mode is intentionally not used for TypeScript: the separate required `verify`
job owns TypeScript compilation and the repository's 335-test regression
suite. Koru remains the read-only semantic, complexity and security review
boundary. Vallm still attempts syntax analysis, but 0.1.94 passes the uppercase
language enum `TYPESCRIPT` to a parser that accepts lowercase `typescript`.
The workflow now applies a pinned lowercase compatibility boundary before
parsing and still blocks if any `syntax.unsupported` finding remains.

The repaired execution budget is explicit and layered. GitHub terminates the
whole job after 10 minutes; Vallm and its LiteLLM request are bounded to 420
seconds so report construction, artifact upload and attestation retain roughly
three minutes of the job budget after an active-review timeout (less the setup
time already consumed). Responses are capped at 8192 tokens. LiteLLM retries are
disabled, therefore provider HTTP errors such as 401, 402, 403 or 404 fail
immediately rather than consuming the timeout. A pinned compatibility boundary
lowercases Vallm 0.1.94's language ID before tree-sitter parsing. Semantic
`info` and `warning` findings remain in the attested report as advisory when
Vallm's file-level verdict is `pass`; semantic errors and every syntax,
complexity, security, provider, malformed/missing-result or timeout finding
remain blocking.

The workflow will never use `pull_request_target`, check out untrusted code
with a write-capable token, modify source, auto-fix, commit, push or submit a
GitHub `APPROVE` review. A missing secret or semantic-provider failure is an
explicit non-passing outcome rather than a silent deterministic fallback.
Forked pull requests therefore require a trusted maintainer rerun in a safe
context instead of receiving organization secrets.

The machine-readable report will be bound to repository, base SHA, head SHA,
tool versions and verdict, uploaded as a CI artifact and covered by a GitHub
artifact attestation. A repository ruleset will require both the existing
governance check and `koru / code-review`; the Koru attestation is independent
read-only review evidence, not evidence that the implementation author or this
agent self-approved.

## Planned bounded-delivery extension

The follow-up changes the central `wellmanifest/new-project` contract and its
`todo2code` adoption so implementation tickets are small, predictable delivery
slices rather than open-ended projects. A slice owns exactly one observable
outcome in one workstream and has a hard active-execution timebox of at most 30
minutes. At 25 minutes the implementer records a checkpoint; at 30 minutes it
must stop. Unfinished work becomes a newly planned dependency slice and may not
be hidden by widening the current intent or PR.

Before `EDIT`, every slice will declare a machine-readable delivery budget:

- accepted base SHA and the exact target branch;
- one outcome plus explicit non-goals;
- complexity class `XS` (up to 10 minutes) or `S` (up to 30 minutes); larger
  work is rejected until decomposed;
- maximum implementation-file count, affected components, public-interface
  changes, dependency changes and migration/UI risk;
- architecture impact covering ownership, component boundaries, dependency
  direction, data/API flow, UI states and rollback;
- deterministic validation commands and evidence expected for each acceptance
  criterion.

Default hard limits will be conservative: one workstream, one capability, at
most five implementation files, at most two affected components, no new
runtime dependency and no public API/schema/database migration unless a
separately approved integration slice owns that contract. File count excludes
ticket evidence but not generated application artifacts. Line count and commit
count remain descriptive signals, never the sole measure of complexity.

Architecture is decided before coding, proportionally to risk. Every ticket
has a short architecture-impact record. An ADR/diagram is additionally required
only when the slice moves responsibility, changes a component/interface edge,
alters persistent data or adds a multi-state UI flow. UI slices must enumerate
loading, empty, error and success states as applicable and name their visual,
accessibility and interaction checks before implementation.

The validator will fail closed when the budget is absent, over 30 minutes,
larger than `S`, exceeded by the actual diff, or when architecture/validation
decisions remain unresolved. It will also compare the approved base with the
current branch, reject a mixed-ticket diff, require explicit dependencies and
conflicts, and invalidate approval after a base, scope or architecture change.
Before publication the slice is refreshed against the target branch and tested
again; a semantic or textual conflict returns it to planning rather than being
resolved opportunistically inside the PR.

Pull requests remain a protected publication boundary for implementation, but
their size is now bounded by the delivery contract. Documentation-only,
generated-artifact and emergency exceptions require an explicit manifest mode
and equivalent signed evidence; they are not a general direct-push bypass.

## Planned canonical 0.10.0 adoption and review-cost correction

Upstream `main@c0bb63e` and `feat/bounded-delivery-contract@1ae86a1` both
identify themselves as 0.9.0 but carry different lifecycle semantics. This
target is pinned to `1ae86a1`, where `PLAN` and `BLOCKED` still reserve
workstreams. Upstream main correctly reserves only `IN_PROGRESS`; the standard
must reconcile these contracts before another target upgrade is trustworthy.

Wait for `wellmanifest/new-project` ticket-003 to publish one reviewed full SHA
for 0.10.0 that combines bounded delivery with the corrected active/non-active
state model. Then run adoption in `--check` mode, review the managed-file plan,
apply the explicit upgrade and regenerate lock hashes against that exact SHA.

The executable Koru judge currently uses costly
`openrouter/google/gemini-3.1-pro-preview`. Per the user's cost decision it will
use `openrouter/z-ai/glm-5.2`. Historical benchmark logs remain unchanged as
historical evidence. No live OpenRouter request or new paid comparison belongs
to this migration.

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
- [ ] AC-06: A centrally maintained reusable GitHub workflow is pinned by
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
- [ ] AC-17: Existing application and Docker E2E checks still pass; unrelated
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
- [x] AC-21: Deterministic syntax/complexity/security checks and semantic
      LLM-as-judge review fail closed on findings, missing credentials,
      malformed output or provider failure, with no secret value in logs.
- [x] AC-22: The structured report records repository, base/head SHA, selected
      files, tool/model versions and verdict, is uploaded with fixed retention,
      and receives GitHub artifact provenance attestation.
- [x] AC-23: The workflow uses least-privilege read permissions, never uses
      `pull_request_target`, and treats fork PRs without secrets as requiring a
      trusted rerun rather than exposing organization credentials.
- [ ] AC-24: A repository ruleset requires `governance / enforce` and
      `koru / code-review`, blocks direct updates to `main`, dismisses stale
      evidence after new commits and cannot be bypassed by the implementation
      agent.
- [x] AC-25: Workflow syntax, local Koru/Vallm probes, negative failure paths,
      `npm run verify`, governance and relevant Docker checks pass; the
      pre-existing ticket-019 findings remain separately attributed.
- [x] AC-26: A human approves the bounded-delivery design and AC-26..AC-35
      before central policy, schemas, validator, templates or target adoption
      files are changed.
- [x] AC-27: The central manifest and intent schema define a maximum 30-minute
      slice, `XS|S` complexity, one outcome/workstream and explicit budgets for
      files, components, interfaces, dependencies, data and UI risk.
- [x] AC-28: Every implementation slice records its accepted base SHA, target,
      non-goals, architecture impact, rollback and criterion-specific validation
      before it can enter `EDIT`.
- [x] AC-29: Deterministic validation rejects missing/invalid budgets, estimates
      above 30 minutes, unresolved architecture, mixed-ticket diffs and actual
      file/component/interface/dependency scope above the approved limits.
- [x] AC-30: Reaching the 30-minute timebox or discovering additional outcome,
      workstream, contract or migration work stops the slice and creates an
      explicitly dependent plan; silent scope expansion is forbidden.
- [x] AC-31: Base-SHA drift, target-branch movement, changed architecture or a
      merge conflict invalidates stale approval and requires refresh, re-test
      and, where intent changed, fresh human approval.
- [x] AC-32: UI work declares applicable loading/empty/error/success states and
      visual, interaction and accessibility evidence; architecture diagrams or
      ADRs are required only for genuine boundary/flow changes.
- [x] AC-33: Central fixtures cover an accepted 10-minute fix, an accepted
      30-minute slice, over-budget decomposition, file-budget overflow,
      unresolved architecture, stale base and overlapping branch scenarios.
- [ ] AC-34: `todo2code` adopts the pinned contract in `AGENTS.md`, managed
      governance files and ticket templates without changing application code
      or claiming existing unrelated PRs.
- [x] AC-35: Central tests, target governance fixtures and documentation
      consistency pass; the diff contains only approved governance paths in
      each repository and records inherited repository blockers separately.
- [ ] AC-36: A human approves upstream reconciliation, exact-SHA adoption,
      diagnostic comparison and the GLM cost correction before managed files
      or workflow configuration change.
- [ ] AC-37: The adopted standard is one reviewed full SHA identified as
      0.10.0; lock hashes match every managed file and no moving branch or
      remote-branch publication claim remains.
- [ ] AC-38: Bounded delivery remains available while only `IN_PROGRESS`
      reserves scope; planning/backlog/blocked tickets do not create active
      conflict, dependency, ownership or overlap diagnostics.
- [ ] AC-39: Koru uses `openrouter/z-ai/glm-5.2`; executable configuration and
      current guidance contain no Gemini 3.1 Pro Preview default, while
      historical evidence remains explicitly historical.
- [ ] AC-40: Adoption preflight, governance fixtures, workflow validation,
      `npm run verify`, Docker-relevant checks and `git diff --check` pass
      without a live LLM request or application-source edit.

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

## Approval boundary

- Current follow-up state: `PLAN / WAIT_FOR_APPROVAL` for AC-36..AC-40.
- Upstream ticket-003 must complete first. A changed upstream SHA, managed-file
  plan or workflow model returns this phase to planning.
- Required response from: `unresolved:human`.
- The user explicitly approved AC-26..AC-35 in chat. This authorizes the
  implementation session but is not merge-time evidence.

## Validation result and publication blockers

The multi-workstream extension was explicitly approved by the user in chat on
2026-08-01. The results below describe the already executed 0.7.0 baseline and
remain historical evidence, not evidence for AC-11..AC-17.

- `wellmanifest/new-project` 0.9.0 is implemented as six local commits on
  `feat/bounded-delivery-contract`, each changing at most five files. JSON
  Schema Draft 2020-12 validation, Python compilation, scaffolder tests and
  validator positive/negative fixtures pass.
- The target copies the 0.9.0 schemas, diagnostics, validator and scaffolder and
  pins their hashes to local upstream commit `1ae86a1`. The manifest keeps
  `delivery.requiredForImplementation=false` during migration because the
  historical ticket-018 branch already exceeds the new five-file slice limit.
  New repositories enable the bounded gate by default.
- Target schema and lock validation pass. `make governance` emits no new
  delivery/base/architecture/budget finding. A central wildcard-ownership
  regression removed the false ticket-020 finding; four inherited coordination
  findings for tickets 018/019 remain. Full activation
  (AC-34) waits for those historical branches to be serialized or completed.

- Central scaffolder and validator fixtures pass, including allowed/denied
  approval, ownership, scope, executable-ticket content, manifest integrity and
  commit-order cases.
- Target-scoped governance validation passes locally and in the offline Docker
  image. Negative probes return the expected stable codes.
- Fresh `npm run verify` passes type checks, module/LLM boundaries, environment,
  workflow and schema checks plus 334/335 Node tests with one JDK skip. Docker
  E2E core passes 328/335 tests with seven explicit optional-toolchain skips,
  both gold datasets, CLI, MCP, A2A and its available SDK examples.
- Docker E2E full still fails before tests at `cargo fetch --locked` (exit 101)
  because the concurrent Rust SDK manifest is version 0.5.1 while its ignored
  lock remains 0.5.0. This is separately attributed to SDK/integration.
- A concurrent human commit `5f1f4bd` included the ticket, governance adoption
  and unrelated runtime work in one commit. Validation against its parent fails
  with `GOV-INTENT-003` because `intent.json` was not present in an ancestor and
  `GOV-SCOPE-001` for eight paths outside ticket-018.
- Central 0.9.0 plus its behavior-preserving complexity refactor are committed
  locally and target hashes are pinned to `1ae86a1`,
  on the published upstream branch `feat/bounded-delivery-contract`; the commit
  is remotely fetchable but is not yet a merged release on upstream `main`.
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
- AC-17 remains blocked outside this governance diff. Concurrent commit
  `9928699` changed `sdk/rust/Cargo.toml` from 0.5.0 to 0.5.1 while the ignored
  local `sdk/rust/Cargo.lock` still records 0.5.0. `make e2e-full` therefore
  stops at `cargo fetch --locked` with exit 101 before the full tests start.
  Resolving it belongs to the `sdk`/`integration` workstream and requires its
  own approved ticket; ticket-018 does not rewrite or claim that artifact.
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
- Pull request #3 exposed that the original Koru configuration had drifted from
  the current benchmark winner. Run `30712589077` still used
  `openrouter/deepseek/deepseek-v4-pro`; Vallm also attempted `pytest` for the
  TypeScript diff and the semantic request failed with OpenRouter 401 `User not
  found`. The workflow now uses the qualified Gemini model and delegates
  regression to the already passing required `verify` job. The 401 cannot be
  repaired in repository code: a trusted repository or organization owner must
  rotate the `OPENROUTER_API_KEY` Actions secret and rerun the exact commit.
- Pull request #4 run `30712853708` passed the read-only Koru gate for commit
  `a4eb0f9`. Its attested `t2c.koru-code-review/v1` report records
  `openrouter/google/gemini-3.1-pro-preview` and an empty supported-source set,
  so no provider request or cost occurred. This proves the deployed workflow
  configuration and no-source path; it does not supersede the required live
  rerun after secret rotation.
- Workflow dispatch `30713017811` then exercised that workflow against the
  exact two-file TypeScript diff from pull request #3. The report records the
  Gemini judge and no longer contains a regression/`pytest` error. It rejects
  fail-closed because OpenRouter still returns 401 `User not found`; it also
  retains Vallm 0.1.94's `TYPESCRIPT` parser warning. Report construction,
  artifact upload and provenance attestation passed. At that point AC-21
  remained open until the secret and parser boundary were repaired.
- The user subsequently authorized repository-secret rotation. A fresh
  repository-level `OPENROUTER_API_KEY` was written through `gh` stdin on
  2026-08-01 without exposing its value; it takes precedence over the stale
  organization secret only for `semcod/todo2code`. Dispatch `30714664770`
  proves the credential and increased provider limit now work: Gemini reviewed
  both TypeScript files with no provider error. Both file-level verdicts are
  `pass`, but Koru correctly remains non-passing under the current fail-on-any-
  finding policy because Vallm emits its known uppercase-language parser
  warning plus advisory whole-file findings unrelated to the model-default
  diff. At that point the remaining AC-21 blockers were review context/parser
  policy, not the GitHub credential; later evidence below resolves them.
- The timeout/policy repair bounds the complete job to 10 minutes and the
  active review to 420 seconds, caps output at 8192 tokens, disables retries
  (including 404), normalizes the Vallm TypeScript language ID and separates
  advisory semantic warnings from blocking deterministic/provider/semantic
  errors without removing any finding from the attested JSON.
- Repaired workflow dispatch `30746421293` reviewed the exact pull request #3
  range `2e87205..6b79527` with Gemini in 1 minute 24 seconds. Its attested
  report selects `src/config/env.ts` and `test/config-env.test.ts`, records 2/2
  passed, no failed files, no parser/provider finding and exit 0. All five
  whole-file semantic observations remain visible as advisory; the policy
  records Vallm's original exit 2 before deterministic normalization.
- A follow-up exact-stack LiteLLM probe used a local HTTP endpoint: HTTP 404
  produced `NotFoundError` after about 705 ms with exactly one request and the
  8192-token ceiling intact. A slow endpoint with a 0.5-second probe ceiling
  produced `Timeout` after about 799 ms with exactly one request. Fresh local
  `npm run verify` and Docker `e2e-core` pass; Docker `e2e-full` still stops at
  the separately attributed stale Rust lock with `cargo fetch --locked` exit
  101, without any ticket-018 change to the SDK.
- The final bounded-delivery audit covers six upstream and five target commits;
  every commit changes at most five files. Central validator/scaffolder tests,
  target lock verification and the exact four-finding governance attribution
  pass, with no ticket-020 or delivery/base/architecture/budget finding.
- Repository ruleset `20186914` is staged with no bypass actors and
  `current_user_can_bypass: never`. It targets the default branch, requires a
  pull request, dismisses stale review evidence, rejects deletion/force-push,
  and requires strict `governance / enforce` plus `koru / code-review` checks.
  Enforcement remains disabled only until this bootstrap evidence commit is
  merged; AC-24 is not claimed until the rule is activated and queried back.
- Pull request #4 run `30904837479` exposed 14 deterministic complexity
  findings in the managed validator. The source validator was split into
  focused policy, coordination, delivery and reporting helpers at upstream
  commit `1ae86a1`, without changing diagnostics or fail-closed policy.
  Central validator/scaffolder fixtures pass, old/new JSON and SARIF reports
  for the full PR range are byte-identical, and Lizard reports zero functions
  above CC 15 or 100 lines. Run `30906125354` then passed Koru/Gemini for exact
  head `aff2137` with 1/1 file, zero blocking/advisory findings and an attested
  report. A later provenance-only commit must receive its own fresh checks.
