# Ticket Changelog (ticket-071)

## [0.1.0] - 2026-08-11

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Recovered the bounded DocumentAST migration plan after checkout
  consolidation and reissued it under the collision-free ticket-071 ID.
- Recorded the user's scope approval, the active ticket-060 workstream
  reservation and the separate `test/docs-f2md.test.ts` ownership boundary.
- Remained in `WAIT_FOR_DEPENDENCIES`; no implementation source was changed.
- Recorded the user's explicit `--force-new` authorization despite active
  ticket-060 and transitioned ticket-071 to `IN_PROGRESS / EDIT`.
- Added deterministic f2md sidecar discovery with strict schema, block and
  canonical Markdown hash validation; invalid evidence now emits an explicit
  warning and contributes no records.
- Imported semantic, non-navigation DocumentAST blocks as canonical
  `t2c.intent/v1` records through `buildRecord`, preserving source revision,
  page, bbox, block and ArtifactStore evidence in a bounded document anchor.
- Kept the existing documentation extractor behavior unchanged when the
  sidecar is absent and added three focused regression cases in the ticket's
  separately owned test file.
- Passed 8 focused documentation tests, full host verification (408 total, 0
  failures, 1 explicit JDK skip), a 2-document/863-record real-corpus audit,
  complexity thresholds, governance and Docker smoke.
- Transitioned to `IN_PROGRESS / PUBLICATION`; protected exact-HEAD review and
  merge remain outside repository-authored evidence.
