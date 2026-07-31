# Preprompt and technical directives (ticket-002)

- **Task title**: Cross-repository semantic hardening
- **Created**: 2026-07-31T06:49:07Z
- **Governance source**: `wellmanifest/new-project`

## Requirements and constraints

1. Test todo2code on real external repositories through deterministic,
   reproducible runs.
2. Capture a comparable baseline before changing semantic behavior.
3. Classify observed failures and select one shared, measurable defect.
4. Add an independent regression case before implementing its fix.
5. Apply one semantic change at a time and repeat gold plus corpus measurements.
6. Reject an attempted improvement when it increases noise or lacks measurable
   external benefit.
7. Preserve external repositories, secrets, untracked files and current user
   changes.
8. Keep raw command output in the provider-specific ticket log.

## Referenced specifications

- `docs/READINESS.md`
- `docs/TEST_REPORT.md`
- `evaluation/gold/README.md`
- `evaluation/gold/v2/dataset.json`
- `TODO.md`
- Governance policy: `wellmanifest/new-project/POLICY.md`
- Governance procedure: `wellmanifest/new-project/CONTRIBUTING.md`

## Execution boundary

The planning state is `WAIT_FOR_APPROVAL`. Under `P-CORE-008`, no source-code
change or external benchmark execution begins until the user approves
`ai-codex.md` and the project-level ticket entry in `TODO.md`.
