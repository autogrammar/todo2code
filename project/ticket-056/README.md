# Ticket 056: Repair Docker E2E tool and Rust dependency contract

- **ID**: ticket-056
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-08

## Goal and scope

Restore both required Docker E2E profiles without changing application code:

- install `make` in the shared `e2e-base`, because the host verification suite
  now contains workflow tests that spawn `make` and `e2e-core` currently fails
  with `ENOENT`;
- remove the contradictory `--locked` flag from the image-time Rust fetch,
  because `todo2code` publishes a Rust library and deliberately ignores
  `Cargo.lock`. The disposable E2E image may resolve the library dependency
  graph from `sdk/rust/Cargo.toml` before testing it.

The repair is limited to `Dockerfile.e2e`. It does not add a committed Rust
lockfile, change dependency manifests, application source, runtime images or
OpenRouter behavior.

## Acceptance criteria

- [x] AC-01: `e2e-core` includes `make` and completes without `spawn make
  ENOENT`.
- [x] AC-02: `e2e-full` resolves the intentionally unlocked Rust library and
  completes without a missing-lockfile error.
- [x] AC-03: `make docker-smoke`, `make e2e-core`, `make e2e-full`, host
  verification and governance checks pass.
- [x] AC-04: No dependency manifest, lockfile, runtime source or public
  interface changes.
- [x] AC-05: A human approved this bounded integration repair before editing
  `Dockerfile.e2e`.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval gate

The human owner explicitly approved ticket-056 in the active conversation on
2026-08-08. This Markdown note records the transition to `EDIT`; it is not
trusted merge authorization.

## Validation result

Host verification, Docker smoke, core E2E and full E2E all pass. The
implementation changes only `Dockerfile.e2e`; publication still requires the
protected exact-HEAD review, attestation and ruleset boundary.
