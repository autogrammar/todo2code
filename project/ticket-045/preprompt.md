# Ticket preprompt

- **Task ID**: ticket-045
- **Task title**: Kanoniczny dziennik zdarzen logs.dsl.txt
- **Created**: 2026-08-05T11:12:54Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

## Architecture constraints

- `logs.dsl.txt` is a generated workflow/run artifact, not a file amended on
  `main` after merge.
- Use a closed `t2c.event-log/v1` grammar and canonical field order.
- Every event participates in one SHA-256 previous/event digest chain.
- Record references and digests, never secret values or raw LLM responses.
- Keep facts, human decisions and advisory inference distinguishable.
- This ticket changes only documentation and a canonical fixture; runtime and
  GitHub acquisition require a dependent ticket after this contract is merged.
