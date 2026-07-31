# External corpus baseline

Runtime: todo2code 0.5.0 at
`5f5ae5938ab77dcce474ba7abbd23686072776ec`.

Each source was checked out as a detached, tracked-only worktree at the commit
recorded below. Runs were offline and deterministic: tracked `TASK.md`,
`TODO.md` and `CHANGELOG.md` were selected when present, documents were limited
to `README.md` and `docs/**/*.md`, communication and task synthesis were
disabled, and neither extraction nor summary used an LLM.

| Repository | Commit | Time | Records | Relations | Topics aligned/all | Impl. | Plan | Docs | Diagnostics (I/W/R/B) | Warnings |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| semcod/code2llm | `b297d60` | 18 s | 16,899 | 41,747 | 107/628 | 59.4% | 43.7% | 31.4% | 912/2,377/1,411/0 | 9 |
| semcod/domd | `b6c5ad2` | 5 s | 10,611 | 7,470 | 9/241 | 11.8% | 5.4% | 5.4% | 616/1,388/105/0 | 0 |
| semcod/pactfix | `daf301a` | 5 s | 5,161 | 3,917 | 2/153 | 5.0% | 1.8% | 1.8% | 197/419/48/0 | 5 |
| semcod/code2logic | `ba93489` | 12 s | 21,423 | 16,927 | 27/359 | 17.7% | 14.1% | 14.1% | 1,474/3,081/121/4 | 3 |
| semcod/code2docs | `c738aff` | 9 s | 6,717 | 35,447 | 57/265 | 47.1% | 77.0% | 47.3% | 283/876/396/0 | 0 |
| semcod/redup | `a175fb0` | 6 s | 7,204 | 19,173 | 62/277 | 49.2% | 55.9% | 10.8% | 476/1,205/703/0 | 0 |
| subactor/platform | `3e96573` | 6 s | 10,628 | 11,002 | 25/688 | 5.9% | 9.3% | 8.9% | 185/993/93/0 | 1 |

`I/W/R/B` means `info/warning/review_required/blocking`. Full commit hashes,
graph fingerprints and diagnostic distributions are in
[`baseline.json`](baseline.json).

## Warnings and explicit exceptions

- `code2llm`, `pactfix` and `code2logic` contain deliberately invalid parser
  fixtures and/or unsupported PHP, Ruby or C# inputs.
- Java extraction could not run for repositories containing Java because the
  clean runtime had no JDK. This is an explicit local exception; Java remains a
  required CI job.
- `subactor/platform` has one configuration file above the shared 524,288-byte
  limit.
- No repository-specific semantic options or thresholds were introduced.

## Repeated defect selected for the first iteration

`CHANGELOG_WITHOUT_IMPLEMENTATION` occurs in all seven repositories (2,877
findings in total). Sampling separates two classes:

- substantive claims such as adding Jenkinsfile support or structured HR
  intent; these must remain reviewable when no implementation evidence exists;
- release-note mechanics such as `Update project/calls.mmd`, placeholder
  sections and summaries like `... and 12 more files`; these are not behavioral
  claims and currently inflate both `CHANGELOG_WITHOUT_IMPLEMENTATION` and
  `UNLINKED_RECORD`.

Broadly linking changelog prose to module topics would manufacture evidence for
the first class. The controlled change will instead classify only proven
non-actionable release-note mechanics and leave substantive claims unchanged.
