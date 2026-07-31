# Ticket 016: First-class PHP syntax evidence

- **ID**: ticket-016
- **Owner**: agent:codex
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-07-31

## Goal and scope

Replace the explicit PHP unsupported-language warning with deterministic,
source-grounded syntax facts without adding a Composer dependency to the core.

Runtime implementation belongs under `src/` and `php/`; this directory holds
only the ticket contract and redacted evidence.

## Acceptance criteria

- [x] PHP namespace, imports, types, functions, methods and calls become facts.
- [x] Source selection uses the repository ignore matcher and manifest cache.
- [x] No matching files avoid starting PHP; missing PHP and parse errors fail open.
- [x] The adapter is visible in config, manifests, `doctor` and the public API.
- [x] A controlled external-repository A/B demonstrates the semantic effect.
- [x] Full verification, both gold datasets and all examples pass.

## Participants

- Technical evidence and implementation: [`ai-codex.md`](ai-codex.md).
- No human semantic decision is required; this ticket adds observed evidence.

## Evidence

- [`audit.md`](audit.md)
- [`ai-codex-logs.txt`](ai-codex-logs.txt)
