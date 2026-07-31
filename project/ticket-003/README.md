# Ticket 003: Residual changelog diagnostic audit

- **ID**: ticket-003
- **Owner**: tom-sapletta-com
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Audit the `CHANGELOG_WITHOUT_IMPLEMENTATION` findings that remain after
ticket-002, classify a deterministic cross-repository sample, and change the
library only when the sample demonstrates one repeated false-positive class
that can be removed without treating unsupported release claims as evidence.

The unchanged corpus is:

- `semcod/code2llm`
- `semcod/domd`
- `semcod/pactfix`
- `semcod/code2logic`
- `semcod/code2docs`
- `semcod/redup`
- `subactor/platform`

External inputs remain detached tracked-only worktrees at the commits recorded
by ticket-002.

## Acceptance criteria

- [x] AC-01: A current deterministic run is recorded for all seven repositories
  using tracked `18cc21b` plus the explicit ticket-002 diagnostic patch only.
- [x] AC-02: A deterministic stratified sample covers every repository and at
  least 100 residual `CHANGELOG_WITHOUT_IMPLEMENTATION` findings.
- [x] AC-03: Every sampled finding has a review label, rationale and enough
  source/target context to reproduce the classification.
- [x] AC-04: A code change is attempted only for a false-positive class present
  in at least two repositories with at least 20 sampled examples; otherwise the
  hypothesis is rejected and the ticket closes without semantic changes.
- [x] AC-05: A focused hard-negative regression is observed failing before any
  implementation change.
- [x] AC-06: The unchanged corpus demonstrates an improvement in at least two
  repositories, with stable graph fingerprints and no loss in gold v2 quality.
- [x] AC-07: Full verify, examples, smoke, dependency audit and Docker validation
  pass; the local Java skip remains allowed only because CI requires JDK.
- [x] AC-08: Results, raw commands, changed files and the next ranked hypothesis
  are preserved under this ticket and summarized in `docs/READINESS.md`.

## Non-goals

- Broad capability-topic linking for changelog prose.
- Suppressing old or unverifiable behavioral claims merely to lower counts.
- Using an LLM to label the primary audit sample.
- Mutating or reading untracked content from external repositories.
- Combining unrelated semantic heuristics in one A/B result.

## Participants

- [`user-tom-sapletta-com.md`](user-tom-sapletta-com.md)
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`preprompt.md`](preprompt.md)
- [`audit.md`](audit.md)
- [`sample.json`](sample.json)
- [`scripts/research/audit-changelog-sample.mjs`](../../scripts/research/audit-changelog-sample.mjs)
- [`iteration-01.md`](iteration-01.md)
- [`iteration-01.json`](iteration-01.json)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
- [`changelog.md`](changelog.md)

## Approval

- **Decision**: approved
- **Evidence**: user message `kontynuuj`, following the ticket-002 conclusion
- **Date**: 2026-07-31

## Conclusion

The evidence supports one narrow correction: exact `Update <file>` bookkeeping
without behavioral wording is not an unsupported implementation claim. The
change removed 547 `CHANGELOG_WITHOUT_IMPLEMENTATION` findings and 188
secondary `UNLINKED_RECORD` warnings across five repositories. All seven graph
fingerprints stayed identical, gold v2 stayed perfect and the full offline
validation suite passed.

The 1,306 remaining findings are intentionally retained: 1,275 are substantive
or unverified claims, 30 are roadmap entries and one is a file-summary entry.
The next ranked hypothesis is to model unchecked roadmap entries through
explicit lifecycle/extractor semantics in a separate ticket, rather than hide
them with another changelog text filter.
