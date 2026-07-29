# Changelog

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
