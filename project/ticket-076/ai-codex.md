---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-076
---
# Participant: codex (AI agent)

## Understanding

Todo2code already contains the three underlying deterministic boundaries and
exports their modules from the package root. The missing part is a uniform,
discoverable product-level facade: AST takes an options object, configuration
takes a positional root, and documentation requires callers to resolve files
themselves. None of those names expresses that its result is a valid but
source-limited Intent DSL document.

The smallest compatible change is to add one named facade in each owning
extractor module. Each facade delegates to the mature extractor, validates the
complete returned record array with the existing strict runtime validator and
preserves warnings and cache evidence. This avoids duplicating parsing or
creating dependencies between the three adapters.

The Wellmanifest review sharpens that boundary. `ExtractionResult` is an
adapter envelope, while each `records` element is the canonical
`t2c.intent/v1` JSON document. SSOT requires delegation plus parity rather than
copied converters; Modularity requires acyclic adapter dependencies and one
contract owner; DSL and POA require descriptive output with no authority or
execution effect. Env DSL is currently uncommitted and blocked, so only its
safe data/no-evaluation direction is applicable. Exact evidence and adoption
limits are in [STANDARDS.md](STANDARDS.md).

## Execution plan after approval

1. Add `code2dsl({ root }, config)` beside the AST coordinator.
2. Add `docs2dsl({ root, files?, patterns?, excludes? }, config)`, resolving
   patterns only when explicit files are absent.
3. Add `config2dsl({ root }, config)` beside the configuration extractor.
4. Require explicit `T2CConfig` at every facade so deterministic extraction
   never imports or reads ambient provider/secret environment configuration;
   fail closed when the root or emitted DSL is invalid.
5. Add one public-root regression test proving independent invocation, strict
   record validation, source-channel isolation, facade/canonical parity and
   preservation of warnings/cache evidence.
6. Prove that actual `.env` secret material remains outside configuration DSL
   extraction and that no adapter imports another.
7. Run the focused test, `npm run verify` (including module boundaries),
   `./project/governance-check.sh` and `make docker-smoke`.

## Actual changes

- Inspected the current exports, extractor signatures, pipeline orchestration,
  schema validator and workstream ownership.
- Inspected the requested Wellmanifest standards, their exact local revisions,
  effect/ownership rules and current publication maturity; recorded conflicts
  that prevent a fabricated all-standards lock.
- Created and completed this planning ticket on a dedicated branch.
- Recorded the human owner's explicit approval on 2026-08-14 and transitioned
  the ticket to `IN_PROGRESS / EDIT` before touching implementation.
- Added all three facade APIs in their owning extractor modules. Each delegates
  to the canonical extractor, requires explicit `T2CConfig` and validates the
  emitted `t2c.intent/v1` records before returning the unchanged envelope.
- Added public-root regression coverage for canonical parity, source isolation,
  docs discovery, invalid/foreign inputs and `.env` non-disclosure.
- Passed focused tests and full `npm run verify`, including the transitive
  no-LLM and module-boundary gates; passed governance, Docker smoke and diff
  checks. The existing JDK-only Java test remained skipped on this host.
- Transitioned to `IN_PROGRESS / PUBLICATION`; protected exact-head review and
  merge are intentionally not claimed by this ticket-local validation.

## Risks

- Ambient environment defaults could make a convenience API surprising; the
  explicit root remains authoritative and callers may pass a complete config.
- Documentation pattern resolution must stay bounded by the existing glob and
  ignore behavior.
- An additive root export is still a contract and must be regression-tested
  even though no package manifest change is necessary.
- A local development checkout is not a normative dependency. Formal DSL or
  Modularity adoption needs a later integration ticket and immutable pins.
- The first optional-config implementation failed `verify:no-llm` because its
  runtime `getConfig` import reached `OPENROUTER_API_KEY`. The corrected public
  contract requires explicit config and restores the deterministic boundary.

## Blockers

- None for the bounded todo2code implementation. Cross-repository standards
  reconciliation remains separately governed by each owning repository.
