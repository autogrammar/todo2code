# Ticket 096: Compile accepted delivery plans into bounded implementation slices

- **ID**: ticket-096
- **Owner**: agent:codex under SESSION_EXECUTION_AUTHORIZATION
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-01

## Goal and scope

Materially implement GitHub issue #115. The runtime consumes an accepted,
closed `wellmanifest.delivery-plan/v1` value plus source-NL and accepted-DSL
hashes, then deterministically compiles it into inert, dependency-aware
`t2c.implementation-slice-candidate/v1` proposals.

Already bounded source slices pass through unchanged. An oversized source
slice is compiled only from an explicit advisory decomposition whose child
paths are an exact, disjoint partition of the parent paths, whose acceptance
and test bindings cover the parent contract, and whose children independently
fit the Wellmanifest XS/S delivery budget. Missing or invalid decomposition
fails closed; the compiler never invents work, widens paths, creates an issue,
or dispatches a tool.

The compiler validates the Strategy DSL boundary: closed fields, accepted
status, plan/source hash bindings, acyclic dependencies, exact workstream path
ownership, integration-owned paths, HOME/SHAPE/ADOPT placement and globally
disjoint candidate paths. It emits stable candidate digests and dedupe keys.

## Acceptance criteria

- [x] AC-01: The originating user request and GitHub issue #115 authorize this
      exact bounded runtime implementation before source edits.
- [x] AC-02: The request preserves and verifies source-NL and normalized
      accepted-DSL SHA-256 hashes without carrying raw NL into candidates.
- [x] AC-03: Closed Strategy/Wellmanifest delivery-plan validation rejects
      unknown fields, stale hashes, invalid HOME/SHAPE/ADOPT, ambiguous path
      ownership, integration-owner violations, cycles and path overlap.
- [x] AC-04: Oversized source slices require an explicit advisory
      decomposition into bounded children with an exact disjoint path
      partition and complete acceptance/test coverage.
- [x] AC-05: Candidate dependencies remain acyclic after replacement of a
      source slice by child roots/leaves, and output ordering, digests and
      dedupe keys are deterministic.
- [x] AC-06: Output is inert and carries no issue mutation, tool execution,
      shell, grant, credential or LLM authority surface.
- [x] AC-07: Focused tests, full host verification, governance, Docker and
      diff validation pass before protected publication.

## Delivery boundary

- Workstream: `runtime`.
- Accepted base: `main@f51f20ab1669c98fadd470c54fdf86513fb48b18`.
- Complexity: `S`; four implementation files, two components, no dependency.
- Material paths: `src/operations/delivery-plan-slice-types.ts`,
  `src/operations/delivery-plan-slices.ts`,
  `src/operations/delivery-plan-slices.schema.json`, and
  `test/operation-delivery-plan-slices.test.ts`.
- No CLI/MCP/A2A/SDK/package export, GitHub mutation, LLM call, raw NL
  persistence, repository scan, branch/worktree allocation, or tool dispatch.

## Validation evidence

- Focused compiler suite: 11 passed, 0 failed.
- Full host verification: 445 tests, 444 passed, 1 explicit missing-JDK skip,
  0 failed; type, module, environment, workflow, schema and structured-response
  gates passed.
- `project/governance-check.sh`: `GOV-PASS`, 0 errors and 0 warnings.
- Lizard across the material TypeScript/test paths: 0 threshold warnings
  at CCN 15, length 100 and five parameters.
- JSON Schema 2020-12 metaschema validation and `git diff --check`: pass.
- Required Docker smoke: pass, including production image build and health
  validation.
- The additional `make e2e-core` experiment passed its complete 445-test
  image suite (438 pass, 7 toolchain skips), then reproduced an unrelated
  `gold-v2` documentation recall failure already present on pristine
  `origin/main@f51f20a` (0 false positives, two missing documentation records).
  The exact baseline comparison proves this ticket did not introduce it.

## Participants

- Human participant: authorization is captured by the originating request and
  GitHub issue #115; no user-* file was created.
- Agent participant: [ai-codex.md](ai-codex.md)
