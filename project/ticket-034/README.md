# Ticket 034: Scale LLM timeout by input complexity

- **ID**: ticket-034
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-08-04

## Goal and scope

Derive each OpenRouter request timeout from the configured base timeout, input
size, requested output size and structural complexity. Small requests retain the
current timeout. Crossing a baseline doubles it; each further doubling of load
doubles it again, up to a bounded maximum.

This responds to a live Subactor audit where a short NL request completed, while
the bounded multi-document pipeline legitimately ran for several minutes. The
change must distinguish one-request timeout from total pipeline duration and
must not hide exhausted-credit, schema or external-cancellation failures.

## Proposed deterministic policy

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

Therefore an input just above the baseline gets `2×`, above twice the baseline
gets `4×`, and above four times gets `8×`. The existing
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

- [x] AC-01: A human approves the formula and bounded paths after ticket-027 is
      integrated or closed.
- [ ] AC-02: Requests at or below all baselines retain the exact configured base
      timeout.
- [ ] AC-03: Crossing one, two and four baseline units produces `2×`, `4×` and
      `8×` timeouts respectively.
- [ ] AC-04: The result never exceeds 600 seconds and rejects non-finite or
      malformed request values without silently granting an unbounded timeout.
- [ ] AC-05: Structured schemas and response-healing complexity contribute to
      scaling independently of raw character count.
- [ ] AC-06: External `AbortSignal` cancellation remains immediate and is never
      extended by adaptive timeout logic.
- [ ] AC-07: Retry backoff remains inside one effective request deadline; the
      change does not multiply each retry into a separate unbounded deadline.
- [ ] AC-08: Timeout errors state both base and effective milliseconds; audit
      configuration records the factor, baselines and cap without secrets.
- [ ] AC-09: Focused tests, full `npm run verify`, Docker smoke and governance
      pass on the integrated base.

## Resolved blockers

- Ticket-027 was closed on the validated repair line at `c51bf19`. The current
  refactored base already contains its array narrowing and total edit-path
  handling in the split helper modules, so importing its full historical stack
  would only introduce unrelated conflicts.
- Implementation uses this clean ticket worktree. The unrelated edits in the
  main development worktree remain untouched.

## Approval boundary

The user's `kontynuuj` on 2026-08-04 approves this formula and bounded scope.
The ticket may enter `EDIT`; protected review remains required for merge.

## Participants

- Human participant: unresolved; no `user-*` file was created.
- Agent participant: [ai-codex.md](ai-codex.md)
