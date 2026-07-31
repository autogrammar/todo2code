# Participant: Codex (AI agent)

- **Ticket**: ticket-004
- **Status**: COMPLETE
- **Workflow state**: DONE

## Understanding

The current known gap is not evidence that the three-topic threshold should be
lowered. It demonstrates that lexical topic equality cannot bridge arbitrary
languages. The experiment must separate semantic projection from graph scoring
and preserve its provenance.

## Execution plan

1. Expand multilingual gold coverage and classify positive and negative pairs.
2. Map the synchronous linker, public API, pipeline configuration and cache
   boundaries.
3. Compare local embedding, provider translation/projection and injected
   precomputed-topic strategies.
4. Add a red contract test for the selected architecture.
5. Implement one bounded candidate only if it remains auditable and optional.
6. Run gold and controlled repository A/B.
7. Complete full validation and readiness documentation.

## Guardrails

- No additional domain dictionary as the principal solution.
- No network call from `linkIntentRecords`.
- No provider output accepted without runtime validation.
- No private or untracked external inputs.
- No unrelated generated-analysis rewrite.

## Actual changes

- Initialized the approved ticket.
- Added a 12-pair, four-language embedding benchmark and evaluated two pinned
  local multilingual models.
- Demonstrated overlapping positive/negative cosine ranges and two rejected
  false-positive candidates on the tracked platform graph.
- Demonstrated that reciprocal top-1 restores precision in the sample but adds
  no coverage.
- Rejected a production matcher and expanded gold v2 with a separately reported
  cross-language cohort: six known positives and six forbidden negatives.
- Passed full verification (244 tests, 243 pass, one local JDK skip), gold
  v1/v2, five SDK examples, dependency audit, CLI/MCP/A2A and Docker smoke.
- Updated readiness evidence and closed the ticket without adding an unsafe
  semantic relation rule.
- After user review, moved both executable experiment reproducers out of the
  ticket directory into `scripts/research/`; benchmark inputs and captured
  results remain ticket evidence.

## Blockers

- None.
