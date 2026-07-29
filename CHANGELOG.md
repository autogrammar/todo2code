# Changelog

## [Unreleased]

### Added

- Authenticated `GET /api/runs` history endpoint for complete graph runs under `.intent/runs`.
- Optional `compact: true` graph-diff response containing fingerprints, summary counts and SVG without complete record and relation arrays.

### Changed

- The history UI uses compact graph diffs, reducing the measured response for the two repository runs from 38.71 MiB to 13.71 KiB.

### Fixed

- The SVG diff UI now selects the previous and latest run by default, displays both history selectors and computes their comparison automatically.

### Documentation

- Documented the direct-to-`main` GitHub workflow and the repository-wide prohibition on pull requests.

## [0.2.0] - 2026-07-29

### Added

- Canonical `t2c.diff/v1` graph comparison with CLI, MCP, A2A and REST access.
- Dependency-free SVG diff frontend and TypeScript/JavaScript plus Python SDKs.
- Automatic OpenRouter model discovery after an invalid model ID.
- Bounded concurrent documentation extraction and indexed graph diagnostics.
- Myers file/Git diff with SVG, HTML and unified renderers plus an intent-vs-reality view.
- Structured-output fallback now skips timeouts and transport/server failures instead of doubling their latency.
- LLM summaries prioritize documentation and declared evidence before applying the AST payload budget.
- Summary payloads cap AST-heavy evidence, relations and diagnostics while retaining the highest-severity findings.
- Generated JSON artifacts up to 128 MiB can be reopened by CLI/API workflows.
- A2A SDKs for TypeScript, Python, Go, Rust and PHP with Intent DSL types and per-language runnable examples.
- Example backend and frontend repositories used as DSL runtime inputs.
- Measured performance analysis in `docs/OPTIMIZATION.md`.
- 43 automated tests covering protocols, SDKs, security and diff/reality renderers.

### Changed

- Linker precomputes keyword sets per record and reuses the similarity score in relation typing; graph construction dropped from 3480 ms to 1717 ms on a 2561-record run with a byte-identical fingerprint.
- Intent-vs-reality topics are keyed by record target instead of relation components, which stops `shared_path` links from collapsing a repository into a single row.
- Two AST facts are no longer linked on a shared file path alone; such a pair now needs a shared symbol or keyword. On a 2561-record run this removed 96% of `related_to` noise (95 549 relations down to 26 099, `intent.graph.json` from 21.4 MiB to 7.7 MiB) while preserving every `implements`, `evidenced_by`, `same_as`, `duplicates` and `releases` relation and leaving the diagnostic report identical.
- Candidate pairs are carried as tuples instead of `"left|right"` keys, and the keyword index is reused for bucketing. Combined with the earlier scoring changes, graph construction dropped from 3480 ms to 641 ms.

### Fixed

- Docker build context now includes the shared TypeScript SDK source required by the main package export.

## [0.1.0] - 2026-07-29

### Added

- Initial todo2code runtime.
- Canonical t2c Intent Evidence DSL.
- Deterministic NL, Git, TypeScript/Python AST, TODO and CHANGELOG extractors.
- OpenRouter-based documentation extractor and grounded team summarizer.
- Intent graph linker and diagnostics.
- Dual-era MCP stdio server and strict A2A v1.0 server.
- MCP 2026-07-28 stateless discovery/results with legacy initialize compatibility.
- A2A v1-only version negotiation, filtering/pagination, idempotency, task ownership and optional Bearer authentication.
- Docker, Compose, Makefile, 15 automated tests and example repository.
