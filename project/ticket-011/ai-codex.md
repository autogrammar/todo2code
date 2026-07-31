---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-011
---
# Participant: codex (AI agent)

## Understanding

The linker already compares symbol aliases, but it treats a shared leaf as
proof even when several files declare it. This can turn an ambiguous request
into several implementation relations and hide the absence of a selected
target. Resolution must use observed AST ownership and abstain on ties.

## Execution plan

1. Census symbol ownership and current NL extraction noise.
2. Add an AST-backed symbol-resolution index used by linking and diagnostics.
3. Preserve unique/qualified/path-selected matches and reject ambiguous or
   conflicting matches.
4. Make missing-field actions concrete and reduce false symbol candidates.
5. Add unit and gold hard-negative cases, verify and publish `main`.

## Blockers

- None for the deterministic scope.

## Actual changes

- Added a graph symbol-resolution index over AST declarations.
- Gated NL↔AST shared-symbol evidence on unique ownership or explicit path.
- Added candidate-aware ambiguity/conflict diagnostics.
- Removed file names and all-caps prose from implicit symbol extraction.
- Added six focused resolver tests and three gold linking cases.
