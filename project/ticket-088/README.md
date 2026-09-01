# Ticket 088: Do not contradict overlapping same-source excerpts

- **ID**: ticket-088
- **Owner**: Founder session request (user:tom)
- **Status**: DONE
- **Workflow state**: DONE
- **Created**: 2026-08-26

## Goal and scope

Prevent the linker from emitting a blocking contradiction when two deterministic
extractors project overlapping excerpts from the same source location and one
excerpt ends before the full sentence's negation. Preserve genuine conflicts
between disjoint statements and different sources.

## Acceptance criteria

- [x] AC-01: The active Founder request authorizes continued autonomy repair,
      protected publication and deployment.
- [x] AC-02: Opposite-polarity records from the same normalized source path and
      overlapping line range cannot produce `contradicts`.
- [x] AC-03: Opposite-polarity records from distinct sources can still produce
      a blocking contradiction when semantic evidence clears the threshold.
- [x] AC-04: The exact PLF-8307 replay has no new blocking delta for AC-03 /
      TICKET-071.
- [x] AC-05: Focused, full Node, governance, Docker and whitespace gates pass.

## Participants

- Human participant: user:tom through the active session request; no user-* file
  was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Protected delivery evidence

- Pull request: `autogrammar/todo2code#103`
- Approved implementation HEAD: `a37f4020c0f0719cbb1a9336c9d03b895071972d`
- Protected merge commit: `89e72ce991e3f2518b323d2d5e45ff7368b46acf`
- Trusted reviewer: `ifuri-validator-agent[bot]`, bound to `ticket-088` and
  the exact implementation HEAD
- Merged at: `2026-08-26T01:09:01Z`
- Implementation branch `ticket/088-same-source-conflict` is absent from the
  remote after merge.
