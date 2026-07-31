# Iteration 01: non-actionable changelog mechanics

## Decision

Keep the change. It removes release-note bookkeeping from implementation-gap
diagnostics without treating an unsupported release claim as implemented.

The new classifier ignores only:

- explicit placeholder entries;
- compact `... and N more files` continuation rows;
- entries whose every target is a known generated analysis artifact under the
  reserved `project/` directory.

Ordinary documentation updates, source updates, mixed target lists, unknown
files under `project/`, and behavioral release statements remain actionable.

## Controlled evaluation

The candidate was applied to a clean runtime based on the same
`5f5ae5938ab77dcce474ba7abbd23686072776ec` commit as the baseline. No other
working-tree source changes were included. The external input policy and all
seven detached commits remained unchanged.

| Repository | Graph | CHANGELOG before → after | Review before → after | UNLINKED before → after |
| --- | --- | ---: | ---: | ---: |
| semcod/code2llm | unchanged | 1,411 → 955 | 1,411 → 955 | 1,332 → 1,313 |
| semcod/domd | unchanged | 105 → 99 | 105 → 99 | 779 → 773 |
| semcod/pactfix | unchanged | 48 → 48 | 48 → 48 | 217 → 217 |
| semcod/code2logic | unchanged | 121 → 120 | 121 → 120 | 1,504 → 1,503 |
| semcod/code2docs | unchanged | 396 → 269 | 396 → 269 | 463 → 455 |
| semcod/redup | unchanged | 703 → 269 | 703 → 269 | 708 → 703 |
| subactor/platform | unchanged | 93 → 93 | 93 → 93 | 780 → 780 |

Across the corpus, `CHANGELOG_WITHOUT_IMPLEMENTATION` fell by 1,024
(2,877 → 1,853) and the related unlinked warning fell by 39. The two
repositories dominated by substantive sampled claims (`pactfix` and
`subactor/platform`) did not change. All graph fingerprints were identical.

## Regression gates

- The focused test was observed failing before the implementation and passing
  afterwards.
- The nearby hard negatives preserve diagnostics for Jenkinsfile support,
  `docs/api.md`, and an unknown `project/custom-runtime.ts` source.
- Gold v2 remains 100% precision and recall in every measured scope, with zero
  forbidden diagnostic violations and stable repeated runs.

Machine-readable deltas and exact after-run IDs are in
[`iteration-01.json`](iteration-01.json).
