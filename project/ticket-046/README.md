# Ticket 046: Generate canonical pipeline event logs

- **ID**: ticket-046
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-05

## Goal and scope

Implement the first runtime producer of the `t2c.event-log/v1` contract from
ticket-045. One deterministic codec must parse, validate and render the closed
DSL, maintain its SHA-256 chain and publish `logs.dsl.txt` atomically beside
every pipeline `manifest.json` for succeeded, degraded and failed runs.

The producer records only runtime-owned pipeline facts. A later integration
ticket will acquire GitHub ticket, commit, push, PR, review, merge and branch
events and render a separate workflow-level stream. It must consume evidence;
it must not append to an immutable completed pipeline log.

## Acceptance criteria

- [x] AC-01: Scope, the two-level run/workflow artifact architecture and the
  deterministic local repository identity fallback are approved by a human
  owner.
- [x] AC-02: One dependency-free codec parses, validates and renders the exact
  `t2c.event-log/v1` field order, enums, bounds, event IDs, sequence and digest
  chain and accepts the ticket-045 canonical fixture.
- [x] AC-03: The writer publishes through a same-directory temporary file plus
  atomic rename, rejects unsafe evidence references and never serializes a
  secret, host path or LLM payload.
- [x] AC-04: Every succeeded, degraded and persisted failed pipeline run has a
  valid `logs.dsl.txt` beside `manifest.json`; the manifest registers its
  repository-relative path before the log hashes a canonical immutable
  projection of the persisted manifest.
- [x] AC-05: Pipeline events are derived from runtime-owned manifest and
  diagnostic evidence. LLM use may be recorded only as
  `ADVISORY_INFERENCE` and can never produce approval evidence.
- [x] AC-06: Repeated rendering of identical semantic inputs is byte-for-byte
  stable; focused, full host, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Architecture and bounds

- Component 1: `src/pipeline/event-log.ts` owns the closed codec, validation
  and atomic writer; `src/pipeline/event-log-persistence.ts` adapts persisted
  pipeline evidence without mixing acquisition into the codec.
- Component 2: `src/pipeline/run.ts` registers and writes the stream after the
  manifest for success/degradation and after the failed manifest for errors.
- Tests are limited to `test/pipeline-event-log.test.ts` and
  `test/pipeline.test.ts`.
- A valid Git remote supplies `owner/repository`. Without one, the producer
  uses `local/<sha256-derived-id>` so it neither guesses an owner nor leaks the
  absolute worktree path.
- Manifest evidence excludes only the mutable `files` registry. This prevents
  a later approved receipt registration from invalidating the completed log;
  all status, failure, stage, configuration, runtime and LLM audit fields
  remain covered by the evidence digest.
- Complexity class: S; maximum 30 minutes, five implementation files, two
  affected components, no public interface or dependency change.

## Non-goals

- No GitHub API/webhook acquisition, workflow publishing or artifact
  attestation in this ticket.
- No PR, review, merge or branch-deletion reconstruction from prose.
- No change to the canonical v1 grammar, CLI, SDK, workflows or package
  manifests.

## Approval boundary

The human owner explicitly approved ticket-046 on 2026-08-05. This authorizes
the five implementation files and architecture declared in `intent.json`;
protected publication still requires independent exact-head evidence.

## Validation evidence

- Focused codec and pipeline tests: 15 passed, 0 failed.
- Full host verification: 397 tests, 396 passed, 1 environment-dependent JDK
  skip, 0 failed; TypeScript module graph has no cycles.
- `make governance`: passed with 0 errors and 0 warnings.
- `make docker-smoke`: passed using the repository image build.
- `git diff --check`: passed; codec and persistence modules are 414 and 190
  lines respectively, below the repository GOD-file size threshold.
- The first hosted Koru run correctly rejected the changed legacy
  `runPipeline` function at `CC=65` and 372 lines. Its orchestration is now
  split into bounded private stages with a measured maximum of `CC=5` and 20
  lines per function; the public signature and all pipeline outputs remain
  unchanged.
- Post-refactor focused tests remain 15/15; full host verification, governance,
  Docker smoke and `git diff --check` pass again.
- Koru commit-bound review passed for exact head
  `1180e45e017c435839c4a3b526cca105a09c7b4f` after the deterministic
  complexity repair.
- Validator App approved that exact head using advisory model
  `openrouter/z-ai/glm-5.2`. Its LLM requested changes, but the findings were
  advisory and contradicted by the complete-file context, deterministic
  chain validation and passing tamper tests; they were not used as authority.
- Protected PR #62 merged as
  `main@c1decdb817acb06603a3051bc3370649566e1367`; the implementation branch
  was deleted, leaving only `main` remotely.
