# Preprompt and technical directives (ticket-004)

- **Task title**: Language-independent topic matching
- **Created**: 2026-07-31
- **Governance source**: `wellmanifest/new-project`

## Requirements

1. Preserve the precision-first exact-target and three-topic contracts.
2. Measure multilingual behavior independently from same-language linking.
3. Compare strategies before choosing an implementation.
4. Keep the primary offline gates deterministic and provider-independent.
5. Record model/provider identity and scores for any model-derived evidence.
6. Cache expensive projections by content and model identity.
7. Analyze only tracked snapshots of external repositories.
8. Reject an approach that improves headline coverage by violating hard
   negatives or obscuring evidence origin.

## Referenced evidence

- `docs/READINESS.md`
- `evaluation/gold/v2/dataset.json`
- `project/ticket-002/iteration-02.md`
- `project/ticket-003/iteration-01.md`
- `src/core/text.ts`
- `src/graph/linker.ts`
- `src/diff/reality.ts`

## Approval boundary

The user's `kontynuuj` message approves this separately recorded semantic
experiment. It does not approve provider-dependent default behavior, external
deployment, or changes to the governance repository.
