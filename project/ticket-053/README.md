# Ticket 053: Match the local governance gate to CI before push

- **ID**: ticket-053
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
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

This ticket makes that invocation a **binding pre-push obligation** in
`README.md`, so it is run before a push rather than discovered from a failed
pull request. A non-zero exit is blocking: an advisory gate would reproduce the
present situation, where the signal exists but nobody acts on it.

### Evidence that this is worth doing

Pull request #64 was opened, consumed a full CI round on four jobs, failed
`GOV-TICKET-001`, and was closed without merging. The command above reports the
same failure locally in well under a second. The subsequent rebuild
(ticket-048) then republished code that had already been correct, purely
because its commit topology could not satisfy `GOV-INTENT-003`.

## Acceptance criteria

- [x] AC-01: Scope, the workstream and the failure policy are approved by a
  human owner: `governance`, blocking.
- [x] AC-02: `README.md` documents the CI-form invocation against the merge
  base with `origin/main` and states that a non-zero exit is blocking.
- [x] AC-03: The gate is proven against real history: it fails on the ticket-047
  squashed topology (`GOV-TICKET-001`) and passes on the ticket-048
  plan-then-implementation topology.
- [x] AC-04: The documented invocation resolves the base with `git merge-base`
  and needs no network access when `origin/main` is already fetched.
- [x] AC-05: `README.md` states that this form — not the working-tree
  form — is what must be green before a push, and names the diagnostics it
  catches.
- [x] AC-06: Governance, full host verification and Docker checks pass with no
  dependency or public-interface change.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-claude.md](ai-claude.md)

## Architecture and bounds

- One section in `README.md` carrying the exact invocation and the blocking
  policy. No second checker, no reimplementation of any diagnostic, no change
  to `.governance/**` or the pinned standard.
- Complexity class: XS; one implementation file, one affected component, no
  public interface or runtime dependency change.

### Why neither a `Makefile` target nor an `AGENTS.md` rule

The owner chose the `governance` workstream so the work could start
immediately, accepting the flagged risk. That risk was then verified and it is
real, so the deliverable is documentation rather than a `make` target:

- `Makefile` matches `coordination.integration.requiredForPaths`, so changing
  it from a non-`integration` ticket raises `GOV-INTEGRATION-001`. Path
  ownership is not transferable by an `integrationTicket` reference.
- `AGENTS.md`, `project/governance-check.sh`, `project.sh`, `project.bat`,
  `project/new-ticket.sh` and `project/readme.sh` are all listed in
  `.governance/manifest.lock.json` `managedFiles`, hash-locked to the pinned
  standard. Editing `AGENTS.md` raises `GOV-SYNC-001`.

`README.md` is the only governance-owned, unlocked document that is not a
ticket directory, so it carries the rule. The canonical agent-facing home is
`AGENTS.md`, which belongs to `wellmanifest/new-project`; putting it there is a
standard upgrade, the same class of dependency as ticket-050.

This costs little, because the capability already exists and works; what was
missing is the obligation to use it. A `make governance-ci` convenience wrapper
remains a worthwhile follow-up and must be an `integration` ticket, after
ticket-048 releases that workstream.

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

The human owner approved this ticket on 2026-08-06, selecting the `governance`
workstream and a blocking failure policy. `governance` holds no other active
ticket, so this does not contend with ticket-048 in `integration`.

Publication waits: the GitHub Actions `major_outage` recorded in ticket-049
means nothing can be pushed without moving a pull-request head onto a commit
with no check runs.
