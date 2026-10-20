# Ticket 110: Persist and expose base/workspace diagnostics in compare-workspace artifacts (#137)

- **ID**: ticket-110
- **Owner**: agent:claude
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-10-19

## Goal and scope

Closes autogrammar/todo2code#137. `compare-workspace` already reads both runs'
diagnostics; it now writes them as `base.diagnostics.json` and
`workspace.diagnostics.json` next to the graphs and lists them as
`artifacts.baseDiagnostics` / `artifacts.workspaceDiagnostics` (additive).
Consumers such as the subactor/platform intent gate can stop re-compacting and
re-diagnosing two 207 MB graphs (subactor/platform#655).

Implementation drafted by Willman (koru.develop_ticket, glm-5.3) and corrected in
review: the paths go through `artifactPaths` so separators stay normalized.

## Acceptance criteria

- [x] AC-01: Both diagnostics files exist after a comparison and are listed in `artifacts`
  (`node --test dist/test/workspace.test.js dist/test/cli-compare-workspace.test.js`: 6 pass).

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
