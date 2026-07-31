# Gold benchmark

`v2/dataset.json` is the current reviewable, versioned semantic benchmark, with
the runtime contract `t2c.gold-dataset/v2`. `v1/dataset.json` stays in the tree
and stays evaluable; it is the smaller sample the thresholds were first tuned
against. Both are described by `schemas/gold-dataset.schema.json`.

Run the offline quality gate with:

```bash
npm run evaluate:gold        # v2
npm run evaluate:gold:v1     # the v1 sample, unchanged
```

The command executes every case twice and reports:

- record-level precision and recall per extraction channel — NL, the captured
  documentation model response, the deterministic documentation baseline and
  Markdown → DSL;
- relation-level precision and recall for linking, split into `exact-target`
  and `capability-topic`;
- a separate cross-language cohort covering known positive gaps and gated hard
  negatives without hiding either inside same-language capability quality;
- separately scored captured reranker decisions for that cohort, including
  grounded accept/reject/abstain outcomes; these do not change the
  deterministic linker score;
- diagnostic-code precision and recall per record, including false DONE claims;
- citation completeness for conclusions and TODO proposals;
- duplicate-classification precision, recall and the share of proposals
  suppressed as duplicates;
- stability from canonical fingerprints of two repeated runs.

## What v2 adds

- **A deterministic documentation channel.** `documentation` runs the audited
  LLM path against a captured response; `documentation-deterministic` runs the
  offline Markdown baseline that every run has. They fail differently, so they
  are measured apart. Prescriptive prose (`must`, `should`, `nie wolno`) and
  descriptive prose are separate cases, because whether documentation counts as
  a plan is decided by its modality.
- **Capability-topic support wide enough to move.** Seven positives and five
  hard negatives, including a pair two topics apart and one whose only shared
  vocabulary is generic. With v1's single positive and single negative, moving
  the three-topic floor could not be distinguished from noise.
- **A diagnostics scope.** Extraction and linking cannot express "this DONE
  claim has no implementation behind it": the record extracts cleanly and links
  to nothing, which is exactly the state under test. `diagnostics` cases name
  the codes a small graph must raise per record, and `forbidden` names the ones
  it must not — a DONE task with real evidence must stay quiet.
- **Known gaps, measured but not gated.** A case marked `knownGap: true` is
  scored and reported separately, never inside precision and recall. The
  multilingual prose-to-English-module cohort spans Polish, German, Spanish
  and French. Encoding its positive expectations as ordinary expectations
  would make the offline gate permanently red, while its nearby wrong modules
  remain gated forbidden pairs.
- **Captured reranker decisions.** Each cross-language case carries a bounded
  retrieval shortlist and reviewed structured result. The runtime validates
  exact record IDs, quotes, reason codes, one-module acceptance and abstention.
  Current fixtures reach 6/6 expected pairs, violate 0/6 forbidden pairs and
  abstain on one pure hard negative. This proves the offline decision contract,
  not the reliability of a live provider.

The documentation cases use a captured structured model response and run it
through the real runtime repair/provenance path. This deliberately measures the
offline contract and deterministic post-processing, not the changing quality
or availability of a live model. Live model candidates can be reviewed into a
new dataset version; they must not silently replace gold expectations.

For machine-readable output, invoke the built CLI directly:

```bash
npm run build
node dist/src/evaluation/gold-cli.js evaluation/gold/v2/dataset.json --json
```

Use `--out <path>` to persist either Markdown or JSON. `--require-perfect`
returns a failing exit status unless extraction/linking/diagnostic precision and
recall, citation completeness, duplicate-classification precision and recall,
and repeated-run stability are all 100%, with no forbidden relation or code
raised. The deduplication rate and the known-gap ratio are reported but are not
thresholds: the first describes corpus composition, the second describes work
that has not been done yet.

When extending a dataset, keep expected records independent from runtime
output, use unique case/record labels, add both positive and negative linking,
diagnostic or deduplication examples, and bump the dataset/schema version for a
breaking format change.
