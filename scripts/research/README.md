# Research scripts

This directory contains optional, manually invoked experiment and audit
reproducers. They are not part of the `todo2code` runtime, package exports or
default verification path.

Ticket directories under `project/` contain only governance, decisions, logs,
inputs and captured results. Executable code belongs here even when a ticket is
the reason it was created.

## Scripts

- `audit-changelog-sample.mjs` deterministically samples and classifies
  `CHANGELOG_WITHOUT_IMPLEMENTATION` findings from an external corpus of intent
  runs.
- `evaluate-embedding-pairs.py` evaluates a pinned sentence-transformer against
  a supplied pair benchmark.
- `rank-intent-graph-embeddings.py` ranks targetless declarations against
  module facts in a supplied intent graph.
- `rerank-embedding-shortlist.mjs` submits only the bounded, previously
  selected embedding shortlist to the evidence-citing semantic reranker. It
  requires a clean tracked snapshot and writes the captured decision outside
  that snapshot.

The Python scripts require an explicitly prepared research environment with
`sentence-transformers`. That dependency is deliberately not part of the
library or its production install.
