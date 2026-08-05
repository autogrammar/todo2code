# Ticket 046: Generate canonical pipeline event logs

- **ID**: ticket-046
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
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

- [ ] AC-01: Scope, the two-level run/workflow artifact architecture and the
  deterministic local repository identity fallback are approved by a human
  owner.
- [ ] AC-02: One dependency-free codec parses, validates and renders the exact
  `t2c.event-log/v1` field order, enums, bounds, event IDs, sequence and digest
  chain and accepts the ticket-045 canonical fixture.
- [ ] AC-03: The writer publishes through a same-directory temporary file plus
  atomic rename, rejects unsafe evidence references and never serializes a
  secret, host path or LLM payload.
- [ ] AC-04: Every succeeded, degraded and persisted failed pipeline run has a
  valid `logs.dsl.txt` beside `manifest.json`; the manifest registers its
  repository-relative path before the log hashes the exact manifest bytes.
- [ ] AC-05: Pipeline events are derived from runtime-owned manifest and
  diagnostic evidence. LLM use may be recorded only as
  `ADVISORY_INFERENCE` and can never produce approval evidence.
- [ ] AC-06: Repeated rendering of identical semantic inputs is byte-for-byte
  stable; focused, full host, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Architecture and bounds

- Component 1: `src/pipeline/event-log.ts` owns the closed codec, validation,
  repository identity resolution and atomic writer.
- Component 2: `src/pipeline/run.ts` registers and writes the stream after the
  manifest for success/degradation and after the failed manifest for errors.
- Tests are limited to `test/event-log.test.ts` and `test/pipeline.test.ts`.
- A valid Git remote supplies `owner/repository`. Without one, the producer
  uses `local/<sha256-derived-id>` so it neither guesses an owner nor leaks the
  absolute worktree path.
- Complexity class: S; maximum 30 minutes, four implementation files, two
  affected components, no public interface or dependency change.

## Non-goals

- No GitHub API/webhook acquisition, workflow publishing or artifact
  attestation in this ticket.
- No PR, review, merge or branch-deletion reconstruction from prose.
- No change to the canonical v1 grammar, CLI, SDK, workflows or package
  manifests.

## Approval boundary

The ticket remains `PLAN / WAIT_FOR_APPROVAL`. No source or test file may be
edited until the human owner explicitly approves ticket-046.
