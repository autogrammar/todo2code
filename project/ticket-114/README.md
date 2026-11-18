# Ticket 114: Raise VERSION to the released 0.5.2

- **ID**: ticket-114
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-11-18

## Goal and scope

Fixes autogrammar/todo2code#145. `VERSION` still says 0.5.1, while `package.json`,
`pyproject.toml` and the published tag `v0.5.2` say 0.5.2. The new-project 0.20.162 gate reports
GOV-VERSION-001 and blocks the fleet standard adoption. Raise `VERSION` to the released 0.5.2. Root cause: `VERSION` had no owning workstream, so the
v0.5.2 release ticket (integration) could not touch it; this ticket assigns it to `integration`.

## Acceptance criteria

- [ ] AC-01: `VERSION`, `package.json` and `pyproject.toml` agree on 0.5.2.
- [ ] AC-02: `project/governance-check.sh` passes.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
