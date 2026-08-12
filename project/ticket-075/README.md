# Ticket 075: Ignore generated remediation projections as participant communication

- **ID**: ticket-075
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-08-12

## Goal and scope

Prevent a deterministic todo2code pipeline from interpreting its selected
generated `*.task.md` and `*.todo.md` remediation projections as anonymous
human/agent communication. These files are planning evidence already consumed
by the NL/TODO extractors; ingesting them again as communication duplicates the
same statements, invents `unknown:*` participants and produces false
participant-conflict diagnostics.

The repair is limited to deterministic ticket-file classification. A generated
task/TODO projection without communication front matter is ignored by the
communication extractor. Explicit communication front matter remains an
authoritative opt-in, so a deliberately named participant message is still
ingested. NL/TODO extraction and every existing participant convention remain
unchanged.

## Acceptance criteria

- [x] AC-01: The user's continuation and delivery request records
  `SESSION_EXECUTION_AUTHORIZATION` for this bounded repair.
- [x] AC-02: Unmarked ticket files named `TASK.md`, `*.task.md`, `*-task.md`,
  `TODO.md`, `*.todo.md` or `*-todo.md` do not create communication records,
  participants or missing-identity warnings.
- [x] AC-03: Explicit communication front matter on the same filenames still
  opts the file into participant analysis.
- [x] AC-04: Existing typed `user-*` and `ai-*` participant extraction remains
  unchanged.
- [x] AC-05: Focused tests, full verification, governance and Docker checks
  pass before PR publication.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Authorization

The user explicitly requested continued implementation, testing and push in
this session. This is bounded execution authorization, not trusted merge
approval; protected exact-head Validator evidence remains required.

## Verification evidence

- The focused projection regression and the existing typed governance
  participant regression pass.
- A real deterministic pipeline over Goal ticket-055 reports only
  `agent:codex`, zero unresolved participant identities and no projection-file
  warnings when bounded with `--changelog none --docs none`.
- `npm run verify`, `./project/governance-check.sh` and `make docker-smoke`
  pass. The one host JDK skip is the existing unavailable-toolchain case.

## Non-goals

- No filtering of actual participant messages with explicit front matter.
- No change to NL, TODO, changelog, graph or planning semantics.
- No public API, schema, package-version or dependency change.
- No automatic application of todo2code plans.
