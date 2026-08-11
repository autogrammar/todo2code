# Ticket 071: Import f2md DocumentAST into canonical Intent DSL

- **ID**: ticket-071
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
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
- [ ] AC-02: A valid sibling f2md structure sidecar is recognized only when its
      schema and canonical Markdown body hash match the input document.
- [ ] AC-03: Semantic content blocks become deterministic canonical
      `t2c.intent/v1` records; navigation and `semantic: false` blocks do not.
- [ ] AC-04: Each imported record retains available page, bbox, block,
      artifact and source-revision evidence in `metadata.documentAnchor`.
- [ ] AC-05: A missing sidecar preserves existing behavior; an invalid or
      mismatched sidecar produces an explicit warning and cannot contribute
      records.
- [ ] AC-06: Focused tests prove deterministic identity, exact provenance,
      navigation exclusion and mismatch handling; full Node, governance and
      Docker checks pass.

## Participants

- Human participant: unresolved; the active conversation contains the scope
  approval. No `user-*` file was created or edited.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization and blocker

The user's `kontynuuj` authorizes this previously reviewed migration scope but
does not authorize a governance exception. Ticket-060 remains
`IN_PROGRESS / VALIDATION` in the `extractors` workstream and owns
`test/docs.test.ts`. This ticket therefore stays non-active until ticket-060
releases the workstream or the human explicitly authorizes `--force-new` after
reviewing this collision. No implementation source may be edited while this
ticket is blocked.
