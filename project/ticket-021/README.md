# Ticket 021: Govern reproducible project analysis generation

- **ID**: ticket-021
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-04

## Goal and scope

Repair the governance contract that currently leaves root-level generated
analysis artifacts under `project/` without an implementation workstream
owner. This ticket authorizes only the minimum policy change needed before a
separate integration ticket can restore generation safely.

The current managed `project.sh` remains a deterministic governance entry
point. This ticket must not restore host-side `pip install --upgrade`, execute
`prefact`, or embed repository-specific `code2llm` commands in the centrally
managed wrapper. Analysis remains advisory and must run through an explicitly
selected, content-addressed environment.

## Architecture before implementation

- Add only the root-level generated analysis patterns under `project/` to the
  `integration` workstream. Ticket directories remain governance-owned.
- Preserve `project.sh` and the existing digest-pinned analysis boundary.
- Refresh the manifest lock through the supported adoption/lock mechanism;
  never hand-edit a hash to conceal drift.
- Follow with a separate integration ticket for the runner, freshness check
  and regenerated artifacts.
- Complexity: `XS`; maximum two implementation files, one component and
  approximately 20 minutes.

## Acceptance criteria

- [x] AC-01: Scope is approved by a human owner.
- [x] AC-02: Root-level generated analysis formats in `project/` resolve to the
      `integration` workstream without transferring ownership of
      `project/ticket-*/**`.
- [x] AC-03: `project.sh` remains the managed fail-closed governance wrapper;
      no host package upgrade, source refactoring or unpinned analyzer is
      introduced.
- [x] AC-04: The manifest lock records the real manifest content through the
      supported lock/adoption workflow.
- [x] AC-05: `make governance`, manifest validation and a negative ownership
      probe pass deterministically.
- [x] AC-06: The follow-up integration boundary is explicit: generator,
      freshness verification and regenerated artifacts are not mixed into
      this policy ticket.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

The human approved this exact XS plan by replying `kontynuuj` after the approval
request. Current state: `IN_PROGRESS / VALIDATION`. The approved plan exists in
commit `477f64d` before either implementation file changes; focused checks now
pass. Merge evidence remains independently governed.

After `main` advanced through tickets 019/035, the human explicitly continued
against exact replacement base
`9658ebbaac2ebd213d12f42614e054949fa086ab`. The implemented reconciliation
preserves both Python-publication ownership and the generated-analysis patterns.

After `main` subsequently advanced through the protected ticket-039 closure,
the human replied `kontynuuj` again and approved exact replacement base
`9cfc3a8f90a9669ef5b37c44928e0b0e6a191ae5`. The implementation diff and
accepted architecture remain unchanged; only the approval binding is refreshed.

The unchanged bounded implementation was then independently reviewed and
merged through the protected path. Chat approval authorized the interactive
edit only; merge authority came from exact-head Validator App evidence and
required checks.

## Protected completion evidence

- Koru review run
  [30959811009](https://github.com/semcod/todo2code/actions/runs/30959811009)
  passed exact head `9e2feff59944631a691cfac8864501646a0754ce`.
- Validator App approved the same head for `ticket-021` with
  `openrouter/z-ai/glm-5.2`; its advisory verdict was `APPROVE` with no
  findings.
- Review-triggered CI run
  [30960073802](https://github.com/semcod/todo2code/actions/runs/30960073802)
  passed governance, full verification, Docker smoke and the required Java
  fixture with the exact-head approval evidence.
- Protected PR [#33](https://github.com/semcod/todo2code/pull/33) merged as
  `main@8ebeb667710c9babf869c06ec41ea3d57d5c78a5`.
