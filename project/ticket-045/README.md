# Ticket 045: Kanoniczny dziennik zdarzen logs.dsl.txt

- **ID**: ticket-045
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-05

## Goal and scope

Define the canonical, append-only `t2c.event-log/v1` contract rendered as
`logs.dsl.txt`. The contract must cover the complete governed change lifecycle:
ticket transitions, commits and pushes, PR synchronization, checks, findings,
fixes, exact-head reviews, merge, branch deletion, tests, analysis and final
governance verdicts.

This is the architecture/integration slice. It specifies the grammar, trust
boundary, event taxonomy, ordering and tamper-evident digest chain before a
separate runtime ticket connects the contract to `src/pipeline/**` and GitHub
event acquisition.

`logs.dsl.txt` is a generated run/workflow artifact. It must not be updated by
a post-merge repository commit: that would create another event, invalidate
the reviewed SHA and cause an audit recursion.

## Acceptance criteria

- [ ] AC-01: Scope and the artifact-not-commit architecture are approved by a
  human owner.
- [ ] AC-02: `docs/EVENT_LOG_DSL.md` defines a closed versioned grammar,
  mandatory provenance, stable event types, deterministic ordering and secret
  redaction.
- [ ] AC-03: The canonical `logs.dsl.txt` fixture represents ticket, Git, PR,
  check, diagnostic, review, merge, branch cleanup, test and governance events.
- [ ] AC-04: Every event binds a correlation ID, actor, subject, source,
  timestamp, outcome, evidence digest, previous digest and its own digest.
- [ ] AC-05: The contract separates system facts, human decisions and advisory
  inference; an LLM event can never become trusted approval evidence.
- [ ] AC-06: A subsequent runtime ticket depends on ticket-045 and generates
  the same artifact for successful, degraded and failed executions.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Non-goals

- No changes to `src/**`, CLI, SDK or workflows in this ticket.
- No background service or runtime dependency.
- No secret values, free-form provider responses or unbounded payloads in the
  event stream.
- No claim that historical GitHub events can be reconstructed when no trusted
  webhook/API evidence was retained.

## Approval boundary

The ticket remains `PLAN / WAIT_FOR_APPROVAL`. Source and test implementation
may begin only after explicit human approval of this exact contract slice.
