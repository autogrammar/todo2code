---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-083
---
# Participant: codex (AI agent)

## Understanding

`compareWorkspaceIntent` correctly scopes its result directory, but passes the
unchanged ambient `T2CConfig` to both pipelines. AST and documentation caches
read `config.outputDir`, so an external `--out` can still create `.intent/cache`
inside the analysed checkout. Existing output can also be reported as dirty
input. The comparison then observes artifacts produced by the observer.

## Execution plan

1. Add a regression with an external output directory and enabled cache.
2. Bind each pipeline config's output directory to its actual pipeline output.
3. Exclude only the selected generated directory from the pre-run Git snapshot;
   retain every unrelated dirty file.
4. Run focused, full, governance and Docker verification.

## Actual changes

- Read governance and current implementation, reproduced the defect on clean
  Registry and Core worktrees, and recorded explicit approval before edits.
- Bound both pipeline configurations to their actual output directories and
  excluded the selected in-repository evidence path from the status snapshot.
- Added regression coverage and passed focused, full Node and Docker checks.
- Transitioned to `IN_PROGRESS / PUBLICATION`; no merge is claimed locally.

## Blockers

- None for implementation; protected publication remains independent.
