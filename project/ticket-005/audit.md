# Ticket 005 audit

## Decision

Reject the live cross-language reranker as a production feature. Retain the
offline contracts, schemas, tests, captured gold fixtures and research
reproducer. Do not export or enable the reranker through the package, linker,
CLI, MCP or A2A.

## Communication audit

The final ticket produced 51 `codex` records and 4 `tom-sapletta-com` records
after section-aware conversion. There are no blocking polarity conflicts. The
final issue ownership is:

- 7 `AGENT_CLAIM_WITHOUT_EVIDENCE` findings require `codex` to attach commit or
  test evidence (the current implementation is intentionally uncommitted);
- 1 `AGENT_HUMAN_DECISION_CLAIM_UNCONFIRMED` finding requires
  `tom-sapletta-com` to record or reject the approval in the human-owned file;
- 8 `AGENT_WORK_OUTSIDE_REQUEST` warnings require `tom-sapletta-com` to record
  or reject the detailed scope that currently exists only in the conversation.

The agent may correct its seven evidence claims, but must not edit the
human-owned participant file to silence the other nine findings.

Historical read-only material from `wellmanifest/new-project` commit
`2b9e3c9` showed why a filename-only migration is unsafe:

- plain rename to `user-*`/`ai-*`: zero records and owner-specific migration
  warnings;
- typed Opus request/message sections: 9 human + 58 agent records, zero issues;
- typed GPT56Luna request/message sections: 9 human + 72 agent records, three
  unmatched request fragments and no false conflict between different files.

## Offline reranker result

Gold v2 uses captured, structured decisions through the same runtime
validators:

- expected cross-language relations: 6/6;
- forbidden cross-language relations: 0/6 violations;
- accepted: 6;
- abstained hard-negative cases: 1;
- deterministic linker remains 0/6 and unchanged.

## Live tracked-repository result

- repository: `subactor/platform`;
- clean commit: `3e96573d587cb664741849ceba205bf303b9f418`;
- current graph fingerprint:
  `250df4ff83f456fb371278d4a0c2cf17dd025582b6865a0cb2f01bd469fd1dd0`;
- retrieval: the pinned multilingual E5 ranking captured by ticket 004;
- bounded payload: six reciprocal selected declarations, initially top-3
  (18 candidates), then top-1 (6 candidates);
- model: `qwen/qwen3.7-plus`;
- declared evaluation revision: `qwen3.7-plus@2026-07-31`;
- privacy boundary: clean HEAD required; every projected declaration and module
  path had to be tracked; generated graph and result paths stayed outside the
  worktree.

Three live attempts failed closed:

1. top-3 returned a JSON value without a `decisions` array;
2. top-1 returned the top-level key `judgments` instead of `decisions`;
3. top-1, after an explicit key instruction, returned at least one
   `confidence` outside the required numeric 0..1 contract.

No accepted result artifact exists because invalid provider output is not
promoted into `t2c.semantic-rerank/v1`. No relation was created, no coverage
metric changed, and the two false embedding candidates from ticket 004 were
not silently accepted.

## Validation

- `npm run verify`: 251 tests, 250 pass, 0 fail, 1 local JDK skip;
- isolated `CLI watch` retry: 3/3 pass after one full-suite timing failure;
- gold v2 and v1: PASS;
- examples: 227 records, 97 relations, five SDKs: PASS;
- `npm audit --omit=dev`: 0 vulnerabilities;
- CLI, MCP, A2A and Docker smoke: PASS.
