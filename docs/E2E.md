# Docker E2E environments

The E2E images are isolated from the production A2A image. They bake a source
snapshot into `/workspace`, set `T2C_ROOT=/workspace` and create a synthetic Git
history of ten commits inside the container. No mutable host workspace or
private `.env` is mounted. Runtime networking is disabled; loopback remains
available for the local MCP/A2A and backend/frontend integration checks. Rust
dependencies are prefetched while the full image is built.

## Suites

```bash
make e2e-core
make e2e-full
make e2e-clean
```

`e2e-core` contains Node.js 22, Git and Python. It validates the deterministic
core while optional language adapters may report their explicit skips.

`e2e-full` additionally copies Go 1.23 and Rust 1.85 toolchains and installs JDK
17, PHP and the native linker required by Cargo. It sets
`T2C_REQUIRE_JAVA_TEST=1`, rejects any skipped test and
requires examples from all five SDK languages to produce the same graph and
patch fingerprints.

Both suites run TypeScript checks, module/environment/workflow/schema gates,
all Node tests, gold v2 and v1, deterministic CLI/MCP/A2A smoke tests and the
complete examples check. OpenRouter is disabled, so these suites are offline
with respect to model providers.

## Stable failure codes

| Code | Meaning | Repair route |
|---|---|---|
| `T2C-E2E-000` | All selected E2E gates passed | None |
| `T2C-E2E-001` | Unknown suite | Use `core` or `full` |
| `T2C-E2E-002` | `T2C_ROOT` does not exist | Use the baked `/workspace` root |
| `T2C-E2E-003` | Workspace cannot be entered | Check root ownership and value |
| `T2C-E2E-010` | Required command is absent | Use the correct image target |
| `T2C-E2E-101` | Verification failed | Repair the first contract/test failure |
| `T2C-E2E-102` | Full suite skipped a test | Add or repair the missing toolchain |
| `T2C-E2E-103` | Gold v2 failed | Inspect the reported v2 fixture |
| `T2C-E2E-104` | Gold v1 failed | Restore backward compatibility |
| `T2C-E2E-105` | CLI smoke failed | Inspect the first failed pipeline stage |
| `T2C-E2E-106` | MCP smoke failed | Inspect framing and server stderr |
| `T2C-E2E-107` | A2A smoke failed | Inspect health and task lifecycle |
| `T2C-E2E-108` | Examples failed | Inspect demo, HTTP and SDK logs |
| `T2C-E2E-109` | Fewer than five SDKs ran | Verify full-image toolchains |

The stable code is printed after the underlying command output, so automation
can route a repair without hiding the original failure.
