---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-058
---
# Participant: codex (AI agent)

## Understanding

Todo2code currently has two simultaneously true but incompatible identities.
Release and SDK metadata say `0.5.1`, while the runtime constant, CLI and every
new provenance envelope say `0.5.0`. doDSL is not inventing the older value;
it reads it from the pinned todo2code CLI and binds it to the exact analysed Git
commit and tree.

Changing one string would make the immediate output look correct but would not
prevent the next partial release. The repair therefore needs a deterministic
version contract plus removal of current-version literals from behavioral
tests. Historical artifacts must not be rewritten.

## Execution plan after approval

1. Create separate `core-dsl`, `extractors`, `runtime`, governance-routing and
   `sdk` tickets with ticket-058 as their integration coordinator.
2. Align the core runtime version and replace only current-behavior literals in
   the owning test workstreams.
3. Once the active integration reservation permits it, add the no-dependency
   version verifier, focused negative fixtures and the root verify hook.
4. Run focused tests, `npm run verify`, governance, Docker smoke and both E2E
   profiles.
5. Rebuild the todo2code image consumed by doDSL, compile a fresh candidate and
   verify the resulting DevelopmentEvidenceDSL identity and safety fields.

## Actual changes

- Audited all release/runtime declarations at exact main HEAD.
- Identified the release commit that introduced the mismatch.
- Confirmed the live CLI emits `todo2code 0.5.0` while package and VERSION are
  `0.5.1`.
- Confirmed doDSL faithfully persists that emitted producer version.
- Created planning evidence only; no implementation file changed.
- Recorded the human approval of this plan and authorization to create the
  owner-workstream tickets.
- Created tickets 059–063 on isolated branches. Each plan passes governance;
  none authorizes an implementation edit.
- Detected that `test/python-runtime.test.ts` is unowned and selected the
  protected governance route instead of claiming the path ad hoc.

## Blockers

- Ticket-054 currently reserves the `integration` workstream. The approved
  `--force-new` exception created this ticket but does not silently
  override active-scope enforcement.
- Each non-integration path requires its owning workstream ticket.
- Ticket-063 additionally depends on the protected ownership resolution in
  ticket-062.
