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
`7be2e266dfebfe91de1b78abf30ac8e518453216`; ticket-050 transitioned to
`IN_PROGRESS / EDIT` for exact-SHA adoption.

## Blockers

- None before implementation. Root-path claims will be added to the intent only
  in the same transaction that installs their ownership contract.
