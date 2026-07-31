# Ticket 016 audit

## Boundary

The host has PHP 8.4 but no `ext-ast`. Pulling a Composer parser into the Node
core would add a second dependency graph. The adapter therefore uses PHP's
built-in `token_get_all` with `TOKEN_PARSE`: syntax errors are real parser
errors, while the emitted evidence is accurately named `php_syntax_tokens`,
not a full AST.

It emits bounded source facts for namespace, `use`, class/interface/trait/enum,
named function, qualified method and call sites. Identical calls on the same
source line collapse to one semantic fact. Paths come from the same ignore
matcher as the other adapters and cross the helper boundary through a private
manifest.

## External A/B

Both deterministic pipelines read the same current `semcod/redsl` worktree and
wrote disposable artifacts outside that worktree. All non-PHP external adapters
were disabled.

| Metric | PHP disabled | PHP enabled | Delta |
|---|---:|---:|---:|
| Tracked PHP files discovered | 40 unsupported | 40 parsed | — |
| Graph records | 2,128 | 4,255 | +2,127 |
| Graph relations | 3,436 | 3,516 | +80 |
| Warning diagnostics | 730 | 712 | -18 |
| Code-change plans | 1 | 1 | 0 |
| Extraction warnings | 1 unsupported-language | 0 | -1 |

The stable plan count matters: adding implementation evidence reduced false
warnings without hiding the remaining actionable plan.

The repository gate passed with 304 tests (303 pass, 1 local JDK skip), both
gold datasets stayed at 100%, and `examples:check` passed for all five SDKs.
