# Participant: Codex (AI agent)

- **Ticket**: ticket-005
- **Status**: DONE
- **Workflow state**: DONE

## Understanding

Ticket-004 proved that multilingual similarity is useful for ordering
candidates but unsafe as relation evidence. The next candidate therefore
separates recall from acceptance: retrieval finds a small shortlist, while an
audited reranker must explain an accepted module using repository-owned
evidence or abstain.

Before introducing another semantic stage, the current communication boundary
must be measured. The governance standard names participants through
`user-<identity>` and `ai-<provider>` files; those records must remain distinct
from ticket specifications and must produce an actionable response owner when
human and agent intent diverge.

## Execution plan

1. Audit `user-*`/`ai-*` extraction and communication analysis on current
   todo2code tickets.
2. Add red regressions for participant filename recognition, evidence-file
   exclusion and response ownership.
3. Implement the minimal deterministic communication correction.
4. Re-run the corrected analysis on todo2code and external tracked projects.
5. Specify the candidate, decision, provenance and abstention contracts.
6. Add red contract tests and cross-language gold projection fixtures.
7. Implement the optional orchestration boundary outside the deterministic
   linker.
8. Evaluate a constrained reranker on the six gold positives and negatives.
9. Run tracked A/B on `todo2code`, `subactor/platform` and one additional
   repository selected from the existing seven-repository corpus.
10. Manually review every newly proposed relation.
11. Retain the implementation only if every precision and coverage criterion
   passes; otherwise remove it and retain the evidence.
12. Run the full release validation and update readiness documentation.

## Planned code locations

- `src/`: public contracts and optional orchestration.
- `test/`: contract, hard-negative and integration tests.
- `evaluation/gold/`: versioned evaluation fixtures if the schema requires it.
- `scripts/research/`: optional manually invoked reproducer only.
- `project/ticket-005/`: specifications, logs, captured results and decisions
  only.

## Risks

- A reranker may restate semantic similarity without adding evidence.
- Candidate text may bias a model into selecting a module instead of
  abstaining.
- Multi-module requirements may be incorrectly collapsed to one module.
- Provider-dependent evaluation may be nondeterministic or unavailable.
- Curated gold projections may overfit six examples without improving a real
  repository.

## Guardrails

- No relation from retrieval score alone.
- No silent fallback from an unavailable reranker to raw embeddings.
- No network-dependent default or offline-CI requirement.
- No external untracked content.
- No executable files under the ticket directory.

## Actual changes

- Initialized the reviewable plan only.
- No linker behavior has changed.
- Owner approved execution and added the `user-*`/`ai-*` divergence audit.
- Added section-aware conversion in `src/extractors/communication.ts` for
  governance participant files and excluded ticket evidence plus raw
  `ai-*-logs.txt` from the participant channel.
- Added explicit response ownership in `src/communication/analyzer.ts` to every
  communication issue and a separate issue for an agent claim about an
  unconfirmed human decision.
- Added migration warnings for unstructured participant files in
  `src/extractors/communication.ts`, normalized filename identities, ignored
  numeric Markdown markers and recognized bare filenames as repository paths
  in `src/core/text.ts`.
- Prevented opposite statements about two explicit, different files from
  becoming a false intent conflict.
- Tested historical `wellmanifest/new-project` prompts and agent analyses in a
  read-only migration captured by `project/ticket-005/audit.md`. Correct
  `request`/`message` typing produced zero issues for Opus; GPT retained three
  unanswered prompt fragments and no false file conflict.
- Focused communication, NL, pipeline and task-synthesis tests pass.
- Added versioned, bounded candidate and reranker result contracts in
  `src/semantic/reranker.ts`. Retrieval alone cannot mutate a graph; an
  accepted result must cite exact repository-owned evidence, and ambiguity or
  multi-module scope abstains.
- Added a strict tracked-snapshot network boundary and a research reproducer
  under `scripts/research/`; no executable source was added to the ticket.
- Added captured gold reranking fixtures to
  `evaluation/gold/v2/dataset.json`: 6/6 expected cross-language relations,
  0/6 forbidden violations and one hard-negative abstention.
- Ran three live attempts on clean `subactor/platform` commit `3e96573`;
  provider output violated the structured contract each time, so no relation
  or coverage change was accepted.
- Removed reranker exports from the public package in `src/index.ts`. The
  deterministic linker, CLI, MCP and A2A remain unchanged.

## Blockers

- The evaluated provider/model does not reliably honor the structured result
  contract, and no real-repository coverage improvement was demonstrated. This
  blocks production retention but does not block closing the rejected
  experiment.

## Conclusion

Retain the communication correction and offline evidence contracts. Reject the
live semantic production path until a provider-pinned candidate passes the
same real-repository boundary.
