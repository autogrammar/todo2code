# Ticket 018: Enforce new-project governance as policy-as-code

- **ID**: ticket-018
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
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
- [ ] AC-21: Deterministic syntax/complexity/security checks and semantic
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
- [ ] AC-25: Workflow syntax, local Koru/Vallm probes, negative failure paths,
      `npm run verify`, governance and relevant Docker checks pass; the
      pre-existing ticket-019 findings remain separately attributed.

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
  artifact upload and provenance attestation passed. AC-21 therefore remains
  open until the secret is rotated and the upstream parser defect is fixed or
  replaced with equivalent deterministic Koru-job evidence.
- The user subsequently authorized repository-secret rotation. A fresh
  repository-level `OPENROUTER_API_KEY` was written through `gh` stdin on
  2026-08-01 without exposing its value; it takes precedence over the stale
  organization secret only for `semcod/todo2code`. Dispatch `30714664770`
  proves the credential and increased provider limit now work: Gemini reviewed
  both TypeScript files with no provider error. Both file-level verdicts are
  `pass`, but Koru correctly remains non-passing under the current fail-on-any-
  finding policy because Vallm emits its known uppercase-language parser
  warning plus advisory whole-file findings unrelated to the model-default
  diff. The remaining AC-21 blockers are review context/parser policy, not the
  GitHub credential.
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
- Repository ruleset `20186914` is staged with no bypass actors and
  `current_user_can_bypass: never`. It targets the default branch, requires a
  pull request, dismisses stale review evidence, rejects deletion/force-push,
  and requires strict `governance / enforce` plus `koru / code-review` checks.
  Enforcement remains disabled only until this bootstrap evidence commit is
  merged; AC-24 is not claimed until the rule is activated and queried back.
