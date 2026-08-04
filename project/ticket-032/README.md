# Ticket 032: Harden scoped intent comparison quality

- **ID**: ticket-032
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-04

## Goal and scope

Make `compare-workspace` reliable for a bounded, multi-commit intent audit. A
three-commit Subactor audit proved that the current command extracts every
changed TypeScript and Python declaration, but its trend and diagnostics are
dominated by identity churn and unrelated repository evidence.

This is an integration/coordination ticket because the confirmed defects cross
the `core-dsl`, `extractors` and `interfaces` workstreams. It does not authorize
source edits, change diagnostic policy, introduce LLM inference, modify a target
repository, or automatically apply proposed TODO/source patches.

## Reproduction evidence

Target: `intent-contract-dsl-runtime`, range `HEAD~3..HEAD`.

- TypeScript compiler AST versus todo2code: 113/113 changed declarations.
- Python stdlib AST versus todo2code: 157/157 changed declarations.
- An unchanged TODO statement moved from line 116 to 118 and changed ID from
  `INT-TODO-8dc5…` to `INT-TODO-8cc9…`, despite identical text and content hash.
- `compare-workspace` accepted `--communication-mode` but had no ticket/project
  scope and ingested communication from every ticket.
- Python methods were emitted as `run` instead of `OperationRunner.run`, making
  methods with common names ambiguous even though their parent scope was known.
- The comparison wrote useful artifacts but also printed approximately 13 MiB
  of deeply nested graph diff JSON to stdout.
- The resulting headline claimed regression and added 60 gaps although the
  project test suite passed 200/200 and all example suites passed.
- A live `google/gemini-3.1-pro-preview` run reached OpenRouter with a 2000-token
  limit but returned a record missing required Intent DSL fields. A follow-up
  `z-ai/glm-5.2` check was blocked by the key's weekly credit limit.

## Bounded delivery contract

- Workstream: `integration` coordination only.
- Repository-scoped identity work must land before a core identity slice when
  both need record construction changes.
- Follow-up tickets must be serialized against the active owning workstreams:
  stable identity and workspace comparison in `core-dsl`, TODO/Python extraction
  in `extractors`, and CLI scoping/output in `interfaces`.
- Existing single-run pipeline defaults and legacy record IDs outside an
  explicitly approved identity migration must remain compatible.
- This ticket may update only its governance evidence and indexes.

## Acceptance criteria

- [ ] AC-01: A human approves the coordination scope and trade-offs.
- [ ] AC-02: An approved owning-workstream ticket requires that inserting
      unrelated lines above an unchanged TODO item preserves its record ID while
      retaining updated source line provenance.
- [ ] AC-03: The extractor slice requires duplicate TODO text in one file to
      remain collision-free through an explicit ID or deterministic occurrence
      discriminator.
- [ ] AC-04: The interface/core slices require `compare-workspace` to accept the
      same `--project-dir` and `--communication-ticket` scope as `pipeline`,
      apply it to both sides, and record it in both manifests.
- [ ] AC-05: The extractor slice requires Python class methods to use qualified
      declaration symbols while module-level functions preserve their existing
      symbols.
- [ ] AC-06: The interface slice requires default `compare-workspace` stdout to
      contain only headline metrics and artifact paths; full comparison JSON
      remains available explicitly and on disk.
- [ ] AC-07: LLM adapters reject or heal incomplete structured records and
      provide a bounded-token preflight before a paid request.
- [ ] AC-08: Each follow-up reproduces the Subactor failure modes without
      embedding or modifying the Subactor repository.
- [ ] AC-09: This ticket creates no overlapping implementation scope; each
      approved follow-up passes governance, focused tests and `npm run verify`.

## Approval boundary

The ticket intentionally remains at `WAIT_FOR_APPROVAL`. Approval authorizes
coordination and creation of serialized owning-workstream tickets only. It does
not authorize executable source edits. Publication of this governance-only plan
was explicitly requested by the user on 2026-08-04; implementation and later
source publication still require their own approval.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)
