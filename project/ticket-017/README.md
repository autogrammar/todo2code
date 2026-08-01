# Ticket 017: Audit and repair confirmed todo2code errors

- **ID**: ticket-017
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-01

## Goal and scope

Audit the current `todo2code` workspace, reproduce concrete failures and repair
only defects confirmed by tests or deterministic before/after evidence. Preserve
the concurrent baseline and keep implementation outside this ticket.

Initial confirmed candidates are:

- `t2c pipeline --help` executes a pipeline and writes artifacts instead of
  displaying help or returning a non-mutating usage result;
- Polish prohibition wording such as `Agentowi zabrania się ...` can be assigned
  positive polarity by documentation extraction and create a false
  `CONFLICTING_INTENT` against an equivalent TODO prohibition;
- commit `1ebad96` (published concurrently while this plan was being prepared)
  implements shared Markdown path resolution and `create` versus `modify`
  planning; it needs independent validation for correctness, bounds and
  regressions before this ticket relies on it.
- the repository needs reproducible Docker E2E environments: a fast core suite
  and a full language-toolchain suite with stable `T2C-E2E-*` failure codes.

The untracked `nlp2uri.yaml` and all unrelated worktree changes remain outside
this ticket unless a test proves they are required for one of the defects above.

## Acceptance criteria

- [x] AC-01: A human approves this understanding and checklist before source edits.
- [x] AC-02: Concurrent baseline commit `1ebad96` is reviewed and not overwritten
      or attributed to this ticket.
- [x] AC-03: Every repaired failure has a focused regression test and a stable,
      actionable error or diagnostic code/message where applicable.
- [x] AC-04: `pipeline --help` is demonstrably non-mutating.
- [x] AC-05: Equivalent Polish prohibitions no longer create a false
      `CONFLICTING_INTENT`, without weakening genuine conflict detection.
- [x] AC-06: Shared Markdown path resolution and `create`/`modify` plans are
      deterministic, repository-bounded and correct for existing, missing,
      ambiguous and escaping paths.
- [x] AC-07: Full offline verification, gold evaluation and relevant examples
      pass in the project Docker environment.
- [x] AC-08: A deterministic before/after run on the Governance Hub clears the
      identified false conflict and records any remaining diagnostics honestly.
- [x] AC-09: Documentation, changelog and error-code references match the final
      behavior; no auto-apply, commit or push occurs without a separate request.

- [x] AC-10: `make e2e-core` runs the deterministic core E2E gate in an isolated
      Docker image whose workspace agrees with `T2C_ROOT`.
- [x] AC-11: `make e2e-full` adds Go, JDK 17, Rust and PHP, exercises all five SDK
      examples and does not silently skip the required Java adapter test.
- [x] AC-12: E2E failures emit a documented stable code, failing step and
      remediation while preserving the underlying command output.

Both E2E suites passed on 2026-08-01. The full suite ran 318 tests with zero
failures and zero skips, both versioned gold benchmarks, all protocol smoke
checks and all five SDK examples.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Risks

- The branch changed concurrently during planning; validation must pin and report
  the exact reviewed HEAD.
- Generated `dist/` may not match source until an approved build is completed.
- Large-repository path scans can introduce performance or ignore-scope
  regressions if their bounds are not tested.
- A polarity fix that is too broad could hide real contradictions.
