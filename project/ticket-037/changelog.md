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
- Required explicit pair-level semantic completeness and relation-backed
  ordering citations; preserved base semantic findings in the projection and
  bounded candidate, assertion, citation and PR collections.
- Added fourteen focused regression cases; full host verification, Lizard,
  governance and Docker core E2E pass without an LLM or network dependency.
- Recorded the exact compiled focused-test command and its 14/14 pass result so
  exact-head review does not have to infer feature coverage from the aggregate
  `verify` check name.
- Replaced four TypeScript non-null assertions in the focused suite with
  explicit runtime guards; full typecheck and regression verification pass.

## [0.3.0] - 2026-08-04

- Recorded exact-head Koru and Validator App evidence for `50d6dba`; the
  Validator used `openrouter/z-ai/glm-5.2` and returned no advisory findings.
- Recorded protected CI completion and PR #42 merge as `main@b5d2417`.
- Closed ticket-037 without absorbing the separate runtime, interface, Goal,
  Koru or Validator integration workstreams.
