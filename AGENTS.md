# AGENTS.md

This repository follows `wellmanifest/new-project` policy-as-code version
0.8.0. These rules apply to humans and autonomous agents.

Before any multi-step implementation:

1. Read `.governance/manifest.json`, `TODO.md`, `project/TICKETS.md` and the
   active `project/ticket-{NNN}`.
2. Reuse an unfinished ticket when its workstream and scope match. A separate
   active ticket is allowed only in another declared workstream with no write
   overlap. Otherwise run `./project/new-ticket.sh --title "..." --agent
   "..." --workstream "..."`.
3. Complete `README.md`, the actor-owned `ai-*.md`, `intent.json` and `TODO.md`.
4. Stop in `WAIT_FOR_APPROVAL`. Do not edit source, tests, build files or CI.
5. After explicit human approval, transition to `EDIT` and modify only paths
   matched by `intent.json.allowedPaths`.
6. Never create or edit `project/ticket-*/user-*.md`; only the human owner or a
   trusted intake boundary may do so.
7. Keep executable code, tests and research scripts outside ticket directories.
8. Run `make governance` plus relevant Docker/stack checks before completion.
9. Keep required governance checks deterministic. LLM findings are advisory.
10. Use a separate branch/worktree per implementation ticket. Each diff must
    resolve to exactly one active ticket; dependency/conflict edges must be
    explicit and shared contract paths require an integration ticket.
11. A developer launching an LLM from an IDE remains the operator/reviewer;
    the AI keeps its own participant identity and cannot self-approve. A second
    AI either owns a non-overlapping ticket or performs read-only review.

Chat or Markdown approval authorizes an interactive session but is not trusted
merge evidence. Merge approval must come from an independent protected GitHub
review or signed attestation. Repository rules must require the governance
status and dismiss stale approvals after new changes.
