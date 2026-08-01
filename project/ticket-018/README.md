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
- [ ] AC-11: The manifest defines named workstreams, their path ownership,
      per-workstream active-ticket limits and a fail-closed overlap policy.
- [ ] AC-12: The versioned intent schema represents workstream, dependencies,
      conflicts and integration routing without invalidating archived v1
      tickets or silently upgrading their meaning.
- [ ] AC-13: Stable diagnostics reject unknown workstreams, two active tickets
      in one workstream, overlapping active write scopes, dependency cycles,
      unfinished prerequisites and unresolved cross-workstream changes.
- [ ] AC-14: Fixture tests cover safe parallel tickets and every rejection
      above, including path patterns whose apparent non-overlap still resolves
      to a shared concrete file.
- [ ] AC-15: CI validates every active intent together, emits JSON/SARIF
      evidence and documents worktree/branch isolation, CODEOWNERS and merge
      queue requirements without treating those local declarations as trusted
      server configuration.
- [ ] AC-16: `todo2code` adopts the workstream map and demonstrates at least
      two parallel non-overlapping intents plus one rejected overlap in Docker.
- [ ] AC-17: Existing application and Docker E2E checks still pass; unrelated
      concurrent changes in `.env.example`, `src/`, `test/` and
      `tests/fixtures/` are neither modified nor attributed to this ticket.

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
