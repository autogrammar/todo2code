# Ticket 004: Language-independent topic matching

- **ID**: ticket-004
- **Owner**: tom-sapletta-com
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Replace further growth of the hand-written Polish-to-English topic dictionary
with a reviewable language-independent matching path. Start from a multilingual
gold benchmark, compare feasible strategies, and integrate only a strategy that
improves cross-language recall without weakening exact-target evidence or the
precision-oriented capability-topic boundary.

The primary measured repositories are `todo2code` and `subactor/platform`.
The unchanged seven-repository corpus from tickets 002 and 003 remains the
regression corpus if a candidate implementation is retained.

## Acceptance criteria

- [x] AC-01: The existing known gap and at least five new cross-language cases
  cover multiple capabilities, inflections and hard negatives.
- [x] AC-02: The benchmark reports cross-language positives separately from
  same-language capability-topic and exact-target quality.
- [x] AC-03: At least two feasible strategies are evaluated for determinism,
  runtime/dependency cost, auditability, cacheability and offline behavior.
- [x] AC-04: Any retained matcher carries explicit evidence in the relation
  basis and cannot silently masquerade as an exact token match.
- [x] AC-05: A candidate is retained only if it closes the current known gap,
  preserves all hard negatives and leaves gold v1/v2 quality perfect.
- [x] AC-06: The retained candidate improves aligned coverage on
  `subactor/platform` without reducing it on `todo2code`; otherwise the
  experiment closes without a production semantic change.
- [x] AC-07: Full verification, SDK examples, smoke, dependency audit and
  Docker validation pass; the local Java skip is allowed only because required
  CI supplies JDK 17.
- [x] AC-08: Commands, measurements, rejected approaches and remaining risks
  are preserved under this ticket and summarized in `docs/READINESS.md`.

## Non-goals

- Extending `POLISH_TOPIC_ALIASES` with another domain vocabulary batch.
- Lowering the current three-topic floor merely to raise recall.
- Sending source code or private/untracked repository content to a provider.
- Making offline CI depend on a network model.
- Treating semantic similarity as implementation evidence without recording
  its origin and score.

## Participants

- [`user-tom-sapletta-com.md`](user-tom-sapletta-com.md)
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`preprompt.md`](preprompt.md)
- [`audit.md`](audit.md)
- [`benchmark.json`](benchmark.json)
- [`scripts/research/evaluate-embedding-pairs.py`](../../scripts/research/evaluate-embedding-pairs.py)
- [`minilm-results.json`](minilm-results.json)
- [`e5-results.json`](e5-results.json)
- [`e5-prefixed-results.json`](e5-prefixed-results.json)
- [`scripts/research/rank-intent-graph-embeddings.py`](../../scripts/research/rank-intent-graph-embeddings.py)
- [`platform-e5-ranking.json`](platform-e5-ranking.json)
- [`platform-e5-reciprocal-ranking.json`](platform-e5-reciprocal-ranking.json)
- [`iteration-01.md`](iteration-01.md)
- [`iteration-01.json`](iteration-01.json)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
- [`changelog.md`](changelog.md)

## Approval

- **Decision**: approved
- **Evidence**: user message `kontynuuj`, following the explicit recommendation
  to address matching beyond the hand-written dictionary
- **Date**: 2026-07-31

## Conclusion

Raw multilingual embeddings are not safe enough to become graph evidence.
MiniLM ranked 5/6 synthetic pairs correctly. E5 ranked 6/6, but its positive
and negative score ranges overlap; on the tracked platform graph it proposed
two new links and manual review rejected both. Reciprocal top-1 removed the
false positives but added no coverage.

No production matcher was retained. The accepted library change is an explicit
cross-language gold cohort with six known positive gaps and six gated nearby
wrong modules. Full verification passed with 244 tests (243 pass, one local
JDK skip), both gold versions, five SDKs, dependency audit, CLI/MCP/A2A and
Docker smoke.
