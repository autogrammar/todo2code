---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-009
---
# Participant: codex (AI agent)

## Understanding

The provider schema, TypeScript assumptions and runtime checks currently form
separate contracts. Their drift can either crash late or silently reinterpret
the provider response. One structural definition must govern both sides.

## Execution plan

1. Measure every production structured-response boundary and its current drift.
2. Add a small dependency-free canonical schema/parser builder.
3. Migrate all production OpenRouter response contracts.
4. Preserve grounding and semantic invariants as explicit second-stage checks.
5. Run all deterministic gates, document the result and publish `main`.

## Blockers

- None for the approved scope.

## Actual changes

- Added the dependency-free `StructuredSchema<T>` builder and typed error with
  rejected-response metadata.
- Migrated all seven production OpenRouter response boundaries.
- Removed task/NL coercion of invalid provider enums, percentages and keys.
- Added drift gates for production calls and the published document schema.
- Updated the DSL, readiness, validation, test report, status and backlog.
