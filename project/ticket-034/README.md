# Ticket 034: Scale LLM timeout by input complexity

- **ID**: ticket-034
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-04

## Goal and scope

Derive each OpenRouter request timeout from the configured base timeout, input
size, requested output size and structural complexity. Small requests retain the
current timeout. Crossing a baseline doubles it; each further doubling of load
doubles it again, up to a bounded maximum.

This responds to a live Subactor audit where a short NL request completed, while
the bounded multi-document pipeline legitimately ran for several minutes. The
change distinguishes one-request timeout from total pipeline duration and does
not hide exhausted-credit, schema or external-cancellation failures.

## Approved deterministic policy

For a chat-completion body calculate:

- `inputRatio = serialized request characters / 8_000`;
- `outputRatio = max_tokens / 6_000`;
- `complexityRatio = complexity points / 4`, where message count contributes
  one point, strict JSON Schema contributes two, and response healing contributes
  one;
- `pressure = max(1, inputRatio, outputRatio, complexityRatio)`;
- `steps = ceil(log2(pressure))`;
- `multiplier = min(8, 2^steps)`;
- `effectiveTimeout = min(600_000 ms, baseTimeout * multiplier)`.

Therefore an input just above the baseline gets `2x`, above twice the baseline
gets `4x`, and above four times gets `8x`. The existing
`OPENROUTER_TIMEOUT_MS` and documentation-specific base timeout remain minimums,
not replaced defaults.

## Bounded implementation paths

- `src/llm/openrouter-timeout.ts`: pure pressure/timeout calculation.
- `src/llm/openrouter.ts`: apply the effective timeout to chat completion
  requests and report base/effective values on timeout.
- `src/llm/audit.ts`: persist the non-secret scaling policy with LLM audit
  configuration.
- `test/openrouter-timeout.test.ts`: boundary, cap and cancellation regressions.
- Governance evidence under `project/ticket-034/**` and indexes.

Model selection, token budgets, retry counts, chunking, concurrency, provider
fallback and the `/models` endpoint are out of scope.

## Acceptance criteria

- [x] AC-01: The user approves this exact formula and bounded implementation.
- [x] AC-02: Requests at or below all baselines retain the exact configured base
      timeout.
- [x] AC-03: Crossing one, two and four baseline units produces `2x`, `4x` and
      `8x` timeouts respectively.
- [x] AC-04: The result never exceeds 600 seconds and rejects non-finite or
      malformed request values without silently granting an unbounded timeout.
- [x] AC-05: Structured schemas and response-healing complexity contribute to
      scaling independently of raw character count.
- [x] AC-06: External `AbortSignal` cancellation remains immediate and is never
      extended by adaptive timeout logic.
- [x] AC-07: Retry backoff remains inside one effective request deadline; the
      change does not multiply each retry into a separate unbounded deadline.
- [x] AC-08: Timeout errors state both base and effective milliseconds; audit
      configuration records the factor, baselines and cap without secrets.
- [x] AC-09: Focused tests, full `npm run verify`, Docker smoke and governance
      pass on the integrated base.

## Base readiness

The current `main` worktree is clean, no other active ticket owns the `llm`
workstream, and its OpenRouter implementation matches the previously validated
refactoring base. The stale blockers from the earlier proposal no longer apply.

## Approval boundary

The user's earlier adaptive-timeout instruction and current execute instruction
authorize the bounded implementation. They are not trusted merge evidence; an
external Validator App exact-head review remains required.

## Validation result

All seven focused timeout tests pass. The complete suite passes 341 tests with
one environment-dependent Java test skipped, full verification has zero
failures, Docker smoke passes, and the local governance gate reports zero
errors and warnings. Koru accepted the final complexity repair, and
validator-agent approved exact head `e09e8323b96cfdd7543e851b57bd1035d640eb84`
with `openrouter/z-ai/glm-5.2`. All protected checks passed and PR #31 merged
the implementation as `main@6116961d8c9674b24c1161903e43f3a7dbb2147b`.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)
