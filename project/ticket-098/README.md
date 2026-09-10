# ticket-098 — Published compact governance

- **Status**: IN_PROGRESS
- **Workflow state**: EDIT

## Request record

SESSION_EXECUTION_AUTHORIZATION is an audit classification of the user's request
recorded under AGENTS.md rule 4. This text supplies no approval evidence and
cannot authorize a review, push or merge. The protected Validator must acquire
independent approval bound to the repository, pull request, current head, ticket
and actor; the assistant must not merge directly.

## Scope

Adopt the published wellmanifest/new-project **0.20.20** payload at
`d31beca68b9964c6af493a44974b247626294b65`, preserving repository tests and independent
approval. This enables compact ticket intent for canonical configuration inputs.
Ticket-094 is terminal by merged PR #113; its historical prose stays unchanged.

## Verification evidence

At head `1e986f8953ba21973c6b68c914db8db149b8949a`, the managed local governance
checker returned GOV-PASS, and npm verify passed 444 tests with one optional skip.
GitHub reported PASS for `governance / enforce`, `governance / remote lifecycle`,
`verify`, `Java adapter (JDK 17 required)` and `koru / code-review`.

The separate event-triggered governance wrapper was SKIPPING on push/PR events;
its declared condition runs it for default-branch pushes, manual dispatch and
review events. That skipped wrapper is not evidence of passed governance. The
workflow conditions and required gate names stay unchanged. All actions in the
target-owned CI wrapper are now pinned to the exact commits resolved from their
existing major tags, completing the adoption’s immutable dependency boundary.
Every new head requires fresh protected verification and approval.
