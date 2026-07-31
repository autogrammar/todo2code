# Ticket 010: Incremental extraction cache

- **ID**: ticket-010
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Cache deterministic AST extraction and Markdown chunking by source content hash
so repeated analysis of large repositories does not repeat unchanged work.
Provider responses remain live and are never stored by this cache.

Executable implementation belongs under `src/` and tests under `test/`. This
ticket directory contains only governance and evidence.

## Acceptance criteria

- [x] AC-01: TypeScript AST entries are cached per source path and content hash.
- [x] AC-02: External AST adapters are cached per complete language manifest,
  executable selection and file-size limit.
- [x] AC-03: Documentation chunks are cached per path, content hash, chunk size
  and algorithm version without caching LLM responses.
- [x] AC-04: Cache entries have a versioned envelope, validated namespace/key
  and atomic same-directory writes.
- [x] AC-05: Missing, corrupt, invalid and unwritable cache state fails open to
  authoritative extraction; warning-bearing external results are not retained.
- [x] AC-06: Cold/warm output is identical and changing one input invalidates
  only its content-addressed entry.
- [x] AC-07: Cache telemetry is returned outside Intent DSL and does not alter
  graph records or fingerprints.
- [x] AC-08: Measurements cover todo2code and at least two other repositories.
- [x] AC-09: Full repository verification and gold/example gates pass.
- [x] AC-10: Documentation is updated and the completed change is pushed to
  `main` without unrelated worktree changes.

## Participants

- Human scope: current conversation; no agent-authored `user-*` file.
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)

## Result

Deterministic extraction now reuses validated content-addressed entries while
source records remain authoritative. A warm run avoids unchanged TypeScript
parsing and successful external-toolchain startup; Markdown reuse stops before
the provider boundary. The implementation was committed as `f1d9334`.
