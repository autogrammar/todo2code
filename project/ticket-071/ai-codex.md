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

1. Add strict sidecar discovery, schema/hash validation and semantic-block
   conversion inside the existing deterministic documentation extractor.
2. Emit only through `buildRecord`, with deterministic provenance and bounded
   `metadata.documentAnchor`.
3. Add focused coverage in the separate `test/docs-f2md.test.ts` file for
   valid, nonsemantic/navigation and mismatched sidecars.
4. Run focused tests, full Node verification, governance and Docker checks.

## Actual changes

- Reissued the stale pre-consolidation plan as ticket-071 on current
  `origin/main`.
- Moved its focused tests to `test/docs-f2md.test.ts` so ticket-060 retains
  exclusive ownership of `test/docs.test.ts`.
- Recorded the user's explicit `--force-new` authorization and entered `EDIT`.
- Added strict discovery and validation for sibling
  `bioxfoundry.document-structure/v1` sidecars, including canonical Markdown
  hash binding and fail-closed warnings for malformed evidence.
- Converted semantic, non-navigation DocumentAST blocks only through the
  canonical `buildRecord` boundary and retained source, page, bbox, block and
  ArtifactStore evidence in `metadata.documentAnchor`.
- Preserved the existing Markdown baseline when no sidecar exists and added a
  separate three-case f2md regression suite.
- Verified both real f2md documents: 863 semantic blocks became 863 unique,
  anchored canonical records with no warnings.
- Passed focused, full host, complexity, governance and Docker gates and moved
  to `PUBLICATION` pending protected GitHub review.

## Blockers

- Protected exact-HEAD GitHub review and merge are still required before the
  ticket can become `DONE`. Ticket-060 remains active in the same workstream,
  but the human explicitly authorized this non-overlapping parallel ticket.
