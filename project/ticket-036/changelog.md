# Ticket Changelog (ticket-036)

## [0.1.0] - 2026-08-04

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Defined the proposed canonical graph-to-truth-map architecture, deterministic
  resolution semantics, bounded implementation paths and validation evidence.
- Added the coordinated Branch Intelligence blueprint for todo2code, Goal,
  Koru and validator-agent with one DSL profile, URI processes, CQRS/ES,
  exact-snapshot validation, diagrams and staged delivery boundaries.
- Added a governance diagnostic UX contract grounded in observed local/push/PR
  divergence, including deterministic evidence fields, pre-push reporting and
  roles for Giton and wellmanifest without expanding ticket 036 implementation.
- Validated the design read-only against the current wellmanifest/new-project
  branch portfolio, corrected PR cardinality to `pullRequests[]`, recorded
  exact Git/todo2code evidence and documented current implementation gaps.
- Audited Goal 2.1.284 source and `goal -a --dry-run`; documented that it cannot
  yet consume todo2code branch evidence and specified a fail-closed preflight
  adapter which disables automatic rebase retry for approved branch plans.
- Recorded human continuation approval, refreshed the accepted base to current
  protected main and transitioned the bounded core implementation to EDIT.
- Added the dependency-free `t2c.truth-map/v1` projector with complete
  provenance, evidence lanes, explicit conflicts, deterministic IDs and an
  exact reverse record index.
- Added eight focused contract tests, including malformed graph, structural
  relation, contradiction, mixed evidence, reverse-index, ordering and
  tampered-projection cases.
- Hardened validation so omitted mapping relations, split mapped endpoints and
  artificially joined disconnected records fail closed; retained Git
  `commitIndex` alongside revision and generator provenance.
- Replaced the unavailable `tsx` validation command with the repository's
  compiled Node test flow.
- Passed TypeScript checks, 349 host tests plus one toolchain skip, governance
  with zero findings, and Docker core E2E with 343 passes and seven toolchain
  skips.
- Refactored the validator after hosted Koru found `CC=21`; the final exact
  head has zero Lizard threshold violations and preserves all fail-closed
  tests.
- Exact-head Koru review and Validator App approval used
  `openrouter/z-ai/glm-5.2`; PR #35 merged as `main@15d2b26`.
