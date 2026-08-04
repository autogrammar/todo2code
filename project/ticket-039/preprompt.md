# Preprompt: ticket-039

- **Task ID**: ticket-039
- **Task title**: Bounded immutable Git branch snapshot materializer
- **Created**: 2026-08-04T22:02:18Z

## Technical directives

1. Work only in the ticket-039 worktree and inside `intent.json.allowedPaths`.
2. Use Node's argument-vector process APIs; never interpolate a shell command.
3. Do not run `fetch`, `checkout`, `switch`, `merge`, `rebase`, `reset`, `push`,
   `update-ref`, `commit`, `clean` or another caller-repository mutation.
4. Treat branch/ref names as untrusted bounded inputs and pin every one to an
   exact 40-hex commit plus tree SHA.
5. Revalidate all names against the captured SHAs immediately before return.
6. Keep merge inspection writes, if Git requires them, in an isolated
   temporary object directory with the source object database as read-only
   alternates; always clean temporary state.
7. Do not invent semantic evidence, GitHub PR metadata or merge authority.
8. Do not use OpenRouter in tests or runtime. Hosted Validator advisory review
   must use `openrouter/z-ai/glm-5.2`, never Gemini 3.1 Pro Preview.
9. Keep executable code outside this ticket directory.

## Required evidence

- Offline fixture with disjoint, conflicting, cherry-equivalent and contained
  branches.
- Independent Git assertions for every captured SHA/count/patch fact.
- Before/after proof that caller HEAD, status, refs and object inventory did
  not change.
- Determinism and injected-failure cleanup tests.
- Focused, full, governance, complexity and Docker results.
