# Ticket 050: Own or explicitly exclude unpublishable root paths

- **ID**: ticket-050
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-06

## Goal and scope

`CHANGELOG.md` and `.env.example` are required by the pinned standard and
scanned by tooling, but **no workstream owns them** in
`.governance/manifest.json`. Agents either illegally edit them (CI reject) or
silently skip release notes (ticket-048 known gap). This ticket chooses one
durable policy and implements it:

**Option A (preferred):** bump `wellmanifest/new-project` / local Goal so the
governance workstream (or a dedicated `release` workstream) owns these paths
with explicit allowed edit rules; or

**Option B:** document forever-exclude with fail-closed agent checks that
refuse plans mentioning those paths, and provide an alternate release-note
surface under an owned path.

Depends on human choice; no implementation until AC-01.

## Acceptance criteria

- [ ] AC-01: Human selects Option A or B (or a written hybrid).
- [ ] AC-02: Manifest / standard / agent docs updated so the chosen policy is
  machine-checkable.
- [ ] AC-03: A regression test or governance diagnostic fails when an agent
  plan claims those paths under the wrong policy.
- [ ] AC-04: Ticket-048's known gap is closed or explicitly re-homed under the
  new policy.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-grok.md](ai-grok.md)

## Non-goals

- No ad-hoc one-off edit of `.env.example` to land an unrelated feature.
- No weakening of `verify:env` fail-closed behavior.

## Related

- Parent plan: [ticket-049](../ticket-049/AUTONOMY_AND_REFACTOR_PLAN.md) §3 phase C1
- Prior incident: ticket-047 / #64 unownable-path rejection; ticket-048 cause fix for env fallbacks only
