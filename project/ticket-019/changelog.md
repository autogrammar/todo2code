# Ticket Changelog (ticket-019)

## [0.1.0] - 2026-08-01

- Initial governance scaffold created.
- No human participant identity or content was generated.
- Recorded the approved product choices: root `todo2code` distribution,
  SDK-only contents and removal of the nested Python manifest.
- Declared the shared `dist/` coexistence strategy and the unresolved Makefile
  scope conflict with active ticket-018.

## [Plan resumed] - 2026-08-04

- Recorded ticket-018 and ticket-035 as completed dependencies.
- Routed the atomic publication transaction to the integration workstream and
  removed the resolved ticket-018 conflict.
- Kept this commit plan-only before changing any package or build metadata.

## [Implementation] - 2026-08-04

- Added the root `todo2code` Python distribution manifest.
- Routed Goal versioning and `make python-wheel` through the root manifest.
- Removed the nested SDK manifest and updated installation/build documentation.

## [Validation] - 2026-08-04

- Built wheel and sdist from the root without changing the existing TypeScript
  build output; inspected the bounded archive members and passed Twine checks.
- Installed the wheel in a clean virtual environment, imported `todo2code` and
  `todo2code_sdk`, verified version 0.5.1 and confirmed zero runtime
  dependencies.
- Passed `make python-wheel`, Goal project detection, full application verify,
  SDK examples, Docker E2E core and the governance gate.
- Recorded a Goal 2.1.284 dry-run defect: the bounded PyPI upload executed even
  with `--dry-run`, publishing Python 0.5.1. The npm step failed authentication
  and registry verification found no npm release. No package was yanked.

## [Closure] - 2026-08-04

- Submitted implementation PR #28 at exact head `16c2276`.
- Passed protected verify, JDK 17 adapter, Koru and governance checks.
- Received deterministic Validator App approval with advisory model
  `openrouter/z-ai/glm-5.2`; the advisory release-process finding remains
  recorded without weakening the deterministic trust boundary.
- Merged the implementation as `main@e333ace` and marked the ticket DONE.
