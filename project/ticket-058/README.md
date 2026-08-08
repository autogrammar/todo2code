# Ticket 058: Synchronize todo2code release and runtime version identity

- **ID**: ticket-058
- **Owner**: unresolved:human
- **Status**: BLOCKED
- **Workflow state**: WAIT_FOR_DEPENDENCIES
- **Created**: 2026-08-08

## Goal and scope

Restore one auditable todo2code release identity across the root release
metadata, SDK manifests, CLI output and every generated DSL provenance
envelope. Add a dependency-free integration gate that fails closed when a
future release updates only part of that identity.

This ticket is the integration coordinator. Paths owned by `core-dsl`,
`extractors`, `runtime` and `sdk` must be corrected through separate governed
tickets that point back to ticket-058; this ticket does not transfer their
ownership. A governance routing ticket protects the currently unowned Python
bridge test instead of assigning it ad hoc.

## Verified regression

At `main@738d7be93168fe73cccf14d3d589e545919c9a6f`:

```text
package.json                    0.5.1
VERSION                         0.5.1
pyproject.toml                  0.5.1
Python/Rust/TypeScript SDKs     0.5.1
src/core/version.ts             0.5.0
t2c --version                   todo2code 0.5.0
doDSL DevelopmentEvidenceDSL    producerVersion 0.5.0
```

Commit `99286994cc604e80b401fc16f4230e33e90df253` raised the release and
SDK metadata to `0.5.1` without changing the runtime constant. Several tests
then encoded `0.5.0` directly, so the normal suite preserved rather than
detected the drift.

## Proposed delivery

1. Add an integration-owned, dependency-free version-contract verifier and
   focused tests under `scripts/`, then make it part of `npm run verify`.
2. Through a `core-dsl` ticket, align `T2C_VERSION` with the accepted release
   identity.
3. Through `extractors` and `runtime` tickets, replace current-version literals
   with the exported runtime identity where they assert current behavior.
   Historical fixtures remain pinned when their old version is evidence.
4. Route the unowned Python SDK bridge test through protected governance
   evolution, then update it in a separate `sdk` ticket.
5. Re-run the complete host, governance and Docker validation.
6. Rebuild the pinned todo2code runtime used by doDSL and prove that a new
   DevelopmentEvidenceDSL bundle reports `producerVersion "0.5.1"` while
   retaining its exact Git commit/tree and no authority or mutation effect.

Ticket creation with `--force-new` was explicitly authorized by the human on
2026-08-08. That authorization permits this concurrent planning ticket; it is
not approval to edit implementation paths or weaken the active ticket limits.

## Acceptance criteria

- [x] AC-01: A human approves this scope and the multi-workstream split.
- [ ] AC-02: Root release metadata, SDK manifests, `T2C_VERSION`, CLI output
      and newly generated provenance all report the same accepted version.
- [ ] AC-03: A dependency-free verifier emits a stable diagnostic and non-zero
      status for every supported version-identity mismatch.
- [ ] AC-04: Tests asserting the current runtime use the canonical exported
      identity; deliberately historical fixtures remain visibly pinned.
- [ ] AC-04a: The Python SDK bridge test receives deterministic ownership
      through protected governance before it is edited.
- [ ] AC-05: `npm run verify`, governance, Docker smoke and both Docker E2E
      profiles pass without skipped checks being counted as passes.
- [ ] AC-06: A fresh doDSL compile records todo2code `0.5.1`, an exact source
      revision/tree and `AUTHORITY_EFFECT none` / `MUTATION_EFFECT none`.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md).

## Approval gate

The human approved this plan and creation of the owner-workstream tickets on
2026-08-08. This ticket is now `BLOCKED / WAIT_FOR_DEPENDENCIES`: ticket-054
still reserves `integration`, so the verifier and root verify-hook cannot enter
`EDIT`. Distinct child workstreams may proceed only through their own approved
tickets. Conversation approval is an audit note, not trusted merge authority.

Prepared owner tickets:

```text
ticket-059  core-dsl   runtime constant
ticket-060  extractors documentation assertion
ticket-061  runtime    pipeline/code-change assertions
ticket-062  governance protected Python-test ownership route
ticket-063  sdk        Python bridge assertion (depends on 062)
```

## Non-goals

- No new release number, Git tag or package publication.
- No dependency, secret, AQL, Docker runtime or model configuration change.
- No reinterpretation of historical `0.5.0` fixtures as current evidence.
- No command execution or mutation authority derived from LLM output.
- No direct edit of paths owned by another workstream under ticket-058.
