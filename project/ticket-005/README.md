# Ticket 005: Audited cross-language reranking

- **ID**: ticket-005
- **Owner**: tom-sapletta-com
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Evaluate a two-stage cross-language linking path: semantic retrieval may create
only a bounded candidate list, while a separate structured reranker must cite
repository-owned evidence and may abstain. Retain a production change only when
it closes the six current cross-language gold gaps, preserves every forbidden
pair and improves coverage on an additional tracked repository.

Executable implementation belongs in `src/` and regression coverage in
`test/`. Optional experiment reproducers belong in `scripts/research/`.
This ticket directory is limited to governance, inputs, captured outputs,
decisions and logs.

The approved continuation adds a prerequisite communication audit: verify that
the governance-standard `user-*` and `ai-*` files are converted into distinct
human/agent Intent DSL records, compare their intent, and identify the
participant who must respond when scope, polarity or coverage diverges.

## Acceptance criteria

- [x] AC-01: Define a versioned candidate and reranker contract with explicit
  model/provider identity, score, cited record IDs and abstention reason.
- [x] AC-02: Keep network/model calls outside the synchronous deterministic
  `linkIntentRecords` boundary and preserve the current offline default.
- [x] AC-03: Candidate generation is bounded and cannot create a relation by
  itself.
- [x] AC-04: The reranker accepts a candidate only with repository-owned
  evidence; unsupported, ambiguous and multi-module statements abstain.
- [x] AC-05: Gold v2 cross-language recall rises from 0/6 to 6/6 while all six
  cross-language forbidden pairs and all existing hard negatives remain clean.
- [ ] AC-06: A tracked repository outside the ticket-004 primary pair shows
  improved implementation coverage without a manually rejected new relation.
- [ ] AC-07: Any dependency or provider is pinned, licensed, security-reviewed,
  cacheable and optional; no private or untracked source is transmitted.
- [x] AC-08: Full verification, both gold versions, examples, dependency audit,
  CLI/MCP/A2A smoke and Docker validation pass.
- [x] AC-09: If the quality boundary is not met, reject the candidate without a
  production semantic rule and preserve the measured failure.
- [x] AC-10: No executable source is stored under `project/ticket-005`.
- [x] AC-11: Governance-standard `user-*` and `ai-*` files are recognized
  without front matter, while ticket specifications and generated evidence are
  not misclassified as participant communication.
- [x] AC-12: Communication analysis reports an explicit response owner for
  missing response, human-agent conflict and agent work outside the human
  request.

## Non-goals

- Growing the hand-written Polish dictionary.
- Lowering the three-topic lexical floor.
- Treating embedding similarity as implementation evidence.
- Enabling provider-dependent behavior by default.
- Choosing one module for a genuinely multi-module requirement.

## Participants

- [`user-tom-sapletta-com.md`](user-tom-sapletta-com.md)
- [`ai-codex.md`](ai-codex.md)

## Evidence

- [`preprompt.md`](preprompt.md)
- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
- [`changelog.md`](changelog.md)

## Approval

- **Decision**: approved
- **Evidence**: user instruction to handle the next todo2code tickets and audit
  `user-*`/`ai-*` Intent DSL divergence
- **Date**: 2026-07-31

## Conclusion

The communication prerequisite is retained. Governance `user-*` and `ai-*`
sections become distinct human/agent Intent DSL records, and each detected
divergence names the role and participant who must respond.

The semantic production candidate is rejected. Captured gold decisions satisfy
6/6 expected cross-language pairs with zero forbidden pairs, but three live
OpenRouter attempts on the clean tracked `subactor/platform` snapshot failed
the structured contract before any relation could be materialized. The
provider first omitted `decisions`, then returned `judgments`, and finally
returned an invalid non-numeric confidence. Consequently AC-06 and AC-07 were
not demonstrated. The deterministic linker remains unchanged, and the
experimental reranker is not exported from the package, CLI, MCP or A2A.
