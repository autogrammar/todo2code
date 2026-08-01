# Ticket preprompt

- **Task ID**: ticket-017
- **Task title**: Audit and repair confirmed todo2code errors
- **Created**: 2026-08-01T09:15:46Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

## Technical directives

- Treat concurrent commit `1ebad96` and any later branch movement as external
  input; review HEAD and diffs again immediately before edits.
- Do not touch `user-*`, `nlp2uri.yaml` or unrelated source changes.
- After approval, run the repository analysis automation against the workspace
  without applying `prefact` and read its generated reports.
- Reproduce each defect before changing source and add the smallest focused test.
- Preserve deterministic/offline operation and the canonical `DiagnosticCode`
  contract; new operational errors must have stable codes and actionable text.
- Use the project Docker environment for authoritative verification.
- Re-run the Governance Hub analysis outside its worktree so validation does not
  create artifacts in the read-only policy repository.
- Keep production `Dockerfile`/A2A Compose behavior unchanged; put test-only
  toolchains and commands in dedicated E2E files.
- Bake the source into E2E images instead of bind-mounting mutable host state.
- Set both `WORKDIR` and `T2C_ROOT` to `/workspace` so SDK/A2A relative roots are
  resolved consistently.
