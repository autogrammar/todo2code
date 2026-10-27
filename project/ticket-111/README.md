# Ticket 111: Compare capability-scoped intent and implementation across repository evidence bundles (#141)

- **ID**: ticket-111
- **Owner**: agent:antigravity
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-10-27

## Goal and scope

Closes autogrammar/todo2code#141 (`PLF-20325` / `PLF-20321`). Extend existing `t2c.reality/v1` and `t2c.truth-map/v1` contracts to compare capability-scoped intent and implementation across distinct repository evidence bundles (`compareCapabilityEvidenceBundles` in `src/diff/capability-comparison.ts`, re-exported from `src/diff/reality.ts`), reusing `IntentGraph` records, `TruthMap` assertions, `IntentRealityView` rows, and `intract.scan/v1` artifacts (`autogrammar/intract#10`, merged in `autogrammar/intract` PR #11 at `1b2706a010072d33f9a90c50f37390f8930b1cae`).

## Acceptance criteria

- [x] AC-01: Extend existing `t2c.reality/v1` and `t2c.truth-map/v1` contracts; reuse records and citations rather than adding a second intent parser.
- [x] AC-02: Represent comparable capability pairs across distinct repository identities with explicit contract mappings, provenance, and evidence grades while preserving `declared`, `observed`, `configuration-only`, and `unknown` states.
- [x] AC-03: Cover negative fixtures: same word but different behavior, different effects/platforms, missing extraction, stale hash, intentionally divergent requirement, and code present without runtime verification.
- [x] AC-04: Emit typed gap candidates and a hash-bound review proposal (`t2c.capability-review-proposal/v1`) with no direct source mutation, ticket creation, or semantic equivalence claim from similarity alone.

## Authorization

SESSION_EXECUTION_AUTHORIZATION: the owner requested autonomous execution, testing, and resolution of blocking backlog tasks (`PLF-20321` / `PLF-20325`). This authorizes implementation and invoking the declared protected delivery route; it is not trusted merge approval.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
