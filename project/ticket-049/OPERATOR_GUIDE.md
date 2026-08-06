# Operator guide: Validator autonomy for `semcod/todo2code`

Companion to [AUTONOMY_AND_REFACTOR_PLAN.md](AUTONOMY_AND_REFACTOR_PLAN.md).
Use this when a PR is green except for `GOV-APPROVAL` and no bot review appears.

## Quick triage

1. **Is the PR attributable?** Body must contain `Ticket: ticket-NNN` (or
   branch `ticket/NNN-*` / title form). Prefer also
   `Correlation ID: todo2code-pr-<n>-ticket-NNN`.
2. **Are required checks green?** Names must match exactly:
   `verify`, `Java adapter (JDK 17 required)`, `koru / code-review`.
   Governance contexts are **not** required by the Validator App (cycle
   avoidance).
3. **Is `scan-direct` on validator-agent `main`?** If not, schedules only run
   `project-queue` (if-uri) and will never see this repo.
4. **Is `semcod/todo2code` in the scan matrix and config?** Config without a
   matrix leg never mints a token.
5. **Is `DIRECT_PR_SCAN_ENABLED=true`?** If false, scan reports candidates and
   approves nothing.
6. **Is the App installed on this repository?** Token step fails closed when
   missing.
7. **Did the latest scan/dispatch actually run?** Check Actions for
   `Service Unavailable` on action download and for multi-hour queues.

## Commands

### Immediate review (one PR)

```bash
HEAD=$(gh pr view 66 --repo semcod/todo2code --json headRefOid -q .headRefOid)
gh api -X POST repos/subactor/validator-agent/actions/workflows/validator.yml/dispatches \
  -f ref=main \
  -f 'inputs[strategy]=direct-pr' \
  -f 'inputs[repository_owner]=semcod' \
  -f 'inputs[repository_name]=todo2code' \
  -f 'inputs[pull_request]=66' \
  -f "inputs[expected_head_sha]=$HEAD" \
  -f 'inputs[ticket]=ticket-048' \
  -f 'inputs[correlation_id]=todo2code-pr-66-ticket-048' \
  -f 'inputs[allowed_base]=main' \
  -f 'inputs[execution_profile]=production' \
  -f 'inputs[force]=true'
```

### Force a full live scan cycle

```bash
gh api -X POST repos/subactor/validator-agent/actions/workflows/validator.yml/dispatches \
  -f ref=main \
  -f 'inputs[strategy]=direct-scan' \
  -f 'inputs[force]=true' \
  -f 'inputs[max_pull_requests]=3' \
  -f 'inputs[execution_profile]=production'
```

### Confirm bot review

```bash
gh api repos/semcod/todo2code/pulls/66/reviews \
  --jq '.[] | select(.user.login|test("validator";"i")) | {user:.user.login,state,commit_id}'
```

After a successful review, wait for `pull_request_review` to re-trigger
`ci.yml`; do not push empty commits solely to "wake" governance unless the
event path is broken.

## Human fallback

A human in the protected `trusted-reviewers` set may approve the exact head.
That is still valid merge evidence. Prefer the App for routine traffic so the
boundary stays automated and consistent.
