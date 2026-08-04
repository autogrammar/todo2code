# Preprompt: ticket-037

Implement only after explicit approval of `README.md` and `intent.json`.

- Keep the implementation dependency-free and inside the two declared files.
- Consume immutable evidence objects; do not execute Git or access GitHub.
- Reuse `t2c.graph/v1` and `t2c.truth-map/v1` fingerprints and citations.
- Keep deterministic findings authoritative and any future LLM explanation
  advisory.
- Fail closed on stale, incomplete, ambiguous or inconsistent bindings.
- Never emit or execute merge, rebase, push, close or delete operations.
- Do not use OpenRouter during implementation or tests. Gemini 3.1 Pro Preview
  remains prohibited; future advisory validation uses
  `openrouter/z-ai/glm-5.2`.
