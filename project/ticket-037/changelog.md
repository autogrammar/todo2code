# Ticket Changelog (ticket-037)

## [0.1.0] - 2026-08-04

- Created the bounded plan for a deterministic `t2c.branch/v1` core contract.
- Separated immutable evidence classification from Git materialization,
  interfaces and all branch mutations.
- No implementation file was changed.

## [0.2.0] - 2026-08-04

- Recorded explicit human approval of the bounded branch comparison contract.
- Entered `IN_PROGRESS / EDIT` from the merged plan base on `main` without
  widening the approved paths, dependencies or architecture.
- Aligned the test filename with the existing `core-dsl` ownership pattern
  after the active governance gate rejected the original `test/branch-*` path.
- Added the dependency-free `t2c.branch/v1` projector and strict evidence/output
  validation over exact repository, base, head, tree and merge-base bindings.
- Added deterministic classifications for disjoint, overlap, duplicate,
  ordered, textual conflict, semantic conflict and unknown branch pairs, with
  conservative per-candidate recommendations and no mutation surface.
- Added nine focused regression cases; full host verification, Lizard,
  governance and Docker core E2E pass without an LLM or network dependency.
