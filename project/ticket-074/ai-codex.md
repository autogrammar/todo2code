---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-074
---
# Participant: codex (AI agent)

## Understanding

Todo2code currently owns a direct OpenRouter transport and therefore ignores
the central Z.AI-first policy and shared credential file. The least invasive
repair is inside the existing `src/llm/**` boundary: resolve a single semantic
route from the Python SubLLM package, then translate the already validated
structured request onto the selected OpenAI-compatible provider. Existing
extractors, synthesis stages and public APIs do not need to change.

Provider selection must happen before the request. Runtime errors after a paid
request starts are not replayed through a second provider. The bridge may hold
the selected credential in memory, as existing Python consumers do, but must
never include it in subprocess output, errors, audits or persisted metadata.

## Execution plan

1. Add `todo2code` plus its `semantic` function to SubLLM and verify route
   ordering, identity and credential-shape behavior.
2. Add one internal Node bridge under `src/llm/**` that invokes the installed
   Python package without a shell, resolves public route metadata, reads only
   the selected credential under SubLLM's validated file contract and caches
   it in memory.
3. Adapt the existing transport to emit provider-specific bodies: Z.AI gets
   `user_id` and `request_id`; OpenRouter gets its attribution headers and
   stable `user`; OpenRouter-only plugins are omitted for direct Z.AI.
4. Update the Platform intent-gate caller in its owning repository so semantic
   availability and model selection come from SubLLM rather than a hardcoded
   OpenRouter credential check.
5. Run focused negative/security tests, full SubLLM and todo2code suites,
   governance and Docker checks, then one minimal live structured Z.AI probe.

## Actual changes

- Created and bounded ticket-074 on branch `ticket-074-subllm-routing`.
- Diagnosed the direct OpenRouter boundary and proposed a no-new-dependency
  SubLLM bridge.
- Human owner approved continuation on 2026-08-12; transitioned to
  `IN_PROGRESS / EDIT` before changing executable files.
- Added a shell-free bridge that resolves `todo2code/semantic`, consumes only
  its selected credential, exposes only public route metadata and fails closed
  when explicitly enabled without a usable SubLLM package.
- Adapted the existing transport for direct Z.AI request identity and JSON
  object mode while preserving standalone OpenRouter behavior and prohibiting
  cross-provider replay after a request begins.
- Verified SubLLM, focused and full host behavior, governance and Docker. A
  production structured call selected direct `zai` / `glm-5.2`, returned the
  exact marker and reported 157 total tokens without exposing a credential.
- Transitioned to `IN_PROGRESS / VALIDATION`, then returned to `EDIT` after the
  required-LLM run exposed provider-stale audit configuration and parser labels.
- Responded to the first protected Koru report by isolating subprocess and
  credential-file handling, adding raw provider-token redaction and cleaning
  test fixtures. Local Lizard now reports no CC>15 finding; the full host and
  Docker gates pass after the change.
- Added secret-free effective-route audit evidence and provider-correct response
  diagnostics, then returned the ticket to `IN_PROGRESS / VALIDATION`.
- Protected PR #88 passed Koru, hosted checks and review-triggered governance.
  Validator-agent run `31596459305` approved all five exact-head chunks with
  GLM-5.2 and no blocking findings. Publication merged as `main@ceae696`;
  post-merge CI `31596778339` passed every required job.

## Blockers

- None. Ticket and workflow are complete.
