# Current task: audited intent alignment

- Add audited natural-language conversion through `extractNlIntentAudited` in `src/extractors/nl-llm.ts`, with `deterministic`, `prefer-llm` and `require-llm` modes.
- Record `T2C_VERSION`, redacted LLM parameters and per-stage degradation reasons in `t2c.run/v1` manifests produced by `runPipeline`.
- Compare `origin/main` with committed and uncommitted filesystem intent through `compareWorkspaceIntent`, CLI `compare-workspace`, MCP/A2A `compare_workspace` and all five SDKs.
- Generate `t2c.diff/v1`, SVG and Intent-vs-Reality coverage trends without modifying the user's working tree.
- Permit one explicitly named historical `.intent/runs/<id>/team-summary.md` as documentation while preventing recursive `.intent/**/*.md` ingestion.
- Verify the TypeScript runtime, module boundaries and TypeScript, Python, Go, Rust and PHP examples.

## Acceptance evidence

- `npm run verify` passes, including NL LLM success/fallback/required-mode tests and a real Git origin-to-dirty-workspace integration test.
- `make validate` passes for build, smoke, MCP, A2A and doctor.
- A live NL request records the actual model and `degraded:false`; documentation timeout is represented as a warning/partial or failed stage, never as silent success.
- `TODO.md`, `CHANGELOG.md`, README and protocol/architecture/DSL/validation documentation reflect the verified state and remaining limitations.
