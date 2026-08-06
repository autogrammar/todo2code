# Ticket 048: Publish the GitHub event log adapter through governance

- **ID**: ticket-048
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-06

## Goal and scope

Ticket-047 built a working GitHub acquisition adapter but could never publish
it. Its work sits on a local `main` that branch protection refuses, and the
squashed commits fail CI governance twice over. This ticket republishes the
same bounded adapter through a route governance accepts, and removes the defect
that made it unpublishable.

Three findings drive the scope:

1. **`GOV-INTENT-003`** — ticket-047's `intent.json` and its implementation
   landed in one commit. The standard requires the plan to exist in an earlier
   commit than the implementation it authorizes.
2. **`GOV-TICKET-001`** — ticket-047 reached `DONE` before publication, and a
   closed ticket holds no authority over implementation paths, so its own PR is
   rejected.
3. **Unownable path** — `scripts/github-event-log.mjs` read
   `process.env.GITHUB_EVENT_PATH` and `process.env.GITHUB_REPOSITORY` as
   fallbacks. `verify:env` scans `scripts/**` and requires every referenced key
   in `.env.example`, but no workstream in `.governance/manifest.json` owns
   `.env.example`, and the manifest is hash-locked to the pinned upstream
   standard. No ticket can legally make that edit.

Finding 3 is a defect, not a governance inconvenience: a bounded acquisition
boundary should not silently inherit ambient process state. Both flags are
already explicit, so the fallbacks are removed and the flags become required.
`.env.example` then needs no change at all.

Ticket-047's directory travels with this ticket as its historical record. Its
`DONE` status and its log — including the explicit note that it carries no Koru
or Validator approval — are preserved verbatim, not rewritten.

## Acceptance criteria

- [ ] AC-01: The republication route, the removal of the two `process.env`
  fallbacks and the carried-over ticket-047 record are approved by a human
  owner.
- [ ] AC-02: `scripts/github-event-log.mjs` resolves the event path and the
  repository only from `--event-path` and `--repository`, fails closed with a
  named error when either is absent, and reads no `process.env` key.
- [ ] AC-03: `npm run verify:env` passes with `.env.example` unchanged from
  `main`, proving the unownable-path conflict is resolved at its cause.
- [ ] AC-04: The adapter's behavior is otherwise identical to ticket-047 —
  same event mappings, same allowlisted canonical evidence, same
  `SYSTEM_FACT` trust class, same immutable atomic publication.
- [ ] AC-05: `docs/EVENT_LOG_DSL.md` documents both flags as required and
  records that the adapter deliberately reads no environment variable.
- [ ] AC-06: The branch carries the plan in a strictly earlier commit than the
  implementation, and `project/governance-check.sh --actor ci --base <base>
  --head <head>` passes against the PR base.
- [ ] AC-07: Governance, full host verification and Docker checks pass with no
  dependency or public-interface change.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-claude.md](ai-claude.md)

## Architecture and bounds

- Component 1: `scripts/github-event-log.mjs`, republished with strictly
  flag-driven input resolution. The ticket-046 codec remains the single
  renderer, validator, digest chain and atomic writer.
- Component 2: the acquisition evidence —
  `test/workflow-validation.test.ts`, its bounded payload fixture and
  `docs/EVENT_LOG_DSL.md` — extended with one case proving the adapter ignores
  ambient environment state.
- The branch is cut from the protected `main` this PR targets, so the diff
  contains no `.env.example` change and no path outside the `integration`
  workstream or the manifest's `governancePaths`.
- Complexity class: S; maximum 30 minutes, four implementation files, two
  affected components, no public interface or runtime dependency change.

## Non-goals

- No `.github/workflows/**` wiring of the adapter; that stays deferred.
- No change to `.env.example`, `.governance/**` or the pinned standard, and no
  attempt to widen workstream ownership to cover `.env.example`.
- No new event vocabulary, renderer, public CLI command, SDK surface, runtime
  dependency or trusted approval policy.
- No rewrite of ticket-047's status, acceptance criteria, changelog or log.
- No `CHANGELOG.md` entry: that path is owned by no workstream, the same trap
  this ticket removes for `.env.example`.

## Approval boundary

Awaiting human approval. Implementation may not start before this ticket moves
to `IN_PROGRESS / EDIT`, and the plan commit that carries this file and
`intent.json` must precede any implementation commit.
