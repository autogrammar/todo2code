# Ticket Changelog (ticket-085)

## [0.1.0] - 2026-08-25

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Bound the approved extractor-only implementation and regression scope.
- Scoped criterion-only documentation records to their governed source ticket
  and preserved explicit external ticket references.
- Passed focused, full host, Docker and governance verification.

## [0.2.0] - 2026-08-25

- Reopened from live `PLF-8091` comparison evidence.
- Prevented governed participant Markdown from entering both communication and
  documentation lanes and creating polarity-based self-conflicts.
- Preserved ticket README documentation and typed participant extraction.
- Passed 7/7 focused tests, full verification (425 pass, one JDK-only skip),
  governance, Docker smoke and the exact `PLF-8091` large-graph replay.
- The live replay reduced blocking diagnostics from 13 to 12 instead of adding
  the prior participant self-conflicts.
