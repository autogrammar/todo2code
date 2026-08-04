# Ticket 036: Canonical multi-source truth map DSL

- **ID**: ticket-036
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-04

## Goal and scope

Add a deterministic projection over the existing canonical `t2c.graph/v1`
model so that records extracted from natural language, tickets, documentation,
Git, source code, tests and configuration can be navigated as one map without
losing their original provenance.

This ticket does **not** introduce another extraction DSL and does not declare
one source to be universally more truthful than another. The graph remains the
canonical evidence store. The new `t2c.truth-map/v1` view groups mapped records,
separates declared intent, observed facts and unverified claims, and exposes
conflicts instead of silently choosing a winner.

The first delivery is deliberately limited to the reusable core contract and
its deterministic tests. Writing the projection as a pipeline artifact,
exposing it through CLI/MCP/A2A and documenting the user workflow require
follow-up tickets in the `runtime`, `interfaces` and `integration` workstreams;
this core ticket cannot take ownership of those paths.

The immediate operational use case is analysis of many Git branches before PR
merge decisions. The coordinated todo2code/Koru/Goal/Validator design, exact
base/head freshness rules and rollout are specified in
[`BRANCH_INTELLIGENCE.md`](BRANCH_INTELLIGENCE.md). That blueprint is planning
evidence only; this ticket still owns only the two core truth-map files.

The concrete failure-explanation contract and pre-push workflow are documented
separately in
[`GOVERNANCE_DIAGNOSTICS.md`](GOVERNANCE_DIAGNOSTICS.md). It records why local,
push, PR and mergeability checks currently disagree, which structured evidence
is hidden by the text renderer, and how existing ecosystem projects can share
one `t2c.branch/v1` artifact instead of duplicating policy logic.

## Proposed data flow

```text
NL / tickets / docs / Git / AST / tests / config
                       |
              source-specific extractors
                       |
              t2c.intent/v1 records
                       |
                 t2c.graph/v1
            (canonical evidence store)
                       |
          deterministic truth-map projector
                       |
               t2c.truth-map/v1
       +---------------+----------------+
       |               |                |
 declared intent   observed facts   claims/inferences
       +---------------+----------------+
                       |
          supported / gap / conflict status
          plus record -> assertion reverse map
```

## Resolution semantics

- Source coordinates, line ranges, revisions, content hashes and generator
  provenance remain attached through cited `IntentRecord` IDs.
- Only explicit graph mappings form one assertion component. Dependency and
  generic `related_to` edges do not collapse unrelated assertions.
- A declaration or plan supported by a fact is `supported`.
- Intent without factual evidence is `declared_only`; facts without declared
  intent are `observed_only`; claims alone are `claimed_only`.
- Explicit contradiction always produces `conflicted`. The projector never
  uses confidence, an LLM verdict or source order to hide that conflict.
- Every input record maps to exactly one assertion, including isolated
  records. A reverse index makes the projection machine-navigable.
- IDs, ordering and fingerprints are derived from canonical JSON and are
  invariant to input ordering and wall-clock time.

## Delivery boundary

- Workstream: `core-dsl`.
- Complexity: `S`; at most two implementation files and one component.
- No public interface, runtime dependency, schema-file, pipeline, CLI, MCP,
  A2A, SDK or generated-document change.
- Expected implementation paths: `src/core/truth-map.ts` and
  `test/graph-truth-map.test.ts`.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: A typed `t2c.truth-map/v1` projection accepts a validated
      `t2c.graph/v1` graph and binds its output to the graph fingerprint.
- [x] AC-03: Every graph record appears in exactly one assertion and in the
      reverse `recordToAssertion` map; no record or relation is fabricated.
- [x] AC-04: Each assertion separates declaration/plan records, factual
      observations and claim/inference records while retaining source IDs and
      all graph relation IDs used for mapping.
- [x] AC-05: Status is deterministic and limited to `supported`,
      `declared_only`, `observed_only`, `claimed_only`, `mixed` or
      `conflicted`; explicit contradictions fail visibly as `conflicted`.
- [x] AC-06: Generic `related_to`, `depends_on` and `blocks` relations cannot
      collapse otherwise independent assertions.
- [x] AC-07: Stable IDs, sorted arrays and the content fingerprint are
      invariant to input record/relation order and to `generatedAt`.
- [x] AC-08: Invalid graphs, dangling relation endpoints and duplicate reverse
      mappings fail closed with deterministic errors.
- [x] AC-09: Focused unit tests, TypeScript compilation, the full offline
      verification suite, governance and Docker core E2E pass without an LLM,
      network access or new dependency.
- [x] AC-10: Follow-up boundaries for pipeline materialization and interface
      exposure are recorded; this ticket does not smuggle cross-workstream
      changes into the core contract.
- [x] AC-11: The dependent Branch Intelligence blueprint binds decisions to
      exact base/head/merge-base SHAs and a portfolio fingerprint, separates
      repository responsibilities and forbids automatic branch mutation.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The user approved continuation after reviewing the truth-map, Branch
Intelligence and live-audit plans by instructing the agent to continue, test
and repair the ecosystem integrations. The bounded core implementation and
local validation completed, but the first hosted review found one complexity
violation in the new validator. The responsibilities were split into bounded
helpers, local Lizard reported zero threshold violations, Koru and Validator
approved exact head `65b4bc1`, and PR #35 merged as `main@15d2b26`.

## Verification evidence

- Focused truth-map suite: 8 passed, 0 failed.
- Full offline verification: 349 passed, 1 environment-dependent skip, 0
  failed.
- Docker core E2E: 343 passed, 7 toolchain-dependent skips, both gold datasets
  at 100% precision and recall, CLI/MCP/A2A/examples smoke checks passed.
- Governance: `GOV-PASS` with 0 errors and 0 warnings.
- No OpenRouter call, new runtime dependency or cross-workstream source change
  was introduced by this ticket.
