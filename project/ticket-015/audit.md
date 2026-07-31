# Ticket 015 audit

## Cause

The compound source said `Implement ... and verify it ...`. The deterministic
action classifier selected `validate` because `verify` has higher table
precedence than `implement`. `inferObject` then removed `verify` from the middle and
left `Implement ... and it ...`; `titleFor` unconditionally prepended another
`Implement`.

## Fix

`titleFor` keeps its concise `Implement <object>` projection for normal records.
When the inferred object still begins with an imperative, it instead uses the
lossless source statement (without terminal punctuation). This is a narrow,
auditable indication that object inference removed a different clause verb.

## Evidence

The focused suite passed 18/18. The full repository gate passed with 300 tests
(299 pass, 1 local JDK skip), both gold datasets remained at 100%, and
`examples:check` passed with unchanged SDK fingerprints. Re-running the
original existing-path fixture
produced:

`Implement bounded exponential retry backoff in src/retry.py and verify it in tests/test_retry.py`

The underlying record text, targets and diagnostic remained unchanged.
