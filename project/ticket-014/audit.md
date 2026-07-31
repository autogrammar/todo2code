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
