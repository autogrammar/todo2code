# Live Branch Audit: wellmanifest/new-project (2026-08-04)

## Scope and method

This is read-only planning evidence for the Branch Intelligence design. The
remote refs and PR history came from GitHub. Each exact commit tree was examined
in an isolated detached worktree. No branch, PR, tag or repository file was
mutated.

Checks used:

- exact remote ref resolution;
- `merge-base`, ancestry and left/right commit counts;
- Git cherry-equivalence;
- pairwise `git merge-tree`;
- deterministic offline todo2code pipelines on `main` and the divergent
  feature branch;
- `t2c.diff/v1` graph comparison;
- focused semantic record inspection;
- governance script and validator suites on both trees.

OpenRouter and GitHub write credentials were not used.

## Snapshot

Base:

- `main@13c2f8e21a243fbbd6ea243b173305b0368a9729`

| Branch | Head SHA | Behind / ahead | In `main` ancestry | PR evidence | Prototype disposition |
| --- | --- | ---: | --- | --- | --- |
| `plan/governance-010-sync` | `3eb5a53e541c0ec89685805a5a5aef6ace3e4b2c` | 13 / 0 | yes | current head equals merged PR #3; the same branch name also served PR #1 at another head | `stale` / deletion candidate after explicit confirmation |
| `ticket/003-validator-approval-evidence` | `d082373f314191dba794aba58aca2d4475ea497a` | 31 / 0 | yes | current head equals merged PR #2 | `stale` / deletion candidate after explicit confirmation |
| `feat/bounded-delivery-contract` | `1ae86a15a1348443fe3d270c6f4c6528dc309436` | 34 / 7 | no | no PR found in current repository history | `superseded` plus `manual_review`; do not merge directly |

## Git findings

- The two contained branches have zero commits outside `main` and merge cleanly
  only because they are ancestors. Re-merging them would add no change.
- The feature branch has seven Git-unique commits and changes 18 files relative
  to its merge base.
- Merging it into current `main` produces content conflicts in 12 files:
  `AGENTS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `POLICY.md`, `README.md`,
  `VERSION`, `docs/GOVERNANCE_ENFORCEMENT.md`,
  `governance/manifest.default.json`, `project/new-ticket.sh`,
  `scripts/governance_check.py`, `tests/governance-scripts.test.sh` and
  `tests/governance-validator.test.sh`.
- It also conflicts pairwise with both contained historical branches. That is
  not a reason to merge those branches first; their content is already in
  `main`.

## todo2code findings

Both offline pipelines succeeded with no warnings and no LLM stage:

- main graph fingerprint:
  `2c079f980e9db9e9608fbf7b64451d0026261a9e942914ccb812032fa3e40c03`;
- feature graph fingerprint:
  `75854490c9777e7fcc6c8abf08346bede86de21a0b08beab82abbbae062bf34b`.

The existing graph diff correctly proves that the trees differ, reporting
1,941 records added, 1,009 removed, 61 changed and 56 unchanged when moving
from the feature tree to current `main`. It does not yet convert those counts
into a branch disposition.

Semantic evidence is nevertheless sufficient for a safe prototype decision:

- both trees declare the same 16 bounded-delivery/budget validator functions;
- current `main` explicitly documents that release 0.10 reconciled and retained
  bounded delivery from
  `feat/bounded-delivery-contract@1ae86a1` while replacing its older active
  status behavior;
- current `main` contains later governance, adoption and Validator App work not
  present on the feature branch;
- governance scripts and governance validator suites pass on both trees.

Therefore the feature branch is not a clean missing feature to merge. Its
valuable intent was incorporated and then evolved on `main`; blindly merging
it would reintroduce an older lifecycle contract through a 12-file conflict.
The correct automated recommendation is `superseded`, with a human review
requirement before archival/deletion because Git still reports seven unique
commits.

## Design defects exposed by the audit

1. **PR cardinality**: branch name to PR is one-to-many, not one-to-one. The
   DSL now stores `pullRequests[]` and validates each historical `headSha`.
2. **Age is insufficient**: all refs were updated on the same day, yet two are
   already contained and one is obsolete semantically.
3. **Git uniqueness is insufficient**: seven unique commits do not imply seven
   missing capabilities.
4. **Graph-diff volume is insufficient**: raw added/removed counts cannot choose
   merge/rebase/close without truth-map grouping and explicit supersession.
5. **Base binding is mandatory**: a recommendation must be invalidated whenever
   `main` moves, even when a feature head remains unchanged.
6. **Deletion is a separate command**: `stale` or `superseded` is evidence, not
   authority to delete a ref.

## Test verdict

The architecture can represent and safely classify today's branch portfolio
after the `pullRequests[]` correction. Existing todo2code supplies useful
offline evidence, but the end-to-end feature is **not implemented yet**:

- there is no `t2c.branch/v1` runtime projector;
- there is no automatic exact-ref portfolio scan;
- there is no truth-map supersession classifier;
- Goal/Koru do not yet persist or render the portfolio;
- validator-agent does not yet bind approval to base SHA and portfolio
  fingerprint.

Until those tickets are implemented and tested, the three prototype
dispositions above remain read-only recommendations, not executable merge or
deletion decisions.

## Goal `-a` consumer check

Goal `2.1.284` was checked by source inspection and by a non-mutating
`goal -a --dry-run --no-publish` in a temporary clone with one staged file.

Observed behavior:

- the dry-run produced a normal commit/version preview for the staged file;
- it emitted no remote-branch inventory, PR history, merge-base, todo2code
  graph, semantic conflict or branch disposition;
- Goal contains no runtime reference to `todo2code` or `t2c`;
- current non-interactive push recovery may execute `pull --rebase` after a
  non-fast-forward rejection;
- focused Goal push/dry-run/retry tests passed 41/41.

Verdict: current `goal -a` cannot use this evidence. It needs an explicit
preflight adapter and an approved exact-snapshot plan. When such a plan is
present, any non-fast-forward response must invalidate the plan instead of
triggering the existing automatic rebase retry.
