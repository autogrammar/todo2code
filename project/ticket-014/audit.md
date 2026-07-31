# Ticket 014 audit

## Reproduction

Fixture declaration:

`Implement bounded exponential retry backoff in src/retry.py and verify it in tests/test_retry.py.`

`src/retry.py` contained only an `enqueue` function. The pipeline emitted no
`PLANNED_NOT_IMPLEMENTED` diagnostic and no code-change plan because the shared
path was accepted as sufficient alignment. Changing only the target to the
missing `src/retry_backoff.py` immediately produced one grounded plan, which
Koru converted to `PLF-001`.

## Koru control

The isolated end-to-end control later produced `PLF-002`, Codestral returned a
hash-bound unified diff, Koru verified it in a worktree and committed it on
`koru/run-6e596247e153` (`1809ea5`). Re-running todo2code on that branch cleared
the targeted `PLANNED_NOT_IMPLEMENTED` diagnostic. This proves the transport;
it does not excuse the original false alignment on an existing file.

## Semantic gate and autonomous replay

The linker still records `shared_path + module_coverage` because the relation
is useful for navigation, but diagnostics no longer treats it as implementation
of a capability. Topics requested by the declaration are compared with the
aggregate's extracted `metadata.capabilities`; path-derived and structural edit
words do not count. A symbol, capability overlap, accepted semantic rerank or
grounded similarity to a concrete fact/commit can close the declaration. A
pure file-creation declaration remains compatible with exact path evidence.

The original existing-path fixture was replayed after the fix. todo2code raised
one `PLANNED_NOT_IMPLEMENTED`, generated one code-change plan and Koru created
`PLF-003`. Koru required a unified diff, ran `PYTHONPATH=. pytest -q`, and
committed the verified patch as `55a8b15` on
`koru/run-35477cccef16`. Independent verification reported 6/6 tests and a
second todo2code run produced zero plans for the target intent. The accepted
relations carried `capability_overlap:2`/`module_topic:4` for `src/retry.py`
and `capability_overlap:1` for its test.

## Cross-repository regression

Fresh deterministic runs succeeded on `weekly`, `nlp2uri` and `algitex`.
They reported respectively 1/10/3 `PLANNED_NOT_IMPLEMENTED`, 9/12/5 total
code-change plans, 58/152/139 capability-overlap relations and retained
40/54/202 path-only module relations as navigation evidence. No repository
crashed and no generated artifact was written into its worktree.

Ambiguous human intent continues through the existing communication contract:
`responseRequiredRole` plus a known participant or `unresolved:human`. The
runtime does not create or rewrite `user-*`. A missing implementation with a
clear target is instead labelled for the technical executor in the diagnostic
action, so it does not unnecessarily block on a human decision.
