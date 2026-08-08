---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-050
---
# Participant: codex (AI agent)

## Understanding

The two root files are checked by project workflows but absent from every
declared workstream. The installed new-project 0.11.0 governance package is
managed and hash-locked, so changing its target manifest directly would break
provenance instead of fixing ownership.

## Recommended decision

Choose Option A and assign both paths to `governance`. Resolve the policy in
`wellmanifest/new-project`, publish a new immutable release, and then adopt its
exact version and commit through Goal. This preserves one authoritative source
for managed ownership and permits ticket-048's omitted release note to be
repaired legally.

Option B is retained only as a documented fallback if upstream rejects that
ownership model.

## Execution plan after approval

1. Confirm ticket-049's plan and Option A are explicitly approved.
2. Transition ticket-050 to `IN_PROGRESS / EDIT` before any implementation.
3. Open a separately governed upstream ticket and worktree with non-overlapping
   ownership scope.
4. Add ownership and a regression that rejects claims from other workstreams.
5. Validate and publish an immutable upstream release.
6. Bind its version and source SHA in this intent, then adopt it through Goal.
7. Add ticket-048's missing release note and run governance, Node and Docker
   validation before exact-head review.

## Current state

The user approved ticket-049, selected Option A and authorized the governed
upstream work on 2026-08-08. Ticket-049 and upstream tickets 036–037 are
complete. Immutable `v0.12.0` is published at
`7be2e266dfebfe91de1b78abf30ac8e518453216`. A read-only comparison showed
that adopting it would change 15 managed target files plus the customized
manifest, lock and changelog, while both policy and intent allow five
implementation files. The validator provides no safe adoption exception, and
the hash-locked managed set cannot be split. It also spans governance-owned
contracts and the integration-owned `scripts/runtime.sh`, so the ordinary
one-workstream ownership gate cannot represent the atomic diff. No target
implementation file was changed; ticket-050 returned to
`PLAN / WAIT_FOR_APPROVAL`.

The approved prerequisite is now published as immutable new-project v0.13.0
at `12158ef0c009428deddceebb1049ddc3cb898eb3`. The user authorized
continuation, so ticket-050 resumed `IN_PROGRESS / EDIT`. The implementation
binds the installed v0.11.0 revision to that exact release and keeps the target seed
manifest, lock and changelog under ordinary governance accounting.

The adoption is now implemented and in `VALIDATION`. Goal reports the package
up to date, governance passes against the accepted base, `make verify` passes
401 tests with one controlled JDK skip, and Docker smoke passes. Ticket-048's
stale active header and omitted release note are reconciled with its already
merged PR #66 evidence.

Protected Koru then rejected five deterministic complexity findings in the
managed v0.13.0 Python payload, and PR #70 closed without merge. Upstream
tickets 040–041 repaired those findings without suppression or behavior change
and published immutable v0.13.1 at `7979cfe76797a4da6925be49496ff2462e78b3f7`.
The user approved continuation, so ticket-050 returned to `EDIT` for an atomic
replacement of the target revision and managed lock.

The replacement is complete and the ticket is back in `VALIDATION`. Goal binds
exact immutable v0.13.1 revision
`7979cfe76797a4da6925be49496ff2462e78b3f7` and is idempotent. Exact-base
governance passes; Vallm 0.1.94 passes all three managed Python files with zero
deterministic findings; `make verify` passes 401 tests with one controlled JDK
skip; and Docker smoke passes.

Protected governance correctly rejected the published HEAD because the
target-local reusable-workflow caller remained pinned to old standard SHA
`9706e63d5f121323e9087d0db47a16acdbd276bb`. That old resolver predates atomic
adoption and cannot resolve this indivisible diff. The ticket returned to
`EDIT`; `.github/workflows/ci.yml` is now explicitly in scope for an exact
v0.13.1 caller/reference alignment before review is repeated.

That alignment is implemented at `efe04444d792ae36df7f0bc708b42501404e4876`.
Both reusable-workflow references now bind exact v0.13.1 SHA `7979cfe...`;
workflow YAML validation and exact-base governance pass. The ticket returned
to `VALIDATION` for a fresh exact-head Koru and Validator review.

Protected execution then revealed that v0.13.1's REST acquisition omitted
`deleteBranchOnMerge` under the restricted Actions token. Upstream tickets
042–043 fixed that boundary without weakening the validator and published
immutable v0.13.2 at `85631ea24d127f1f4797d2a67f3524a63cbbc95a`.
The approved ticket returned to `EDIT` to adopt that exact release and align
the caller workflow to it.

The v0.13.2 adoption is implemented at
`7a52af9cd93be2dccb4c69a32d50ec4e8908849e`. Goal reports the managed package
up to date at exact release SHA `85631ea...`; the reusable workflow and
`standard-ref` select that same revision. Exact-base governance, workflow YAML
validation, all 389 host tests (388 pass and one controlled JDK skip), and
Docker smoke pass. The ticket is back in `VALIDATION` for exact-head protected
review.

## Blockers

- None. The provenance-bound atomic-adoption rule and immutable release are
  published and approved for use.
