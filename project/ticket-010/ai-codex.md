---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-010
---
# Participant: codex (AI agent)

## Understanding

AST parsing and Markdown chunking are deterministic but repeated for every run.
Their cache keys must bind every input that can change output, while cached data
must be treated as disposable acceleration rather than evidence.

## Execution plan

1. Map AST adapters, document chunking and output-directory boundaries.
2. Add a shared versioned cache with atomic writes and fail-open recovery.
3. Cache TypeScript per file, external adapters per source manifest and chunks
   per document.
4. Prove cold/warm equivalence, invalidation, corruption recovery and provider
   isolation.
5. Benchmark tracked snapshots, update repository evidence and publish `main`.

## Blockers

- Live provider calls are outside this ticket; documentation-cache tests use a
  local structured-response stub and explicitly verify calls are not cached.

## Actual changes

- Added the dependency-free `ContentCache` under `src/core/`.
- Added cache telemetry to AST and documentation extraction results.
- Added per-file TypeScript and Markdown keys plus per-manifest external AST
  keys.
- Added cold/warm, invalidation, corruption, bypass and external-toolchain tests.
