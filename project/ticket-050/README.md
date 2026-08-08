# Ticket 050: Own or explicitly exclude unpublishable root paths

- **ID**: ticket-050
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-06

## Goal and scope

`CHANGELOG.md` and `.env.example` are scanned by project tooling, but **no
workstream owns them** in `.governance/manifest.json`. Agents therefore either
claim paths that governance rejects or omit required release evidence
(ticket-048's known gap).

The recommended decision is **Option A**: assign both paths to the existing
`governance` workstream. `CHANGELOG.md` is release/governance evidence, while
`.env.example` is a reviewed, non-secret environment contract enforced by
`verify:env`. One owner keeps their policy atomic and avoids overlapping
governance and integration scopes.

The installed manifest is managed and hash-locked to immutable
`wellmanifest/new-project` 0.11.0. The ownership change therefore cannot be
made as a standalone local patch. Implementation proceeds upstream-first:

1. Create and approve a governed ticket in `wellmanifest/new-project`.
2. Add the two ownership rules and regression coverage to the standard.
3. Publish a new immutable standard release.
4. Adopt that exact version and source revision in todo2code through Goal,
   preserving the customized target workstreams.
5. Record ticket-048's missing release note in the newly owned changelog.

**Option B** remains a fallback only if the upstream maintainers reject the
ownership model: permanently exclude both paths, make wrong claims fail
closed, and designate an owned release-note surface.

The user approved ticket-049, selected Option A and authorized the upstream
work on 2026-08-08. Ticket-049 is complete. Upstream tickets 036 and 037 are
complete, and immutable `v0.12.0` is published at
`7be2e266dfebfe91de1b78abf30ac8e518453216`. Ticket-050 is now authorized to
adopt that exact release.

## Acceptance criteria

- [x] AC-01: Human selected Option A and authorized the governed upstream
  ticket on 2026-08-08.
- [ ] AC-02: Manifest / standard / agent docs updated so the chosen policy is
  machine-checkable.
- [ ] AC-03: A regression test or governance diagnostic fails when an agent
  plan claims those paths under the wrong policy.
- [ ] AC-04: Ticket-048's known gap is closed or explicitly re-homed under the
  new policy.
- [ ] AC-05: Adoption binds an immutable standard version and source revision,
  preserves local workstream customization, and is idempotent under Goal.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participants: [ai-grok.md](ai-grok.md),
  [ai-codex.md](ai-codex.md)

## Non-goals

- No ad-hoc one-off edit of `.env.example` to land an unrelated feature.
- No weakening of `verify:env` fail-closed behavior.
- No standalone edit of hash-locked managed governance files; the reviewed
  target-manifest update and lock regeneration form one Goal adoption change.
- No moving tag or branch-based standard adoption.

## Related

- Parent plan: [ticket-049](../ticket-049/AUTONOMY_AND_REFACTOR_PLAN.md) §3 phase C1
- Prior incident: ticket-047 / #64 unownable-path rejection; ticket-048 cause fix for env fallbacks only
