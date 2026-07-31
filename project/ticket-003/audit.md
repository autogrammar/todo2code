# Residual changelog audit

## Current corpus

The runtime is tracked `18cc21b` plus only the ticket-002 changelog diagnostic
patch. All seven unchanged external commits completed with `succeeded`.

| Repository | Records | Relations | Residual findings | Sample |
| --- | ---: | ---: | ---: | ---: |
| semcod/code2llm | 16,899 | 41,758 | 955 | 24 |
| semcod/domd | 10,611 | 7,484 | 99 | 24 |
| semcod/pactfix | 5,161 | 3,917 | 48 | 24 |
| semcod/code2logic | 21,423 | 16,933 | 120 | 24 |
| semcod/code2docs | 6,717 | 35,468 | 269 | 24 |
| semcod/redup | 7,204 | 19,259 | 269 | 24 |
| subactor/platform | 10,628 | 11,424 | 93 | 24 |

## Sampling policy

The sample is deterministic: records are grouped by
`target-class:action`, sorted by stable record ID inside each group, and
selected round-robin over lexically sorted groups. The limit is 24 per
repository, producing 168 reviewed records.

Every sample row in [`sample.json`](sample.json) preserves repository, record
ID, stratum, text, targets, tracked path owners, source lines, label and
rationale.
[`scripts/research/audit-changelog-sample.mjs`](../../scripts/research/audit-changelog-sample.mjs)
reproduces selection and classification from run artifacts.

## Classification

| Class | Sample | Full deterministic census | Repositories | Decision |
| --- | ---: | ---: | ---: | --- |
| Exact `Update <file>` bookkeeping | 28 | 547 | 5 | selected |
| Opaque `chore: update N files` | 1 | 1 | 1 | reject: insufficient spread |
| Unchecked roadmap item in changelog | 6 | 30 | 2 | defer: extractor lifecycle issue |
| Substantive or still unverified claim | 133 | 1,275 | 7 | retain diagnostic |

Manual review of all 35 sampled non-substantive rows confirmed the labels.
Representative selected examples include:

- `Update README.md`
- `Update scripts/run-testql-environment.sh`
- `Update tests/project/analysis.json`
- `Update uv.lock`
- `update debug/.code2flow_cache/...pkl`

These rows assert only that a file changed. They do not state a behavior that
an implementation-gap diagnostic can ground. By contrast, the following must
remain actionable:

- `Update src/runtime.ts to reject invalid tokens`
- `Updated authentication in src/runtime.ts`
- `Update support for Dockerfile parsing`
- `Added Jenkinsfile support for deployment pipelines`

## Selected correction

Treat only an exact, single-token `Update <file>` entry as non-actionable
release bookkeeping. A token must look like a path, dotfile, filename with an
extension, or a conventional extensionless repository file. Any additional
words keep the claim actionable.

This is a diagnostics signal correction. It does not create evidence, alter the
graph, or broadly link changelog prose to modules.
