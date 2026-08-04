# Governance diagnostics and branch preflight

## Incident-derived problem statement

The current governance runtime often owns the evidence needed to explain a
failure but its text renderer emits only `code`, `message`, `paths` and
`remediation`. Structured evidence such as `firstImplementationCommit`,
`acceptedBaseSha`, `observedBaseSha`, `currentTargetSha`, `targetRef`,
`pathOwners` and budget counters remains visible only in JSON.

The local and hosted entry points also answer different questions:

| Entry point | What it currently sees | Failure mode |
| --- | --- | --- |
| `make governance` | primarily the working-tree diff | can pass before commit-history ordering is testable |
| push governance | the pushed ref without PR approval context | can pass while the PR-specific job later fails |
| PR governance | exact base/head commit range and approval boundary | finds history/order failures late |
| GitHub mergeability | the moving target branch | reports `DIRTY` without an intent-aware explanation |

Observed examples:

- `GOV-INTENT-003` knew the first implementation commit but text output did
  not print its SHA or the required parent containing `intent.json`;
- target `main` moved repeatedly while a PR was prepared, but no local report
  presented accepted base, current target, merge base, ahead/behind counts and
  conflicting paths together;
- an unrelated commit landed on the same remote feature branch, while the
  existing checks did not explain that the PR now represented more than one
  intent;
- `delivery.requiredForImplementation` is currently `false` in the target
  manifest, so an `acceptedBaseSha` can be documented without activating the
  deterministic `GOV-BASE-001` gate.

## One diagnostic projection

Do not create a second governance DSL. Add a diagnostic projection to the
planned discriminated `t2c.branch/v1` contract:

```json
{
  "schemaVersion": "t2c.branch/v1",
  "kind": "validation",
  "repository": "semcod/todo2code",
  "ticket": "ticket-021",
  "base": {
    "acceptedSha": "<40-hex>",
    "currentTargetSha": "<40-hex>",
    "mergeBaseSha": "<40-hex>"
  },
  "head": {
    "sha": "<40-hex>",
    "branch": "refs/heads/ticket/example",
    "ahead": 2,
    "behind": 1
  },
  "commitOrder": {
    "intentCommit": "<40-hex-or-null>",
    "firstImplementationCommit": "<40-hex-or-null>",
    "valid": false
  },
  "findings": [
    {
      "code": "GOV-INTENT-003",
      "expected": "intent committed in an ancestor of implementation",
      "observed": "intent and implementation first appear together",
      "evidence": {
        "firstImplementationCommit": "<40-hex>",
        "requiredParent": "<40-hex>"
      },
      "nextActions": [
        "create a clean branch from the exact target SHA",
        "commit the approved intent",
        "commit implementation separately"
      ]
    }
  ],
  "verdict": "BLOCKED",
  "fingerprint": "<sha256>"
}
```

The JSON artifact is canonical. Text and Markdown are deterministic views over
the same fields and must never hide evidence carried by JSON.

## Proposed operator command

```text
todo2code governance explain \
  --target-ref origin/main \
  --head HEAD \
  --ticket ticket-021 \
  --format text|json|markdown
```

The command is read-only. Before push it should report:

1. repository, current branch and exact head SHA;
2. accepted base, current target and merge-base SHAs;
3. ahead/behind counts and whether the target moved;
4. intent commit and first implementation commit in chronological order;
5. changed paths grouped by ticket, workstream and architecture component;
6. overlapping local/remote branches and PR head mismatches;
7. required checks, current checks and stale approvals when GitHub evidence is
   explicitly available;
8. every finding with rule, expected state, observed state, evidence and
   concrete next actions;
9. a final `READY`, `REVIEW_REQUIRED`, `REBASE_REQUIRED` or `BLOCKED` verdict.

Offline Git and governance facts remain available without GitHub or an LLM.
Unavailable remote evidence must be `UNKNOWN`, never silently treated as pass.

## Project responsibilities

- **todo2code** owns the canonical branch snapshot, semantic evidence,
  governance JSON ingestion and human-readable diagnostic projection.
- **Goal** consumes an exact snapshot and prepares an approval-bound operation
  plan; it never changes Git state from an advisory result alone.
- **Giton** invokes the read-only todo2code preflight at `pre-push` and displays
  the same fingerprint. It must not duplicate policy evaluation.
- **Validator Agent** verifies hosted checks and review for the exact head SHA
  and can attach trusted approval evidence after deterministic gates pass.
- **Koru** may explain semantic risk or compare alternatives, but its LLM
  conclusion remains advisory and cannot rewrite deterministic findings.
- **wellmanifest/new-project** remains the owner of `GOV-*` rule semantics. Its
  text renderer should expose structured evidence already present in findings;
  todo2code must not fork those rules.

## Delivery order

1. Complete ticket 036 core truth-map projection.
2. Add a bounded todo2code branch snapshot/validation artifact using
   `t2c.branch/v1` and the existing governance JSON output.
3. Add the read-only `governance explain` CLI view and tests.
4. Integrate Goal as the explicit effect planner.
5. Add an opt-in Giton pre-push adapter referencing the todo2code artifact
   fingerprint.
6. Improve the upstream wellmanifest text renderer and adopt one published,
   reviewed standard SHA.

Each step is a separate ticket/workstream and must remain independently
revertible. No step may automatically rebase, force-push, merge, close or
delete a branch.
