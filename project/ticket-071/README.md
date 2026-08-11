# Ticket 071: Import f2md DocumentAST into canonical Intent DSL

- **ID**: ticket-071
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-11

## Goal and scope

Add the first bounded migration slice from bioxfoundry's shadow
`t2c.intent/v1` shape to todo2code's canonical Intent Evidence DSL. The
deterministic documentation extractor will recognize an adjacent f2md
`bioxfoundry.document-structure/v1` sidecar and materialize its semantic blocks
as canonical records through todo2code's existing `buildRecord` boundary.

The imported records must retain exact document evidence in a JSON-valued
`metadata.documentAnchor`: source/content revision, page, bounding box, block
ID and ArtifactStore identifiers when present. This preserves PDF provenance
without changing the public `t2c.intent/v1` schema or teaching todo2code how to
extract binary documents.

This ticket does not modify `src/core/types.ts`, schemas, CLI/interfaces,
pipeline orchestration, LLM code, f2md, twin-dsl or generated corpus data. Those
are later migration slices after this producer boundary is proven.

## Acceptance criteria

- [x] AC-01: The human owner approved continuing this exact bounded migration
      scope in the active conversation on 2026-08-11.
- [x] AC-02: A valid sibling f2md structure sidecar is recognized only when its
      schema and canonical Markdown body hash match the input document.
- [x] AC-03: Semantic content blocks become deterministic canonical
      `t2c.intent/v1` records; navigation and `semantic: false` blocks do not.
- [x] AC-04: Each imported record retains available page, bbox, block,
      artifact and source-revision evidence in `metadata.documentAnchor`.
- [x] AC-05: A missing sidecar preserves existing behavior; an invalid or
      mismatched sidecar produces an explicit warning and cannot contribute
      records.
- [x] AC-06: Focused tests prove deterministic identity, exact provenance,
      navigation exclusion and mismatch handling; full Node, governance and
      Docker checks pass.

## Participants

- Human participant: unresolved; the active conversation contains the scope
  approval. No `user-*` file was created or edited.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization and blocker

The user's `kontynuuj` authorized this previously reviewed migration scope.
After reviewing the collision, the user explicitly wrote `autoryzuję
--force-new dla ticket-071 mimo aktywnego ticket-060` on 2026-08-11. This
authorizes ticket-071 to enter `EDIT` while ticket-060 remains
`IN_PROGRESS / VALIDATION` in the same workstream. Ticket-060 retains exclusive
ownership of `test/docs.test.ts`; ticket-071 uses the non-overlapping
`test/docs-f2md.test.ts` path.

## Validation

- Focused documentation tests: 8 passed, 0 failed.
- Full `npm run verify`: 408 tests, 407 passed, 0 failed, 1 explicit JDK skip.
- Real f2md corpus: 2 documents, 863 semantic blocks, 863 canonical records,
  0 warnings, 0 duplicate IDs and 0 records without document anchors.
- Lizard thresholds: 0 violations in the modified extractor.
- Docker smoke: passed; the image built and its health/doctor checks succeeded.
- Governance: passed with 0 errors and 0 warnings.

The implementation remains `IN_PROGRESS / PUBLICATION` until protected GitHub
review and merge bind the final branch HEAD to trusted approval evidence.
