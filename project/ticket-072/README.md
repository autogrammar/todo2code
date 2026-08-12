# Ticket 072: Redact provider management identifiers at the LLM boundary

- **ID**: ticket-072
- **Owner**: unresolved:human
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-12

## Goal and scope

Redact credential-shaped values and provider key-management URLs before an
OpenRouter error crosses the LLM boundary. The provider's actionable status,
error category and ordinary explanation remain available, but local CLI,
pipeline manifests and protocol consumers must not receive key fingerprints or
account-management locations.

The correction is deliberately centralized in the OpenRouter adapter so every
existing extractor, synthesis path and interface receives the same safe error.
It does not weaken `require-llm`, convert a failed request into a degraded
result or change retry behavior.

## Acceptance criteria

- [x] AC-01: The human owner approved continuation after reviewing the
      redaction finding and proposed bounded follow-up.
- [x] AC-02: OpenRouter errors redact API-key-shaped values, contextual key or
      credential identifiers and key-management URLs.
- [x] AC-03: Ordinary provider explanations and invalid-model diagnostics stay
      actionable after redaction.
- [x] AC-04: `require-llm` still fails closed with no graph or deterministic
      fallback when the provider rejects a request.
- [x] AC-05: Focused, host, governance and Docker checks pass.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval

- **Decision**: approved
- **Evidence**: user message `kontynuuj` after the proposed redaction ticket
- **Date**: 2026-08-12

## Non-goals

- No change to models, limits, credentials, retries or fallback policy.
- No logging of the raw provider body for later redaction.
- No broad rewriting of non-provider diagnostics.
- No public interface or schema change.

## Verification evidence

- Focused OpenRouter suite: 21/21 passed, including both redaction cases.
- Complete host suite: 407 tests, 406 passed, 0 failed and one documented
  local JDK skip; the required CI job supplies its JDK.
- Gold v2: all gated precision/recall metrics 100%, forbidden diagnostics 0
  and repeated-run stability passed.
- Governance: `GOV-PASS`, zero errors and warnings.
- Docker smoke: passed; production image compiled the changed boundary.
- Paid `require-llm` reproduction: provider returned the weekly-limit failure;
  CLI and manifest retained the actionable reason with a redaction marker,
  contained no key-management path or raw fingerprint, published no graph and
  reported `effectiveMode=none`.
- The implementation history was corrected to preserve an independent
  plan-and-intent commit before the first code change; the final source tree
  remained identical.
- Koru, full hosted verification, required JDK and review-triggered governance
  passed on exact head `752292826de01d5f5ad8c505c265774a923a4ca1`.
- Independent `validator-agent` reviewed all three diff chunks with
  `openrouter/z-ai/glm-5.2`, returned `APPROVE` with no findings and submitted
  an exact-head approval.
- Protected PR #84 merged as
  `main@790b86791d64640d61d5228f1551d65dc0891640`; post-merge verify,
  governance, required JDK and Docker smoke passed.
