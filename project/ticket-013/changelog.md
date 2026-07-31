# Ticket Changelog (ticket-013)

## [Unreleased]

- Opened a controlled three-model Live LLM comparison against the Gemini 3.6
  Flash baseline.
- Selected Codestral 2508 after a 6/6 run at 57,129 ms and $0.037994; Gemini 3
  Flash Preview also passed, while DeepSeek V4 Pro crossed the 900-second cap.
- Added a real total-run cancellation signal and fresh-manifest guard.
- Added bounded concurrent Markdown enrichment. The same `weekly` workload
  improved from 218,741 ms to 53,362 ms without changing audit order.
- Verified Codestral on `weekly` and `nlp2uri`; kept all generated artifacts
  outside their worktrees.
