# Iteration 01: multilingual embedding feasibility

## Hypothesis

A pinned multilingual sentence embedding can replace the hand-written
Polish-to-English topic dictionary while preserving a precision-first boundary.

## Evidence

- Synthetic benchmark: 6 positives and 6 nearby hard negatives across four
  languages.
- Local models: pinned multilingual MiniLM and multilingual E5.
- Repository prototype: 66 actionable targetless declarations ranked against
  133 module aggregates from the tracked `subactor/platform` graph
  `ae92ead72d35e88e`.

## Result

The hypothesis is rejected in its raw form.

MiniLM ranked one wrong module above the intended module. E5 ranked all six
synthetic positives correctly, but absolute positive and negative score ranges
overlap. On the real repository, E5 with a 0.75 score and 0.01 margin proposed
two new links; manual review rejected both. Reciprocal top-1 removed those
false positives but also removed every new candidate, so coverage could not
improve.

## Retained change

No production semantic relation rule is retained. Gold v2 now exposes
`cross-language` as a separate cohort:

- 6 positive relations remain measured known gaps;
- 6 nearby wrong modules remain gated forbidden pairs;
- same-language exact-target and capability-topic precision/recall stay
  independent.

This turns the language barrier from one Polish anecdote into a multi-language
acceptance boundary without making offline CI provider-dependent.
