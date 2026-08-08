# Ticket preprompt

- **Task ID**: ticket-056
- **Task title**: Repair Docker E2E tool and Rust dependency contract
- **Created**: 2026-08-08T18:08:48Z

Repair the Docker E2E environment in one integration-owned file:

1. make the shared base satisfy the commands invoked by host verification;
2. align Rust fetch behavior with the repository's deliberate library
   lockfile policy;
3. rerun both complete E2E profiles.

Do not generate or commit `sdk/rust/Cargo.lock`, change Cargo/npm manifests,
edit runtime source, or weaken any test. Keep implementation outside this
ticket directory and never create or edit a `user-*.md` file.
