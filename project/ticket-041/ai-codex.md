---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-041
---
# Participant: codex (AI agent)

## Understanding

Ticket-037 can classify a fully formed evidence object, while ticket-039 pins
local refs to exact commits and trees. The remaining gap is a deterministic
adapter that proves these two inputs describe the same immutable trees and
derives conservative semantic deltas before invoking the projector.

The assembler cannot prove that a missing analysis exists by hashing a
placeholder. Every unique tree therefore needs a real validated graph and
truth map. Explicit `unknown` describes incomplete semantic comparability, not
a fabricated artifact. Exact-tree checkout/scanning belongs to the next
runtime orchestration slice.

## Risks and controls

- **Tampered Git object**: expose and call a strict materialization validator
  that recomputes the ticket-039 fingerprint.
- **Tree/artifact substitution**: require an exact set of tree-keyed bundles
  and validate every graph/truth-map pair.
- **False cross-tree identity**: anchor modified/removed records to cited base
  assertions; do not infer equivalence from branch names or display text.
- **False semantic clean result**: ambiguous identities, missing coverage or
  unanchored cross-branch additions become `unknown`.
- **Quadratic work**: cap inputs through the existing 32-candidate snapshot and
  reuse one semantic bundle per unique tree.
- **Architecture drift**: call the existing graph diff, truth-map validators
  and branch projector; do not duplicate a public DSL.

## Execution plan

1. Obtain approval of README and `intent.json` without touching source/tests.
2. Enter `IN_PROGRESS / EDIT` on the accepted exact base.
3. Add strict validation for the existing Git materialization value.
4. Implement tree-bundle validation and graph/truth assertion-change mapping.
5. Derive conservative candidate/pair evidence and call
   `projectBranchPortfolio`.
6. Test shared trees, all change kinds, conflicts, unknown completeness,
   tampering, determinism and absence of effects in offline fixtures.
7. Run focused tests, full verification, governance, Lizard and Docker E2E.
8. Publish for exact-head Koru and Validator App review using
   `openrouter/z-ai/glm-5.2`.

## Actual changes

- The user approved the unchanged assembler contract for autonomous execution
  on the refreshed governance-only base. Implementation may begin inside the
  three declared paths.

## Blockers

- None before bounded implementation. Protected exact-head review remains a
  publication requirement.
