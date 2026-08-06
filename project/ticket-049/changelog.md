# Ticket Changelog (ticket-049)

## [0.2.0] - 2026-08-06

- Documented external landings: freeze dispatcher (validator-agent #10),
  publication-freeze skill (skills-agent #11), **publication.gate** probe
  (twin-probes #1).
- Clarified that `publication.gate` is a twin-probes **probe** (not a separate
  product, not a trust root); linked ECOSYSTEM + PUBLICATION_PROBE + FREEZE docs.
- Updated operator guide: diagnose with publication.gate, then freeze dispatch;
  GitHub Actions major_outage handling.
- Extended refactor plan with phase B′ (measurement) and landed B1/B1b/B′1.

## [0.1.0] - 2026-08-06

- Scaffolded governance plan ticket for Validator autonomy audit.
- Wrote `AUTONOMY_AND_REFACTOR_PLAN.md` covering working layers, remaining
  GOV-APPROVAL blocker, agent false assumptions, ordered refactor phases A–D,
  and external validator-agent work.
- Wrote `OPERATOR_GUIDE.md` with triage steps and dispatch commands for
  `direct-pr` and `direct-scan`.
- Linked sibling tickets 050–052 for implementation follow-ups.
