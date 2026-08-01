# Ticket 018: Enforce new-project governance as policy-as-code

- **ID**: ticket-018
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-01

## Goal and scope

Turn `wellmanifest/new-project` from documentation-only guidance into a
deterministic policy-as-code standard, then adopt that standard in `todo2code`.
The gate must make intent visible before implementation: after a completed
ticket, a new multi-step code change requires a new plan-only ticket and a
separate human approval before source, test, build or CI implementation files
may be changed.

This ticket covers two coordinated repositories:

- `wellmanifest/new-project`: machine-readable governance contract, validator,
  stable `GOV-*` diagnostics, reusable GitHub Actions workflow, stack profiles,
  tests and documentation. No ticket, task file or execution log will be
  created in the read-only Governance Hub.
- `semcod/todo2code`: pinned adoption metadata, persistent `AGENTS.md`, local
  wrappers/hooks where appropriate, required governance CI job and
  deterministic semantic validation. Existing unrelated/concurrent worktree
  changes remain outside this ticket.

The implementation will not treat an agent-edited Markdown field as trusted
human approval. GitHub PR review/CODEOWNERS is the merge-time trust boundary;
local validation reports approval as unverified when no trusted CI context is
available.

## Planned changed paths

- Governance Hub: manifest/schema, validator and tests, reusable workflow,
  stack profiles, templates/scripts, policy documentation and version notes.
- `todo2code`: `.governance/**`, `AGENTS.md`, governance workflow integration,
  package/Make targets only where required, and ticket-018-owned governance
  records.
- Application source changes are excluded unless a focused test proves they
  are necessary for the deterministic `todo2code` governance command.

## Acceptance criteria

- [x] AC-01: A human approves this understanding and execution checklist before
      any implementation file is changed.
- [ ] AC-02: A versioned machine-readable manifest and schema define ticket,
      approval, ownership, scope, Docker, evidence and stack requirements.
- [ ] AC-03: A dependency-light deterministic validator emits documented stable
      `GOV-*` codes with message, affected paths/evidence and remediation, plus
      machine-readable JSON/SARIF output where applicable.
- [ ] AC-04: The validator rejects code changes without a preceding active and
      approved ticket, multiple active tickets, malformed tickets, out-of-scope
      paths, agent edits of `user-*.md`, executable files in ticket directories,
      manifest drift, missing Docker declarations and forbidden secrets/paths.
- [ ] AC-05: Approval provenance is checked against a trusted GitHub review
      boundary in CI; local or Markdown-only approval is never presented as a
      cryptographically trusted fact.
- [ ] AC-06: A centrally maintained reusable GitHub workflow is pinned by
      immutable revision and documented together with the required repository
      ruleset/CODEOWNERS settings.
- [ ] AC-07: Stack profiles provide appropriate gates for Node, Python, Go,
      Rust, Java, Docker, frontend E2E and infrastructure repositories without
      silently claiming unavailable tools.
- [ ] AC-08: `todo2code` adopts the manifest lock, persistent agent instructions
      and a governance CI gate; its existing offline application and Docker E2E
      checks remain operational.
- [ ] AC-09: Central validator fixture tests demonstrate both allowed and denied
      state transitions, including the exact ticket-017 DONE -> ticket-018 PLAN
      sequence used here.
- [ ] AC-10: Relevant checks run in Docker where required, raw evidence is
      recorded, diffs are reviewed and no commit or push occurs unless requested.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Risks and constraints

- Git hooks are bypassable and therefore cannot be the final authority; branch
  protection or organization rulesets must require the server-side check.
- A workflow stored only in the target repository can be weakened in the same
  pull request; the design must pin central code and document external required
  workflow/ruleset enforcement.
- The current Governance Hub `project.sh` installs unpinned latest packages on
  the host and suppresses some failures. It must not be used as evidence that
  strict, reproducible governance already exists.
- `todo2code` currently has a large dirty worktree with concurrent changes.
  Implementation must use path-specific diffs and must not rewrite or attribute
  unrelated files to ticket-018.
- Live LLM behavior is nondeterministic and provider-dependent. It may produce
  advisory findings but cannot be a required merge gate.
