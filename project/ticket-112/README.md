# Ticket 112: Cache base pipeline result by base tree and t2c version in compare-workspace (#136)

- **ID**: ticket-112
- **Owner**: antigravity
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-10-28

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested autonomous completion of remaining backlog tasks (`kontynuuj, testuj, scalaj, wykonuj zalegle`) for `autogrammar/todo2code#136`.
Add a content-addressed base-run cache in `compareWorkspaceIntent` keyed by `sha256(baseTreeId + t2cVersion + canonical effective config + extractor versions)` under `<output>/cache/base/<key>/`, verify stored graph fingerprints so corrupt or partial cache entries are recomputed, skip the detached base worktree and base pipeline on cache hits, and hard-link run graphs and diagnostics into `comparisons/<id>/` instead of re-serialising them.

## Acceptance criteria

- [x] AC-01: A cache hit skips the base worktree and base pipeline and yields a byte-identical `comparison.json` payload to a cold run, with `base.graph.json` and `workspace.graph.json` hard-linked rather than re-serialised.
- [x] AC-02: The cache key changes when the base tree, `todo2code` version, effective configuration, or extractor versions change.
- [x] AC-03: Corrupt or partial cache entries (including a tampered graph fingerprint or missing `diagnostics.json`) are detected and recomputed.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
