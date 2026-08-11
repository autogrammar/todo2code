---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-071
---
# Participant: codex (AI agent)

## Understanding

Bioxfoundry currently emits a simplified record labelled `t2c.intent/v1`,
while todo2code owns a different canonical record with statement, lifecycle,
epistemic and generation provenance. The formats cannot safely share one
schema identifier. f2md also owns evidence that todo2code does not currently
retain: pages, bounding boxes, semantic block IDs and ArtifactStore URNs.

The first safe step is a bounded producer bridge: todo2code's existing
deterministic documentation path consumes the versioned f2md structure sidecar
and emits its own canonical record, carrying the richer document anchor as
metadata. Existing plain Markdown behavior stays unchanged.

## Execution plan

1. Wait until ticket-060 releases `extractors`, or obtain explicit human
   authorization for the documented `--force-new` exception.
2. Add strict sidecar discovery, schema/hash validation and semantic-block
   conversion inside the existing deterministic documentation extractor.
3. Emit only through `buildRecord`, with deterministic provenance and bounded
   `metadata.documentAnchor`.
4. Add focused coverage in the separate `test/docs-f2md.test.ts` file for
   valid, nonsemantic/navigation and mismatched sidecars.
5. Run focused tests, full Node verification, governance and Docker checks.

## Actual changes

- Reissued the stale pre-consolidation plan as ticket-071 on current
  `origin/main`.
- Moved its focused tests to `test/docs-f2md.test.ts` so ticket-060 retains
  exclusive ownership of `test/docs.test.ts`.
- No implementation source was edited.

## Blockers

- Ticket-060 remains active in the same workstream. The current continuation
  approval does not authorize bypassing `maxActiveTicketsPerWorkstream`.
