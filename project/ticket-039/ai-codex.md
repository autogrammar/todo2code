---
participant-id: agent:codex
participant: codex
role: agent
ticket: ticket-039
---
# Participant: codex (AI agent)

## Understanding

The completed `t2c.branch/v1` projector deliberately accepts immutable facts
instead of running Git. The next missing boundary is a local runtime observer
that pins moving names to exact SHAs, derives topology and textual-collision
facts, and detects ref movement without altering the user's repository.

The output is intentionally insufficient to authorize a merge: this ticket
does not claim semantic completeness or infer PR/reviewer state. Its value is
to make later todo2code, Goal, Koru and Validator consumers share one exact,
reproducible Git snapshot rather than resolving branches independently.

## Intent

- Preserve exact repository/base/head/tree/merge-base bindings.
- Make uncertainty explicit as `unknown`.
- Keep temporary merge inspection isolated from the repository object store.
- Produce stable topology and patch evidence suitable for later composition.
- Preserve all user refs, index and working-tree content byte-for-byte.

## Risks and controls

- **Ref time-of-check/time-of-use**: resolve all refs twice and reject movement.
- **Git option injection**: validate bounded names and use end-of-options where
  the selected Git command supports it.
- **Quadratic pair growth**: cap candidates at 32 and short-circuit disjoint
  changed-path sets without a merge simulation.
- **Repository mutation by merge inspection**: redirect temporary Git objects
  outside the repository and always clean them in `finally`.
- **False clean result**: command ambiguity or unsupported Git behavior yields
  `unknown`, never `clean`.
- **Semantic overclaim**: do not emit graph/truth-map or recommendation fields.

## Execution plan

1. Change ticket state to `IN_PROGRESS` / `EDIT` after explicit approval.
2. Implement strict input validation, exact ref capture and canonical output.
3. Add read-only topology, changed-path and stable patch-ID materialization.
4. Add isolated textual merge inspection and pair short-circuiting.
5. Re-resolve every ref and fail closed if the snapshot moved.
6. Test clean, conflict, duplicate patch, stale, reorder, ref-movement and
   cleanup cases in an offline temporary Git repository.
7. Run focused tests, full `npm run verify`, governance, Lizard and Docker core
   E2E; repair only files owned by this ticket.
8. Publish a protected PR and request Koru plus Validator review for the exact
   head using `openrouter/z-ai/glm-5.2`.

## Acceptance criteria understood

AC-01 through AC-10 in the ticket README are the complete acceptance boundary.
In particular, no public interface or cross-repository adapter is implied.

## Actual changes

- Governance scaffold and implementation plan approved by the user.
- Added `src/services/branch-snapshot.ts` with strict input validation, exact
  double-read ref capture, topology/patch evidence, isolated merge-tree
  inspection and canonical fingerprinting.
- Added `test/git-branch-snapshot.test.ts` with an offline seven-branch fixture
  covering disjoint work, textual conflict, equivalent patches, a contained
  behind-base branch, invalid inputs, determinism, ref movement and cleanup.
- Repaired the unique-work range from `base..head` to `merge-base..head` after
  the live `wellmanifest/new-project` audit showed reverse patch IDs on fully
  contained branches.
- Host, Docker, governance, complexity and live read-only validation pass.

## Blockers

- Protected Koru and Validator exact-head review remain before publication.
