# Agent plan — ticket-077

Agent: devin (GLM-5.2 High)
Date: 2026-08-14

## Analysis

`todo2code` already has a working Intent Evidence DSL (`t2c.intent/v1`) with:
- 20 JSON Schema contracts in `schemas/`
- Documentation in `docs/DSL.md`
- 17 actions in the `statement.action` enum
- LLM boundary (bidirectional: requests + responses)
- `propose-only` model authority (runtime owns execution)

The `wellmanifest/dsl` standard requires a `dsl-manifest.json` that binds
these artifacts with SHA-256 digests, declares ownership, vocabulary,
finding policy, and publication tier.

## Plan

1. Compute SHA-256 for `schemas/intent-record.schema.json`,
   `schemas/intent-graph.schema.json`, and `docs/DSL.md`.
2. Create `dsl-manifest.json` at repo root with:
   - `id`: `autogrammar.todo2code.intent`
   - `version`: `1.0.0`
   - `canonical`: `json-ast`
   - `effectModel`: `propose-only`
   - `llm.mode`: `bidirectional`
   - `documentation.commands`: 17 actions from the schema enum
   - `findingPolicy`: `autogrammar.todo2code.governance-check`
   - `publicationPolicy.declaredTier`: `review`
3. Run `python3 src/dsl_check.py validate dsl-manifest.json` from
   `wellmanifest/dsl` against the new manifest.
4. Run `governance-check.sh` in todo2code.

## Scope boundaries

- Only `dsl-manifest.json` is created (root, governance workstream).
- `docs/<COMMAND>.md` pages deferred to integration workstream ticket.
- `docs/ERROR/` and `docs/CRITICAL/` deferred.
- No changes to `schemas/` or `src/`.
