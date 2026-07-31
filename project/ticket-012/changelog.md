# Ticket Changelog (ticket-012)

## [Unreleased]

- Replaced opaque live model routing with an explicit structured-output model.
- Preserved provider metadata for rejected structured responses.
- Included the current run in persisted and rendered live history.
- Aligned live request timeout with the configured per-stage budget.
- Added one strict, audited corrective attempt to NL, Markdown, documentation
  and communication extraction.
- Selected `google/gemini-3.6-flash` after a measured 6/6 live pass.
