# Ticket 100: Preserve changes during watch reports

- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Owner**: agent:codex

User-authorized scope: complete PLF-13849 and blocking dependencies, including tests, push and independent protected merge. This is a session scope record (SESSION_EXECUTION_AUTHORIZATION), not approval or merge evidence.

The required verify job for todo2code #118 lost a file change after initial report publication. The watcher refreshes its entire baseline after report completion, silently absorbing concurrent source edits. Preserve source changes for the next poll and suppress only declared report outputs. Keep polling, throttling, cancellation and ignore boundaries.

Acceptance: a deterministic injected report that changes source triggers a follow-up report, including a failed report; generated outputs do not cause a feedback loop. Existing CLI integration and full verify pass. Scope is the watcher and its unit tests; no timeout increase or removal of assertions.

Canonical final evidence: https://github.com/subactor/docs/blob/main/architecture/analysis/autonomy-acceptance.md.

Validation: four deterministic regression cases failed before the fix; 15 watcher/CLI cases pass after it. Full verify: 448 passed, zero failed, one optional Java skip. Offline smoke and Docker smoke pass. Required hosted Java 17 and independent exact-head Validator approval remain publication gates.
