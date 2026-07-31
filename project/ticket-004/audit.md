# Language-independent topic matching audit

## Baseline

The current linker creates capability-topic evidence from at least three
shared normalized tokens. This is deterministic and precision-oriented, but a
hand-written Polish-to-English alias table is the only cross-language bridge.

The existing gold known gap:

- declaration: `Kolejka zadań powinna ponawiać nieudane próby z opóźnieniem`
- module: `src/queue/task-retry-backoff.ts`
- expected: `evidenced_by`
- current result: no relation

## Decision questions

1. Can a strategy bridge languages without repository-specific vocabulary?
2. Can its evidence be distinguished from lexical and exact-target evidence?
3. Can offline tests exercise the contract without a provider dependency?
4. Can production use be bounded, cached and explicitly configured?
5. Does repository-level coverage improve without hard-negative regressions?

## Candidate strategies

| Strategy | Quality hypothesis | Main risk | Initial status |
| --- | --- | --- | --- |
| Local multilingual embeddings | Semantic bridge without sending text away | model size, native/runtime cost | investigate |
| Provider translation/topic projection | Reuses audited model boundary | network, cost, nondeterminism | investigate |
| Injected precomputed topic projections | Clean deterministic linker contract | projection source still required | investigate as architecture |

## Sources and constraints

- Transformers.js supports server-side feature extraction, filesystem caching
  and disabling remote model loading after a model is installed:
  <https://huggingface.co/docs/transformers.js/en/tutorials/node>.
- OpenRouter exposes a batch embeddings endpoint, but it is authenticated,
  network-bound provider behavior:
  <https://openrouter.ai/docs/api/reference/embeddings>.
- `intfloat/multilingual-e5-small` supports 94 languages, has 384 dimensions,
  requires `query:`/`passage:` prefixes and warns that absolute cosine values
  cluster high:
  <https://huggingface.co/intfloat/multilingual-e5-small>.
- The pinned local E5 weights are about 471 MB before quantization. A compatible
  Transformers.js ONNX artifact offers an int8 file of about 118 MB:
  <https://huggingface.co/Xenova/multilingual-e5-small/tree/main/onnx>.

## Synthetic benchmark

[`benchmark.json`](benchmark.json) contains six positive and six nearby
negative pairs in Polish, German, Spanish and French. The model revisions are
pinned in the result artifacts.

| Model | Positive minimum | Negative maximum | Global separation | Pairwise ranking |
| --- | ---: | ---: | ---: | ---: |
| multilingual MiniLM | 0.673289 | 0.732568 | -0.059279 | 5/6 |
| multilingual E5, no role prefixes | 0.774453 | 0.847799 | -0.073346 | 6/6 |
| multilingual E5, query/passage prefixes | 0.759374 | 0.835202 | -0.075828 | 6/6 |

There is no safe global cosine threshold. E5 ranks every paired positive above
its nearby negative, but the smallest margin is only 0.007190 after applying
the model's required role prefixes.

## Repository experiment

The tracked `subactor/platform` graph contains 133 module aggregates and 66
actionable targetless declarations (`todo`, or documentation with
`required`/`recommended` modality). The E5 prototype compared every declaration
to every module.

At score 0.75 and forward margin 0.01:

- 6 declarations passed;
- 4 already had the selected module among current graph evidence;
- 2 proposed new candidates;
- both new candidates were rejected on review.

One rejected pair linked `Każde wywołanie wymaga idempotency_key` to
`scripts/build-urirun-registry.py`. The other picked a post-deploy check for a
multi-module Docker BuildKit statement that already touched thirteen modules.

Adding reciprocal top-1 and a reverse 0.01 margin retained one existing,
correct TODO link and proposed **zero** new candidates. This precision guard is
useful, but it cannot improve coverage on the measured repository.

## Strategy decision

| Strategy | Determinism/offline | Audit and cache | Measured decision |
| --- | --- | --- | --- |
| Raw local embedding threshold | pinned and offline after a 118–471 MB model download | model/revision and vector cache can be explicit | reject: no global separation and two platform false positives |
| Reciprocal local top-1 | pinned and offline after download | explicit score, margins and model identity | reject for production: safe sample added no coverage |
| OpenRouter embedding/translation | network and provider dependent | batchable and cacheable, but provider output needs a new audited stage | reject as default; no paid/live repository call in this ticket |
| Injected precomputed projections | deterministic linker boundary | clean provenance contract | defer: plumbing alone does not solve projection quality |

No semantic matcher is retained. The library improvement in this ticket is a
larger, separately reported cross-language gold cohort: six known positive gaps
and six gated hard negatives. Future candidates now have to improve that cohort
without hiding behind same-language capability-topic quality.
