# Preprompt: ticket-041

- Keep the canonical public result limited to `t2c.branch/v1`.
- Validate ticket-039 materialization and every tree-keyed graph/truth-map
  bundle before deriving evidence.
- Reuse existing graph diff, truth-map and branch-portfolio validators.
- Never synthesize graph/truth-map fingerprints for missing analyses.
- Preserve textual and semantic uncertainty separately; ambiguity is
  `unknown`, not guessed clean/disjoint/ordered evidence.
- Keep PR identities empty until an exact-head GitHub boundary supplies them.
- Do not run Git, a pipeline, OpenRouter or network access in this ticket.
- Do not create worktrees, files, refs, commits, reviews or mutations from the
  assembler.
- Hosted Validator advisory review must use
  `openrouter/z-ai/glm-5.2`, never Gemini 3.1 Pro Preview.
- Required validation: focused offline assembler suite, full host verify,
  governance, Lizard and Docker core E2E.
