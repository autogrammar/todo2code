# Canonical event log DSL

`logs.dsl.txt` is the machine-readable audit stream for a bounded todo2code
run or governance workflow. Version 1 is closed, deterministic and
tamper-evident. It records facts and decisions without treating narrative or
an LLM conclusion as trusted evidence.

## Artifact boundary

The log is emitted into the run/workflow artifact directory and becomes
immutable when that run finishes. It is not committed to `main` after a PR is
merged. Such a commit would itself create another event, change `headSha`,
invalidate exact-head approval and cause an audit loop.

A producer may maintain a private temporary file while a run is active. The
published `logs.dsl.txt` must be written atomically and attested together with
the other run artifacts. Consumers must fail closed when the stream is
truncated, reordered or hash-invalid.

## Header grammar

The file is UTF-8 without a byte-order mark and uses LF line endings. Blank
lines are forbidden. Keywords and field order are case-sensitive.

```text
DOCUMENT "T2C_EVENT_LOG"
VERSION 1
SCHEMA "t2c.event-log/v1"
STREAM_ID <JSON_STRING>
GENERATED_AT <RFC3339_JSON_STRING>
EVENT_COUNT <NON_NEGATIVE_INTEGER>
GENESIS_DIGEST <SHA256_JSON_STRING>
STREAM_DIGEST <SHA256_JSON_STRING>
```

`GENESIS_DIGEST` is always
`sha256:0000000000000000000000000000000000000000000000000000000000000000`.
For a non-empty stream, `STREAM_DIGEST` equals the last event's
`EVENT_DIGEST`. An empty stream uses the genesis digest.

## Event grammar

The header is followed immediately by exactly `EVENT_COUNT` blocks. Every
block contains every field exactly once in this order:

```text
EVENT
SEQUENCE <POSITIVE_INTEGER>
EVENT_ID <JSON_STRING>
TYPE <JSON_STRING>
TRUST_CLASS <JSON_STRING>
OCCURRED_AT <RFC3339_JSON_STRING>
RECORDED_AT <RFC3339_JSON_STRING>
ACTOR_ID <JSON_STRING>
SUBJECT_ID <JSON_STRING>
SOURCE <JSON_STRING>
OUTCOME <JSON_STRING>
REPOSITORY <OWNER_REPOSITORY_JSON_STRING>
TICKET_ID <TICKET_JSON_STRING_OR_NULL>
CORRELATION_ID <JSON_STRING>
BASE_SHA <FULL_LOWERCASE_SHA_JSON_STRING_OR_NULL>
HEAD_SHA <FULL_LOWERCASE_SHA_JSON_STRING_OR_NULL>
EVIDENCE_KIND <JSON_STRING>
EVIDENCE_REF <JSON_STRING>
EVIDENCE_DIGEST <SHA256_JSON_STRING>
PREVIOUS_DIGEST <SHA256_JSON_STRING>
EVENT_DIGEST <SHA256_JSON_STRING>
END_EVENT
```

Strings use JSON string encoding. Control characters, host-local file paths,
secrets and multi-line scalar syntax are forbidden. Identifiers are bounded to
256 Unicode scalar values; evidence references are bounded to 2048. Producers
must reject rather than truncate required identity or digest fields.

## Canonical digest

For an event, canonical payload bytes are the UTF-8 encoding of the exact
lines from `SEQUENCE` through `PREVIOUS_DIGEST`, including one LF after every
line. `EVENT`, `EVENT_DIGEST` and `END_EVENT` are excluded. No whitespace
normalization is performed.

```text
EVENT_DIGEST = "sha256:" + lowercase_hex(SHA256(canonical_payload_bytes))
```

For sequence 1, `PREVIOUS_DIGEST` equals `GENESIS_DIGEST`. Every later event
must use the immediately preceding `EVENT_DIGEST`. Sequence values start at 1
and increase by exactly one. `EVENT_ID` is unique within the stream.

Producers sort a bounded batch by `RECORDED_AT`, `SOURCE`, then `EVENT_ID`
before assigning sequence numbers. A streaming producer appends in durable
recording order and never inserts a late event into an already published
stream; `OCCURRED_AT` preserves the source time of such an event.

## Trust classes

Exactly these values are valid:

| Value | Meaning |
| --- | --- |
| `SYSTEM_FACT` | Deterministically observed Git, test, runtime or API state. |
| `HUMAN_DECISION` | An identified human decision; authority is verified separately. |
| `TRUSTED_ATTESTATION` | A protected verifier or allowlisted App attests exact evidence. |
| `ADVISORY_INFERENCE` | A heuristic or LLM conclusion that cannot grant approval. |

Recording a review is a `SYSTEM_FACT`; accepting it as merge authority requires
separate evidence and is represented by `TRUSTED_ATTESTATION` or
`HUMAN_DECISION`. An LLM-generated summary always remains
`ADVISORY_INFERENCE`, including when an App transports it.

## Event types

Version 1 accepts the following stable types:

```text
ticket.created
ticket.transitioned
git.commit.created
git.push.received
pull_request.opened
pull_request.synchronized
pull_request.reviewed
pull_request.merged
pull_request.closed
check.completed
test.completed
analysis.completed
diagnostic.raised
diagnostic.resolved
evaluation.generated
approval.attested
branch.deleted
governance.completed
```

New semantics require a schema version change. Vendor-specific names belong in
`SOURCE` or cited evidence, not in ad-hoc `TYPE` values.

## Provenance and evidence

Every event repeats repository, ticket, correlation and Git bindings so an
individual block remains attributable when extracted. `null` is permitted
only for `TICKET_ID`, `BASE_SHA` and `HEAD_SHA` when the source cannot know the
value. Missing knowledge is never guessed.

`EVIDENCE_REF` is a repository-relative path or a stable non-secret reference
such as `git:commit/<sha>`, `github:pull-request/184`,
`github:check-run/1234` or `artifact:test-report.json`. It must not contain a
machine-local absolute path, query credential or bearer value.

`EVIDENCE_DIGEST` hashes the exact cited evidence bytes using SHA-256. When the
source is an API object, the acquisition boundary first serializes the
allowlisted fields as canonical JSON and hashes those bytes. Raw webhook
payloads, environment dumps, LLM prompts and provider responses are not copied
into the DSL.

The self-contained canonical fixture has no external evidence bundle, so its
illustrative `EVIDENCE_DIGEST` values hash the UTF-8 `EVIDENCE_REF` string.
Runtime artifacts must hash the referenced evidence bytes instead.

## Outcomes

`OUTCOME` is a bounded source-owned status, not free-form prose. Canonical
values include `CREATED`, `UPDATED`, `PASSED`, `FAILED`, `DEGRADED`, `SKIPPED`,
`APPROVED`, `CHANGES_REQUESTED`, `MERGED`, `CLOSED`, `DELETED`, `BLOCKED` and
`ALLOWED`. Event-specific validators may define a smaller subset.

## Required lifecycle coverage

A change-evaluation workflow emits events for every transition it actually
observes:

1. ticket creation and workflow transitions;
2. commits and pushes bound to exact SHA;
3. PR open and synchronization;
4. each required check and test conclusion;
5. diagnostics raised and resolved;
6. advisory analysis and generated evaluation;
7. current-head review and independently verified approval;
8. merge or close;
9. branch deletion;
10. final governance verdict.

An absent source event is reported as missing evidence; it is not synthesized
from an LLM narrative. Historical reconstruction must label its source and may
claim only what retained Git/API evidence proves.

## Deterministic validation

A conforming validator checks, without an LLM:

- exact header and event fields;
- UTF-8, LF, field ordering, bounds and JSON scalar encoding;
- repository, ticket, timestamp and SHA formats;
- allowed event types, trust classes and outcomes;
- unique event IDs and contiguous sequence numbers;
- genesis, per-event chain and final stream digest;
- evidence-reference confinement and secret-shaped value rejection;
- event count and absence of trailing content.

Stable diagnostics use these codes:

| Code | Meaning |
| --- | --- |
| `LOG-STRUCTURE-001` | Header, block or field set/order is invalid. |
| `LOG-VALUE-002` | A typed value, enum, bound or reference is invalid. |
| `LOG-SEQUENCE-003` | Sequence or event identity is inconsistent. |
| `LOG-DIGEST-004` | Evidence, previous, event or stream digest is invalid. |
| `LOG-SECRET-005` | A prohibited secret-shaped value or unsafe reference appears. |
| `LOG-EVIDENCE-006` | Required lifecycle evidence is absent or unresolvable. |

LLM analysis may add an `ADVISORY_INFERENCE` event only after deterministic
validation and can never suppress these diagnostics.

## Runtime adoption sequence

The dependent runtime ticket must:

1. implement one parser/renderer/validator for this contract;
2. generate `logs.dsl.txt` beside each successful, degraded or failed pipeline
   `manifest.json`;
3. derive events from bounded runtime-owned audits rather than prose;
4. publish the log as a workflow artifact and bind it to evaluation/attestation;
5. add GitHub event acquisition separately, using least-privilege API fields;
6. prove repeated rendering of identical inputs is byte-for-byte stable.

## GitHub event acquisition boundary (ticket-047, ticket-048)

This repository now defines a dedicated, bounded boundary:

`node scripts/github-event-log.mjs`

Input, all of it explicit:

* one GitHub Actions JSON payload (`--event-path`, required)
* one event name (`push|pull_request|pull_request_review|workflow_run`)
* explicit `--output` path for the produced `logs.dsl.txt`
* `--repository`, unless the payload itself carries `repository.full_name`

The script reads **no environment variable**. Earlier revisions fell back to
`GITHUB_EVENT_PATH` and `GITHUB_REPOSITORY`; ticket-048 removed both, so a
caller can never silently acquire ambient process state instead of the payload
it named. Callers pass the values, including from Actions:
`--event-path "$GITHUB_EVENT_PATH"`.

That is also why `.env.example` declares neither key. `verify:env` derives its
required keys by scanning `scripts/**` for `process.env` reads, and
`.env.example` is owned by no workstream in `.governance/manifest.json`, whose
hashes are locked to the pinned upstream standard. An acquisition boundary that
reads the environment therefore cannot be published at all.

Behavior:

* no payload is committed to `main` from this script,
* only allowlisted fields are normalized and projected into evidence,
* unsupported events/actions fail closed,
* missing required flags fail closed with a named error,
* every emitted event records `SOURCE "github-actions"`, never `github-api`:
  the adapter reads a delivered payload and makes no API call, and claiming
  provenance it does not have would violate the contract's rule that missing
  knowledge is never guessed,
* SHA/actor/repository/ticket/relation bindings are validated,
* emitted trust class is `SYSTEM_FACT`,
* output is immutable via the existing `t2c.event-log/v1` atomic writer.

### Publication and autonomy note

Ticket-048 publishes the adapter script and tests; it does **not** wire a
GitHub Actions job (follow-up: ticket-051 / plan ticket-049). Merging still
requires trusted review evidence (`GOV-APPROVAL`) from outside this
repository's PR checkout. Do not add a workflow here that dispatches the
Validator App against itself (ticket-018 trust root).

**Where operators look (external repos, not this tree):**

| Need | Where |
| --- | --- |
| Why is the PR blocked / what NEXT? | `subactor/twin-probes` probe **`publication.gate`** — docs: `docs/PUBLICATION_PROBE.md`, map: `docs/ECOSYSTEM.md` |
| Exact-head freeze + dispatch | `subactor/validator-agent` — `bin/dispatch-direct-pr.sh`, `docs/PUBLICATION_FREEZE.md` |
| App review (trust root) | `ifuri-validator-agent[bot]` via validator-agent `direct-pr` / `scan-direct` |
| Plan ticket in this repo | `project/ticket-049` (branch `ticket/049-validator-autonomy-plan`, PR #67) |

`publication.gate` is a **measurement probe**, not a separate product and not a
merge gate. Local green tests do not replace hosted checks when GitHub Actions
is degraded.

Invocation example:

```bash
node scripts/github-event-log.mjs \
  --event-name pull_request \
  --event-path "$GITHUB_EVENT_PATH" \
  --repository "semcod/todo2code" \
  --ticket "ticket-047" \
  --recorded-at "$GITHUB_EVENT_TIME" \
  --correlation-id "$GITHUB_RUN_ID" \
  --stream-id "todo2code/github" \
  --output "artifacts/logs.dsl.txt"
```
