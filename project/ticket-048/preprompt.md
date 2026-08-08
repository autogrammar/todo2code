# Ticket preprompt

- **Task ID**: ticket-048
- **Task title**: Publish the GitHub event log adapter through governance
- **Created**: 2026-08-06T08:06:14Z

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.

Republish only the approved ticket-047 acquisition adapter and its bounded
evidence, with the two `process.env` fallbacks removed. Keep the plan commit
strictly before the implementation commit. Do not touch `.env.example`,
`.governance/**` or the pinned standard, do not widen workstream ownership, do
not edit workflows, and do not rewrite the carried-over ticket-047 record.
