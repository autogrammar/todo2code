# Ticket 010 audit

## Cache contract

| Property | Decision |
|---|---|
| Location | `<outputDir>/cache/v1/<namespace>/<sha256>.json` |
| Key | stable hash of namespace and output-relevant inputs |
| TypeScript | source path + content hash + extractor identity |
| External AST | ordered path/content manifest + executable + byte limit |
| Documentation | source path + content hash + chunk size + algorithm identity |
| Provider output | deliberately not cached |
| Corruption/I/O | recompute; cache errors do not fail extraction |
| Writes | same-directory temporary file followed by atomic rename |
| Warning results | external adapter warnings are not cached |

## Tracked-snapshot benchmark

Single local run on 2026-07-31; times are directional wall-clock measurements,
not a stable performance gate. External AST adapters were disabled to isolate
the per-file TypeScript/JavaScript cache. Documentation measured the production
chunk algorithm and cache contract without making provider requests.

| Repository | Workload | Cold | Warm | Warm hits | Output |
|---|---:|---:|---:|---:|---|
| semcod/todo2code | 15,062 AST records | 1398.4 ms | 442.1 ms | 169/169 | identical |
| subactor-improvement | 751 AST records | 49.2 ms | 16.8 ms | 11/11 | identical |
| wellmanifest/new-project | 26 Markdown files / 28 chunks | 10.1 ms | 7.2 ms | 26/26 | identical chunk count |
| semcod/todo2code | 111 Markdown files / 161 chunks | 76.0 ms | 45.1 ms | 111/111 | identical chunk count |
| subactor-improvement | 2 Markdown files / 2 chunks | 1.9 ms | 1.3 ms | 2/2 | identical chunk count |

The new-project result also shows the limit of this optimization: a small,
documentation-only repository gains little absolute time. The cache matters
most for repositories with many AST inputs or repeated documentation analysis.

## Verification

| Gate | Result |
|---|---|
| Exact `f1d9334` snapshot | `npm run verify`: 261 tests, 260 pass, 1 JDK skip |
| Module boundary | 99 modules, 462 imports, 0 cycles |
| Cache tests | 5/5: cold/warm, invalidation, corruption, bypass, external adapter and provider isolation |
| Gold v2 / v1 | 100% required gates / PASS |
| Examples | 5 SDK, PASS |
| Integrated local `main` | 270 tests, 269 pass, 1 JDK skip; includes the adjacent scheduled-live-check commit |
| Publication | implementation `f1d9334` on `main` |
