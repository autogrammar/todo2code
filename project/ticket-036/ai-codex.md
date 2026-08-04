---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-036
---
# Participant: codex (AI agent)

## Understanding

todo2code already converts all supported sources into `t2c.intent/v1` and
stores them together in `t2c.graph/v1`. Creating another DSL would split the
truth boundary. The missing capability is a lossless projection that answers:
which source records describe one mapped assertion, which are intent versus
reality versus claims, what supports what, and where conflicts remain.

I understand "one source of truth" here as one canonical evidence model, not
as picking one file or model response and discarding dissenting evidence. The
projection must therefore cite the graph fingerprint and record/relation IDs,
retain reverse mappings, expose contradictions and remain reproducible.

Because the repository assigns core, pipeline, interface and documentation
paths to different workstreams, this ticket implements only the core mapping
contract. After it is merged, separate non-overlapping tickets can persist the
artifact and expose it through CLI/MCP/A2A with documentation.

The user also needs to reason over many branches and PRs. A useful result must
bind both base and head SHAs, because a branch recommendation can become stale
without its head changing when another PR moves the base. I captured the
cross-repository design in `BRANCH_INTELLIGENCE.md`: todo2code owns semantic
evidence, Goal owns plans and approved Git effects, Koru orchestrates locally,
and validator-agent verifies the protected exact snapshot. This does not widen
the current implementation allowlist.

The repeated governance/PR incident showed that the validator already carries
useful evidence but the text view drops it, while local, push and PR entry
points validate different snapshots. `GOVERNANCE_DIAGNOSTICS.md` now defines a
single read-only explanation projection, a pre-push command and explicit roles
for Giton and wellmanifest. It remains follow-up planning and does not widen
this ticket's core-dsl implementation paths.

## Execution plan

1. Obtain explicit approval for the grouping, status and conflict semantics in
   the ticket README.
2. Transition to `IN_PROGRESS / EDIT` and mark the proposed architecture as
   accepted without widening `allowedPaths`.
3. Add an additive, dependency-free truth-map projector under `src/core/`.
4. Validate the input graph, build deterministic assertion components from
   explicit semantic mapping relations, classify evidence lanes and generate a
   complete reverse record index.
5. Derive assertion IDs and the projection fingerprint from canonical JSON;
   exclude timestamps from identity and sort all output collections.
6. Add focused tests for many-source support, isolated records, conflicts,
   ignored structural relations, dangling edges and input-order invariance.
7. Run the focused test, `npm run verify`, governance, Docker core E2E and
   whitespace validation; record exact results without calling OpenRouter.
8. Publish for protected exact-head review. Plan runtime and interface
   follow-ups separately; do not change their files here.

## Actual changes

- The user approved continuation after review of the truth-map, live branch
  audit and cross-repository integration design.
- Rebased the isolated ticket worktree from the stale planning base to
  `main@dcaae33d16637bd7b64d5ead0e66b34546ec2f5c` and accepted the bounded
  architecture without widening implementation paths.
- Runtime and focused test implementation is now authorized under the two-file
  core-dsl budget.
- Added incident-grounded diagnostic and ecosystem-integration planning only;
  no validator, CLI, Git hook or GitHub state was changed.
- Implemented the additive truth-map projector and its focused suite without a
  runtime dependency or public pipeline/interface change.
- Hardened validation against omitted mapping relations, split endpoints and
  artificial grouping of disconnected records; retained the Git commit index
  with the source revision and generator provenance.
- Corrected the LLM fixture to satisfy the existing provenance invariant
  (`llm_inference` requires `generation.used=llm`) rather than weakening the
  graph validator.
- Eight focused tests, 349 host tests, 343 Docker tests, gold evaluations,
  governance and protocol smoke tests passed. Ticket 036 is locally complete;
  ecosystem adapters remain scoped to their documented follow-up workstreams.

## Blockers

- No core implementation blocker remains. Protected exact-head review and
  merge are pending. Cross-repository Goal, Koru and Validator changes remain
  separate dependent tickets.
