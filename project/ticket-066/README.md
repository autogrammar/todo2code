# Ticket 066: Honor pipeline output directory for content cache

- **ID**: ticket-066
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-11

## Goal and scope

Make every pipeline extractor cache use the invocation's effective
`PipelineOptions.outputDir`. An absolute external `--out` must not leave a
default `.intent/cache` inside the analyzed repository.

## Acceptance criteria

- [ ] AC-01: Pipeline output and content cache share the effective output root.
- [ ] AC-02: An external absolute `--out` creates no `.intent` entry in the
  analyzed repository.
- [ ] AC-03: Existing default-output and cache-hit behavior remains compatible.
- [ ] AC-04: Focused, full, governance, and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization and blocker

The user authorized the audit-driven cleanup with `tak` on 2026-08-11. Active
`ticket-061` owns the same runtime workstream and `test/pipeline.test.ts`, so
this ticket remains blocked until that work is integrated or explicitly
discarded by its owner.
