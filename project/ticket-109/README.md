# Ticket 109: Validate each intent graph once per object (#135)

- **ID**: ticket-109
- **Owner**: agent:claude
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-10-19

## Goal and scope

Closes autogrammar/todo2code#135. `assertIntentGraph` re-validated the same graph
object ~9 times per pipeline and recomputed its canonical-JSON fingerprint each
time (18 calls / 98 s and 20 fingerprints / 74 s of a 290 s `compare-workspace`
on subactor/platform). A `WeakMap` memo now skips a repeat full validation when
the same object still has the same fingerprint string and the same `records` /
`relations` array identities and lengths; failures are never cached.

Implementation drafted by Willman (koru.develop_ticket, glm-5.3) from an exact
spec; reviewed without changes.

## Acceptance criteria

- [x] AC-02: compare-workspace on subactor/platform, 3 interleaved pairs: CPU median
  360.7 s -> 255.3 s (pairs 1.24-1.41x), outputs identical. Evidence
  `evidence/validate-once-ab.json`, validated `performance-plan.json`.
- [x] AC-01: Repeated assertions on one unchanged graph validate once; clones,
  replaced relation arrays and changed fingerprints are revalidated
  (`node --test dist/test/schema-validate-once.test.js`: 4 pass; schema suites 10 pass).

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
