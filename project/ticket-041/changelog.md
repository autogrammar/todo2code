# Ticket Changelog (ticket-041)

## [0.1.0] - 2026-08-05

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Defined a bounded adapter from validated Git/tree semantic evidence to the
  existing `t2c.branch/v1` projector.
- Kept exact-tree analysis, persistence, interfaces and ecosystem adapters out
  of scope; no implementation file changed before approval.
- Reallocated the unchanged plan from the concurrently occupied `ticket-040`
  to the first free `ticket-041` on governance-only `main@db368c0`.
- Recorded the user's pre-implementation approval and entered
  `IN_PROGRESS / EDIT` before adding source or test changes.
- Added strict fail-closed validation of ticket-039 Git materializations,
  including exact keys, sorted coverage and recomputed fingerprint.
- Added the pure exact-tree semantic assembler over existing graph diff,
  truth-map and `t2c.branch/v1` contracts without a new public schema.
- Preserved record/relation/assertion citations and separated textual conflict
  from semantic conflict, ambiguity and incomplete evidence.
- Added seven focused regression cases. Full host verification passed 375 with
  one skip; Docker passed 369 with seven explicit toolchain skips; governance,
  complexity, MCP/A2A and example gates passed.

## [0.2.0] - 2026-08-05

- Rebuilt the branch into the required plan → approval → implementation →
  validation order after the parallel ticket-ID collision.
- Passed Koru and deterministic Validator App review for exact head `3779613`;
  Validator used `openrouter/z-ai/glm-5.2`.
- Verified that the advisory type findings did not reproduce: the asserted
  object guard and required completeness union are explicit in source.
- Re-ran a timing-only `cli-watch` failure without changing code; both the
  independent same-SHA run and the retry passed.
- Passed review-triggered governance, full verification, Docker smoke and Java
  gates, then merged protected PR #48 as `main@f188025`.
