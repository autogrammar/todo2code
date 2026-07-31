# Participant: Codex (AI agent)

- **Ticket**: ticket-002
- **Status**: ACTIVE
- **Workflow state**: TOOLS

## Understanding of the task

The objective is not merely to prove that todo2code completes on other
repositories. The work must establish whether its semantic conclusions remain
useful outside its own codebase, identify recurring causes of weak coverage or
false diagnostics, and improve the library only where repeated measurements
justify the change.

## Included scope

1. Create isolated detached worktrees for the recorded external commits.
2. Run one normalized offline pipeline and reality report per repository.
3. Persist a compact machine-readable baseline and a reviewed Markdown report
   under this ticket.
4. Compare relation classes, diagnostics, unsupported languages, topic status
   and coverage rather than relying on record count alone.
5. Review representative false positives and false negatives.
6. Select the highest-impact shared defect that can be fixed without accepting
   ungrounded evidence.
7. Add gold/unit coverage, implement one correction and rerun the same corpus.
8. Record the delta and either retain or reject the correction.

## Excluded scope

- Mutating, committing or cleaning external repositories.
- Reading private or untracked external inputs.
- Tuning a threshold only to improve headline coverage.
- Provider-dependent LLM calls in the primary baseline.
- Adding a new dependency without a separate license and security review.
- Implementing several semantic heuristics in one unmeasurable batch.

## Execution plan

### Phase 1 — reproducible baseline

1. Verify stable todo2code and Docker validation commands.
2. Define the shared document/task/communication policy and explicit
   repository exceptions.
3. Analyze the seven verified repositories at recorded detached commits.
4. Store per-repository JSON metrics, warnings and sampled diagnostic evidence.

### Phase 2 — evidence review

5. Rank recurring gaps by frequency, severity and affected repositories.
6. Separate extractor, target-resolution, linker, diagnostics and
   unsupported-language failures.
7. Choose one defect with evidence in at least two repositories.

### Phase 3 — one controlled improvement

8. Add a gold or focused unit regression, including a nearby negative.
9. Implement the smallest deterministic correction.
10. Run gold v2, focused tests and the unchanged external corpus.
11. Keep the change only if the target metric improves without a measured
    precision regression.

### Phase 4 — validation and conclusions

12. Run the complete stable validation matrix and Docker checks.
13. Update ticket evidence, changelog, acceptance criteria and readiness
    conclusions.
14. Present the next ranked improvement as a separate continuation decision.

## Candidate hypotheses, not decisions

- PL documentation to EN identifiers is still a measured `knownGap`.
- Changelog claims may lack implementation evidence because topic matching
  intentionally excludes changelog records.
- Configuration-only evidence may overstate `aligned`.
- Unsupported PHP and other languages may dominate reality gaps in some
  repositories.

The baseline decides which hypothesis is addressed first.

## Approval gate

Approved by the user's `kontynuuj` message on 2026-07-31 under `P-CORE-008`.
Execution may proceed within the recorded scope.

## Actual changes

- Initialized the standard ticket structure and project-level TODO entry.
- Verified Docker availability and the seven candidate repositories.
- Verified ticket formatting, absence of local absolute paths and compatibility
  with the generated-analysis guard.

## Unfinished items and blockers

- No current blocker.
