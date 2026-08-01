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

## Blockers

- `GOV-INTENT-003`: concurrent commit `5f1f4bd` placed the ticket intent and
  implementation in the same commit; correcting this requires an authorized
  history/commit split.
- `GOV-SCOPE-001`: the same commit contains eight implementation/generated
  paths not allowed by ticket-018. They must be routed to their actual ticket,
  not retroactively claimed here.
- Central `new-project` 0.7.0 is uncommitted/unpublished, so no honest immutable
  reusable-workflow SHA exists yet.
- GitHub Ruleset and CODEOWNERS need a trusted human/team identity and external
  repository configuration.
- AC-17: concurrent commit `9928699` bumped the Rust SDK manifest to 0.5.1, but
  the ignored local Cargo lock still identifies the root package as 0.5.0.
  Official full Docker E2E fails closed at `cargo fetch --locked` (exit 101).
  Fixing or tracking that lock is an `sdk`/`integration` change outside this
  ticket's approved governance workstream.

## Approval boundary

- Current state: `BLOCKED / VALIDATION`. AC-11..AC-16 are implemented and verified; AC-17,
  immutable central publication and external Ruleset/CODEOWNERS remain open.
- Required response from: `unresolved:human`.
- The user supplied the requested fresh explicit approval in chat. It
  authorizes local implementation for this session; merge-time trust still
  requires an external GitHub review/ruleset and is not inferred from this
  agent-written record.
