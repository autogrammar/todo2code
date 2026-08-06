# Ticket Changelog (ticket-048)

## [0.2.0] - 2026-08-06

- Ticket-048 was approved and moved to `IN_PROGRESS / EDIT`.
- Removed both `process.env` fallbacks from `scripts/github-event-log.mjs`; the
  event path and repository now resolve only from explicit flags or the payload
  itself, and the missing-repository error names `--repository`.
- Added a workflow-validation case proving the adapter fails closed and writes
  nothing when `GITHUB_EVENT_PATH` and `GITHUB_REPOSITORY` are set in the
  child environment but the flags are absent.
- Documented the required flags and the deliberate absence of environment reads
  in `docs/EVENT_LOG_DSL.md`, including why an environment-reading acquisition
  boundary cannot be published in this repository.
- Verified `npm run verify:env` with `.env.example` byte-identical to the
  protected base, closing the unownable-path conflict at its cause.

## [0.1.0] - 2026-08-06

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Planned republication of the ticket-047 acquisition adapter from the
  protected base, with the plan commit strictly preceding implementation.
- Declared removal of the two `process.env` fallbacks in
  `scripts/github-event-log.mjs` as the cause-level fix for the unownable
  `.env.example` requirement.
- Carried the ticket-047 record across unchanged, including its explicit note
  that no Koru review or Validator attestation was ever obtained.
