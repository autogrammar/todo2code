# Ticket 053: Match the local governance gate to CI before push

- **ID**: ticket-053
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-06

## Goal and scope

`make governance` and the CI governance job answer different questions, and the
gap between them is the single largest source of wasted work observed so far.

- `make governance` compares the **working tree to `HEAD`**. It sees
  uncommitted edits.
- The CI job compares **`base..head`** of the pull request. It sees the whole
  branch as one proposed change.

Three diagnostic classes are therefore invisible locally and can only fail
after a push: `GOV-INTENT-003` (intent must exist in a commit strictly earlier
than the implementation it authorizes), `GOV-TICKET-001` (a closed ticket has
no authority over implementation paths) and the workstream/scope checks as they
apply to the full branch diff.

The checker already supports the CI form. Nothing new has to be written:

```bash
bash project/governance-check.sh --actor ci \
  --base "$(git merge-base origin/main HEAD)" --head HEAD
```

This ticket exposes that invocation as a first-class, documented gate so it is
run before a push rather than discovered from a failed pull request.

### Evidence that this is worth doing

Pull request #64 was opened, consumed a full CI round on four jobs, failed
`GOV-TICKET-001`, and was closed without merging. The command above reports the
same failure locally in well under a second. The subsequent rebuild
(ticket-048) then republished code that had already been correct, purely
because its commit topology could not satisfy `GOV-INTENT-003`.

## Acceptance criteria

- [ ] AC-01: Scope, the target name and the failure policy are approved by a
  human owner.
- [ ] AC-02: A documented entry point runs the CI-form governance check against
  the merge base with `origin/main`, and exits non-zero exactly when the CI job
  would.
- [ ] AC-03: The gate is proven against real history: it fails on the ticket-047
  squashed topology (`GOV-INTENT-003` plus `GOV-TICKET-001`) and passes on the
  ticket-048 plan-then-implementation topology.
- [ ] AC-04: The entry point resolves the base without network access when
  `origin/main` is already fetched, and reports a clear, actionable message
  when it is not.
- [ ] AC-05: `AGENTS.md` or the operator guide states that this gate — not
  `make governance` — is what must be green before a push.
- [ ] AC-06: Governance, full host verification and Docker checks pass with no
  dependency or public-interface change.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-claude.md](ai-claude.md)

## Architecture and bounds

- One `Makefile` target wrapping the existing `project/governance-check.sh`.
  No second checker, no reimplementation of any diagnostic, no change to
  `.governance/**` or the pinned standard.
- Complexity class: XS; two implementation files, one affected component, no
  public interface or runtime dependency change.

### Open decision for the human owner

`Makefile` is owned by both the `governance` and `integration` workstreams, and
`coordination.integration.requiredForPaths` lists it. This ticket is scaffolded
as `integration` on that basis, but the owner may re-home it to `governance`.
That choice also decides when it can start, since `integration` currently has
ticket-048 active and `maxActiveTicketsPerWorkstream` is 1.

A second decision is the failure policy: whether the gate is advisory (reports,
exit 0) or blocking (exit non-zero). The acceptance criteria above assume
blocking, because an advisory gate reproduces the present situation where the
signal exists but is not acted on.

## Non-goals

- No change to `.governance/**`, `manifest.json`, the lock or the pinned
  standard; this ticket only invokes the checker that already exists.
- No new governance diagnostic, rule or trust decision.
- No pre-push Git hook installed automatically. A hook is a reasonable
  follow-up, but installing one silently into a developer's clone is a
  separate, opt-in decision.
- No attempt to make `make governance` itself compare against a base; its
  working-tree semantics stay useful during editing.

## Approval boundary

Awaiting human approval. No implementation may start before this ticket moves
to `IN_PROGRESS / EDIT`, and the workstream question above must be resolved
first because it determines whether the ticket may become active at all while
ticket-048 holds `integration`.
