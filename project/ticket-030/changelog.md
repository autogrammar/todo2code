# Ticket Changelog (ticket-030)

## [0.1.0] - 2026-08-04

- Initial governance scaffold created.
- No human participant identity or content was generated.

## [0.1.1] - 2026-08-04

- Repaired the stale Markdown/NL confidence-clamp source locations in the
  hierarchy test without changing production confidence behavior.
- Focused compiled NL LLM test passes 11/11. After rebasing onto `caf6551`, a
  clean build passes; the complete fresh suite exposes ten inherited relation
  and communication failures while the repaired hierarchy assertion stays
  green.
- Renumbered the unpublished ticket to 030 to avoid colliding with active PR #3.
