# Ticket 051: Wire github-event-log acquisition into CI

- **ID**: ticket-051
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-06

## Goal and scope

Ticket-048 publishes `scripts/github-event-log.mjs` as a **callable** adapter
with required flags and no environment reads. Wiring it into
`.github/workflows/**` was an explicit non-goal of 048 so publication could
stay small.

This ticket adds a minimal, fail-closed CI (or reusable workflow) step that:

1. passes `--event-path`, `--repository`, and other flags **explicitly** from
   the Actions context (shell expansion of `$GITHUB_*` into argv is fine;
   `process.env` inside the script is not),
2. writes an artifact `logs.dsl.txt` for supported events only,
3. never soft-fails into guessing provenance or ambient state,
4. stays outside the trust root that approves merges (this step produces
   `SYSTEM_FACT` evidence; it does not approve PRs).

Prefer landing after ticket-048 merges so the script already exists on `main`.

## Acceptance criteria

- [ ] AC-01: Human approves event set (subset of push / pull_request /
  pull_request_review / completed workflow_run) and artifact retention.
- [ ] AC-02: Workflow invokes the script with only argv flags; a unit or
  workflow-validation case still proves the script reads no `process.env`.
- [ ] AC-03: Unsupported events fail closed without failing unrelated jobs
  (documented skip vs hard-fail policy).
- [ ] AC-04: Governance, verify, and docker gates pass; no `.env.example`
  change.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-grok.md](ai-grok.md)

## Non-goals

- No Validator self-trigger.
- No new event vocabulary.
- No restoration of ambient `process.env` fallbacks.

## Related

- [ticket-048](../ticket-048/README.md) (adapter publication)
- [ticket-049](../ticket-049/AUTONOMY_AND_REFACTOR_PLAN.md) §3 phase C2
- `docs/EVENT_LOG_DSL.md` acquisition section
