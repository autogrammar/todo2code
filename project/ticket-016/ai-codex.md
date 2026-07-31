---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-016
---
# Participant: codex (AI agent)

## Plan

1. Add a dependency-free PHP helper and common-envelope adapter.
2. Test positive facts, no-source skip, missing runtime and invalid syntax.
3. Run an isolated before/after pipeline on a PHP-bearing semcod repository.
4. Record exact evidence and run repository gates.

## Responsibility boundary

The adapter records syntax observations only. It does not infer user intent or
claim that token parsing exposes every semantic property of a complete PHP AST.
