# Current task: audited Markdown intent and environment contract

- Enrich deterministic TODO/CHANGELOG records through `extractMarkdownIntentAudited` while preserving checkbox, lifecycle, version, date, category, source and epistemic class.
- Support `deterministic`, `prefer-llm` and `require-llm` modes with explicit model, runtime version, fallback reason and stage audit.
- Expose `markdownMode` through CLI, pipeline, MCP/A2A and the TypeScript, Python, Go, Rust and PHP SDKs.
- Ensure every environment variable read by runtime code, Docker/Compose or SDK examples is declared once in `.env.example` and synchronized in the local `.env` without exposing secrets.
- Remove misleading environment aliases and duplicated Docker defaults.

## Acceptance evidence

- `npm run verify` passes, including Markdown LLM success/fallback/required-mode tests and the environment-contract verifier.
- `make validate` passes for build, smoke, MCP, A2A and doctor.
- A live TODO/CHANGELOG request records the actual model and preserves all structural facts with `degraded:false`.
- Docker Compose configuration and all five SDK examples validate without an LLM dependency.
- `TODO.md`, `CHANGELOG.md`, README and protocol/architecture/DSL/validation documentation reflect the verified state.
