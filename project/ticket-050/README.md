# Ticket 050: Own or explicitly exclude unpublishable root paths

- **ID**: ticket-050
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-06

## Goal and scope

`CHANGELOG.md` and `.env.example` are scanned by project tooling, but **no
workstream owns them** in `.governance/manifest.json`. Agents therefore either
claim paths that governance rejects or omit required release evidence
(ticket-048's known gap).

The recommended decision is **Option A**: assign both paths to the existing
`governance` workstream. `CHANGELOG.md` is release/governance evidence, while
`.env.example` is a reviewed, non-secret environment contract enforced by
`verify:env`. One owner keeps their policy atomic and avoids overlapping
governance and integration scopes.

The installed manifest is managed and hash-locked to immutable
`wellmanifest/new-project` 0.11.0. The ownership change therefore cannot be
made as a standalone local patch. Implementation proceeds upstream-first:

1. Create and approve a governed ticket in `wellmanifest/new-project`.
2. Add the two ownership rules and regression coverage to the standard.
3. Publish a new immutable standard release.
4. Adopt that exact version and source revision in todo2code through Goal,
   preserving the customized target workstreams.
5. Record ticket-048's missing release note in the newly owned changelog.

**Option B** remains a fallback only if the upstream maintainers reject the
ownership model: permanently exclude both paths, make wrong claims fail
closed, and designate an owned release-note surface.

The user approved ticket-049, selected Option A and authorized the upstream
work on 2026-08-08. Ticket-049 is complete. Upstream tickets 036 and 037
published the ownership contract in immutable `v0.12.0`. Upstream tickets 038
and 039 then published the bounded atomic-adoption contract in immutable
`v0.13.0` at `12158ef0c009428deddceebb1049ddc3cb898eb3`.

A read-only adoption comparison found that `v0.12.0` would replace 15 managed
target files and update the customized manifest, lock and changelog. The
current policy and ticket both cap a delivery at five implementation files;
the `v0.12.0` validator has no immutable-adoption accounting exception.
The managed replacement also crosses existing ownership boundaries:
`scripts/runtime.sh` belongs to `integration`, while the governance contracts
and wrappers belong to `governance`. The one-ticket/one-workstream rule has no
provenance-bound adoption transaction that can own this indivisible diff.
Splitting the managed-file replacement is invalid because the regenerated lock
binds the complete managed set atomically. Ticket-050 therefore returned to
`PLAN / WAIT_FOR_APPROVAL` before Goal changed any target file.

The revised plan is to add a narrow upstream rule for a provenance-bound,
atomic standard adoption, publish that capability in a new immutable release,
and then resume this target adoption. The rule must not create a general file
budget bypass: it must recognize only the complete managed set bound to one
published source revision, account for that managed set without transferring
ordinary path ownership, and leave all target-local changes normally budgeted
and owned.

That prerequisite is now complete and the user authorized continuation. This
ticket resumed `IN_PROGRESS / EDIT` on 2026-08-08. Its intent binds the exact
installed revision and exact `v0.13.0` release revision; the seed manifest,
lock and changelog remain ordinary governance-owned implementation files.

The first downstream PR #70 passed functional, host and Docker validation but
protected Koru rejected five pre-existing complexity findings in the managed
v0.13.0 Python payload. The PR closed without merge and its branch was
preserved. Upstream tickets 040–041 reduced those findings without changing
behavior or review thresholds and published immutable `v0.13.1` at
`7979cfe76797a4da6925be49496ff2462e78b3f7`. After explicit user approval,
ticket-050 returned from `VALIDATION` to `EDIT` to adopt that exact repair.

Protected governance then exposed one remaining caller dependency: Goal
updated the managed package and lock, but the target-local reusable-workflow
reference in `.github/workflows/ci.yml` still selected the pre-adoption
standard SHA `9706e63d5f121323e9087d0db47a16acdbd276bb`. That resolver cannot account
for the v0.13 atomic-adoption transaction. The ticket therefore returned to
`EDIT` to bind both the reusable workflow and its `standard-ref` input to the
same exact v0.13.1 release SHA already recorded by the lock.

## Acceptance criteria

- [x] AC-01: Human selected Option A and authorized the governed upstream
  ticket on 2026-08-08.
- [x] AC-02: Manifest / standard / agent docs updated so the chosen policy is
  machine-checkable.
- [x] AC-03: A regression test or governance diagnostic fails when an agent
  plan claims those paths under the wrong policy.
- [x] AC-04: Ticket-048's known gap is closed or explicitly re-homed under the
  new policy.
- [x] AC-05: Adoption binds an immutable standard version and source revision,
  preserves local workstream customization, and is idempotent under Goal.

## Validation evidence

- Goal adopted exact immutable new-project v0.13.1 release revision
  `7979cfe76797a4da6925be49496ff2462e78b3f7`; a repeated `--check` reports
  the package up to date.
- Governance passed against accepted base
  `b23d255c6bafbcc204ad7ec1e84e0a48ca675f97`, including verification of both
  immutable package revisions, locks and managed-file hashes.
- Vallm 0.1.94 passed all three managed Python files with zero deterministic
  findings, covering the same payload that protected Koru previously rejected.
- The reusable governance workflow and its `standard-ref` input both select
  exact v0.13.1 release SHA
  `7979cfe76797a4da6925be49496ff2462e78b3f7`; workflow YAML validation and
  exact-base governance pass after the alignment.
- `make verify` passed 401 tests with one controlled JDK-unavailable skip;
  environment, module, generated-analysis, schema and workflow checks passed.
- `make docker-smoke` built the runtime image and passed.
- Ticket-048's stale active header now agrees with its already merged PR #66,
  and its missing release note is recorded in the newly owned changelog.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participants: [ai-grok.md](ai-grok.md),
  [ai-codex.md](ai-codex.md)

## Non-goals

- No ad-hoc one-off edit of `.env.example` to land an unrelated feature.
- No weakening of `verify:env` fail-closed behavior.
- No standalone edit of hash-locked managed governance files; the reviewed
  target-manifest update and lock regeneration form one Goal adoption change.
- No moving tag or branch-based standard adoption.
- No increase of todo2code's general implementation-file limit merely to fit
  one standard adoption.

## Related

- Parent plan: [ticket-049](../ticket-049/AUTONOMY_AND_REFACTOR_PLAN.md) §3 phase C1
- Prior incident: ticket-047 / #64 unownable-path rejection; ticket-048 cause fix for env fallbacks only
