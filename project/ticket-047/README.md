# Ticket 047: Collect bounded GitHub evidence into event logs

- **ID**: ticket-047
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-05

## Goal and scope

Add the first GitHub acquisition adapter for the existing
`t2c.event-log/v1` codec. A dependency-free Node script will accept one
bounded GitHub Actions event payload, copy only event-specific allowlisted
fields into canonical evidence, map the observed transition to the closed v1
event vocabulary and publish one immutable workflow-run `logs.dsl.txt`.

This ticket creates no new evaluation DSL and performs no GitHub API calls.
It is the integration boundary between retained GitHub payload evidence and
the runtime codec delivered by ticket-046. A later governance ticket may wire
the script into GitHub Actions without duplicating acquisition or validation.

## Acceptance criteria

- [x] AC-01: The one-event-payload/one-workflow-artifact architecture, event
  mappings and fail-closed unsupported-event behavior are approved by a human
  owner.
- [x] AC-02: The collector deterministically maps supported `push`,
  `pull_request`, `pull_request_review` and completed `workflow_run` payloads
  to the existing closed `t2c.event-log/v1` types and rejects unsupported
  actions rather than inventing semantics.
- [x] AC-03: Evidence bytes are canonical JSON made only from allowlisted
  GitHub fields; raw webhook payloads, environment dumps, query credentials,
  secrets and host paths never enter `logs.dsl.txt`.
- [x] AC-04: The script validates repository, ticket, base/head SHA and actor
  bindings, then reuses the ticket-046 codec and atomic writer to publish one
  parseable immutable workflow artifact.
- [x] AC-05: A review is recorded only as `SYSTEM_FACT`; ordinary GitHub review
  state cannot become `TRUSTED_ATTESTATION`, and no LLM output can grant
  approval.
- [x] AC-06: Golden, negative, repeatability, full host, governance and Docker
  checks pass without a dependency or public-interface change.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Architecture and bounds

- Component 1: `scripts/github-event-log.mjs` owns acquisition and explicit
  GitHub event/action mappings. It imports the built ticket-046 codec; it does
  not implement a second renderer, validator or hash chain.
- Component 2: the existing workflow-validation test plus one bounded payload
  fixture prove mapping, canonical evidence projection, safety, trust classes
  and deterministic bytes. `docs/EVENT_LOG_DSL.md` documents the producer
  boundary and the later workflow handoff.
- Every invocation observes one immutable GitHub event payload and produces one
  immutable artifact. Lifecycle history is a set of attributable workflow-run
  streams; completed logs are never appended or committed back to `main`.
- Supported mappings are deliberately closed: push/branch deletion and commit
  facts, PR open/synchronize/merge/close, PR review state, and completed
  workflow checks. Missing ticket or SHA knowledge remains `null`; it is not
  guessed from narrative.
- Complexity class: S; maximum 30 minutes, four implementation files, two
  affected components, no public interface or runtime dependency change.

## Non-goals

- No edit to `.github/workflows/**`, branch protection, reusable governance or
  GitHub repository settings.
- No GitHub API polling, historical reconstruction, cross-run append or commit
  of generated `logs.dsl.txt` artifacts.
- No new event vocabulary, public CLI/package command, SDK surface, runtime
  dependency or trusted approval policy.

## Approval boundary

The human owner approved ticket-047 on 2026-08-05, allowing execution of the
declared bounded acquisition architecture and test scope. This authorizes the
three-implementation-file boundary in `intent.json`.

Implementation now starts from this approved scope; one immutable workflow-run
`logs.dsl.txt` per payload remains the single persistence target.
