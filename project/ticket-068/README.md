# Ticket 068: Default CLI semantic pipelines to LLM-first

- **ID**: ticket-068
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-08-11

## Goal and scope

Make the standard CLI `pipeline` and `watch` entrypoints LLM-first by selecting
audited `require-llm` task synthesis when `--task-mode` is omitted. A caller
that explicitly selects the established fully offline profile (deterministic
NL and Markdown plus disabled documentation and summary LLM) retains disabled
task synthesis for compatibility. NL,
TODO/CHANGELOG and communication already default to `require-llm`, while
documentation and summary are already enabled unless explicitly disabled.

Retain `--task-mode disabled` for explicit offline/regression use and
`prefer-llm` for a visible deterministic fallback. Do not weaken structured
response validation, provenance, deterministic evidence or authority gates.

## Acceptance criteria

- [x] AC-01: The human explicitly requires todo2code to use LLM wherever it can
  improve the result.
- [x] AC-02: CLI `pipeline` and `watch` default omitted `--task-mode` to
  `require-llm`, except for the complete explicit offline profile.
- [x] AC-03: Explicit `disabled`, `prefer-llm` and `require-llm` values remain
  accepted and invalid values still fail.
- [x] AC-04: A provider-free CLI regression reaches task synthesis and fails
  closed with audited `LLM_NOT_CONFIGURED`; it does not silently skip the
  default LLM stage.
- [x] AC-05: Existing offline watch coverage explicitly opts out and continues
  to pass without reading a provider credential; the Python offline bridge
  remains compatible without an SDK change.
- [x] AC-06: Focused, full, governance and Docker validation pass.

## Validation evidence

- Red regression: old omitted mode succeeded without task LLM and failed the
  new assertion.
- Focused green: CLI default, offline watch and Python offline bridge, 3/3.
- Full host verification: 406 tests; 405 passed, one controlled local JDK skip,
  zero failures.
- Governance: PASS, 0 errors and 0 warnings.
- Docker smoke and diff check: PASS.
- Live default-profile attempt: run `20260811T165612Z-b5f51126` selected
  `require-llm` for NL, Markdown, communication and task synthesis with
  documentation and summary LLM enabled. The provider reported its weekly
  limit exhausted during NL extraction, so the audited run failed closed with
  `LLM_UNAVAILABLE`; no deterministic retry or repository output followed.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization

The user's instruction to enforce LLM usage authorizes this bounded default
change and transition to `EDIT`. It is not trusted publication or merge
approval.

## Non-goals

- No removal of explicit deterministic/offline controls.
- No change to programmatic service defaults owned by the runtime workstream.
- No change to linker interpretation or same-source conflict classification.
- No provider/model selection or dependency change.
