# Ticket 011 audit

## Before

- `shared_symbol` compared aliases pairwise and did not count AST owners.
- A short NL symbol declared in two modules could link to both modules.
- `AMBIGUOUS_REQUIREMENT` repeated field names but gave no field-specific edit.
- Backticked `manifest.json`/`latest.json` and plain `LLM`, `TODO`, `CHANGELOG`
  could enter `target.symbols`; `CHANGELOG` found an unrelated AST owner.

## Repository census

| Repository | AST records | Leaf aliases with multiple source owners |
|---|---:|---:|
| todo2code | 15,607 | 155 |
| subactor-improvement | 865 | 2 (`spawn`, `summarize`) |
| wellmanifest/new-project | 0 | 0 (documentation-only repository) |

On todo2code's tracked `TASK.md`, implicit symbol candidates fell from 7 to 2.
The five removed values were file names or all-caps prose; the remaining
`TensorFlow` and `TypeScript` are unresolved product/code names and therefore
create neither AST evidence nor an ambiguity claim.

## Resolution contract

| State | Link behavior | Diagnostic behavior |
|---|---|---|
| one AST path | allow exact `shared_symbol` evidence | no ambiguity |
| several AST paths | abstain unless path/qualifier selects one | list candidates; request `target.path` |
| explicit path conflicts | abstain | list observed locations; request path correction |
| no AST declaration | no symbol evidence | ordinary planned-not-implemented, not ambiguity |

## Verification

| Gate | Result |
|---|---|
| `npm run verify` | PASS — 277 tests, 276 pass, 0 fail, 1 JDK skip |
| Module boundary | PASS — 101 modules, 467 imports, 0 cycles |
| No-LLM boundary | PASS — 9 entrypoints across 34 modules |
| Resolver tests | PASS — 6/6 unique, ambiguous, path, qualified, conflict and missing-fields cases |
| Gold v2 | PASS — extraction 21/21, linking 18/18 (10 exact-target, 8 capability-topic), diagnostics 11/11 |
| Gold v1 | PASS — legacy dataset remains 100% |
| Examples | PASS — 5 SDK, graph fingerprint `1dacf2edc8d603a2` |

The examples graph fell from 101 to 91 relations while preserving 227 records.
The removed edges are the intended effect of abstaining from ambiguous NL↔AST
symbol ownership; all versioned gold expectations remain perfect.
