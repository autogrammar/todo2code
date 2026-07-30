# Gold benchmark

`v1/dataset.json` is a reviewable, versioned semantic benchmark with the
runtime contract `t2c.gold-dataset/v1`. Its JSON Schema is published as
`schemas/gold-dataset.schema.json`.

Run the offline quality gate with:

```bash
npm run evaluate:gold
```

The command executes every case twice and reports:

- record-level precision and recall for NL, documentation and Markdown → DSL;
- relation-level precision and recall for linking;
- citation completeness for conclusions and TODO proposals;
- duplicate-classification precision, recall and the share of proposals
  suppressed as duplicates;
- stability from canonical fingerprints of two repeated runs.

The documentation cases use a captured structured model response and run it
through the real runtime repair/provenance path. This deliberately measures the
offline contract and deterministic post-processing, not the changing quality
or availability of a live model. Live model candidates can be reviewed into a
new dataset version; they must not silently replace gold expectations.

For machine-readable output, invoke the built CLI directly:

```bash
npm run build
node dist/src/evaluation/gold-cli.js evaluation/gold/v1/dataset.json --json
```

Use `--out <path>` to persist either Markdown or JSON. `--require-perfect`
returns a failing exit status unless extraction/linking precision and recall,
citation completeness, duplicate-classification precision and recall, and
repeated-run stability are all 100%. The deduplication rate itself is reported
but is not a quality threshold because it describes corpus composition.

When extending a dataset, keep expected records independent from runtime
output, use unique case/record labels, add both positive and negative linking
or deduplication examples, and bump the dataset/schema version for a breaking
format change.
