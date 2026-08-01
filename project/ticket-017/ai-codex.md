---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-017
---
# Participant: codex (AI agent)

## Understanding

The user wants confirmed defects in `todo2code` repaired, not a speculative
rewrite. Path-resolution and code-change planning work that was initially
uncommitted was published concurrently as commit `1ebad96`; the first
responsibility is to review and validate that new baseline rather than duplicate
or overwrite it. Three concrete defect candidates already have command or graph
evidence: mutating `pipeline --help`, false Polish prohibition polarity, and
potentially incomplete path/action planning behavior.

Success means reproducible failing cases become passing regression tests while
the existing diagnostic schema stays stable and actionable. Pipeline success
must not be confused with zero blocking diagnostics.

## Execution plan

1. Wait for explicit human approval of this ticket and the root checklist.
2. Run `project.sh` in safe workspace-analysis mode and inspect generated reports.
3. Reproduce the three candidate defects with isolated fixtures and capture the
   baseline results.
4. Review commit `1ebad96` and any subsequent branch movement, separating usable
   baseline behavior from defects without reverting unrelated work.
5. Implement minimal fixes and focused tests for confirmed failures only.
6. Audit the canonical diagnostic/error-code surface and make new failures
   machine-actionable without changing established codes unnecessarily.
7. Run focused tests, full offline verification, gold datasets and examples in
   Docker.
8. Re-run deterministic validation on the Governance Hub and compare diagnostics.
9. Add isolated core/full Docker E2E images, Compose services, stable error codes
   and operator documentation; validate both environments.
10. Update owned ticket evidence, TODO, docs and changelog with exact results.

## Actual changes

- Added the required missing governance bootstrap scripts copied verbatim from
  the Governance Hub.
- Reviewed and preserved concurrent baseline `1ebad96`.
- Made command-local help non-mutating before configuration and dispatch.
- Extended deterministic Polish prohibition detection to active `zabrania`
  forms and covered both the text helper and documentation extraction.
- Bounded the shared Markdown path resolver against absolute and parent escapes,
  including heading-derived scopes.
- Verified focused tests, the full offline suite, gold v2/v1 and examples on the
  host and in the project Docker image.
- Compared identical tracked Governance Hub snapshots before and after the fix:
  false `CONFLICTING_INTENT` 1 -> 0; total diagnostics remained 183 because the
  corrected requirement is now honestly reported as planned but unimplemented.
- Refreshed the generated analysis from the current tracked-file overlay without
  consuming unrelated untracked `nlp2uri.yaml`.
- Added and validated isolated Docker E2E `core` and full-toolchain suites with
  stable `T2C-E2E-*` failure codes. The full image includes the native linker
  needed by Cargo and finished with 318/318 tests, zero skips and five SDK
  examples.

## Blockers

- None. All ticket acceptance criteria are complete.

## Concurrent baseline boundary

The following paths were modified before ticket-017 and published concurrently
as commit `1ebad96`; they are baseline work, not changes made by this ticket:

- `src/extractors/changelog.ts`
- `src/extractors/markdown.ts`
- `src/extractors/todo.ts`
- `src/pipeline/run.ts`
- `src/services/actions.ts`
- `src/synthesis/code-change-plan.ts`
- `test/code-change-plan.test.ts`
- `test/markdown.test.ts`
- `src/extractors/markdown-paths.ts`

The untracked `nlp2uri.yaml` remains unrelated and must not be edited.
