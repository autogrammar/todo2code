# Operator guide: Validator autonomy for `semcod/todo2code`

Companion to [AUTONOMY_AND_REFACTOR_PLAN.md](AUTONOMY_AND_REFACTOR_PLAN.md).
Use when a PR is blocked on merge / GOV-APPROVAL.

## Tool map (read first)

| Need | Tool | Repo |
| --- | --- | --- |
| Why blocked / what NEXT? | probe **`publication.gate`** | `subactor/twin-probes` |
| Freeze head + request App review | `bin/dispatch-direct-pr.sh` | `subactor/validator-agent` |
| Trusted APPROVE | `ifuri-validator-agent[bot]` | via validator-agent |
| Process contract | `publication-freeze.v1` | `subactor/skills-agent` |

Canonical docs:

- https://github.com/subactor/twin-probes/blob/main/docs/PUBLICATION_PROBE.md  
- https://github.com/subactor/twin-probes/blob/main/docs/ECOSYSTEM.md  
- https://github.com/subactor/validator-agent/blob/main/docs/PUBLICATION_FREEZE.md  

**`publication.gate` is not a separate service.** It is one probe file in
twin-probes. It never approves or merges.

## Quick triage

0. **GitHub Status:** if Actions is in major outage, wait. Local green tests
   do not unlock GOV-APPROVAL.
1. **Diagnose (optional):**
   ```bash
   cd ~/github/subactor/twin-probes
   node src/run.mjs --repo ~/github/semcod/todo2code --host todo2code \
     --only publication.gate
   ```
   Follow each finding’s **NEXT:** line.
2. **Is the PR attributable?** Body: `Ticket: ticket-NNN` and
   `Correlation ID: todo2code-pr-<n>-ticket-NNN`.
3. **Required checks green on exact head?**  
   `verify`, `Java adapter (JDK 17 required)`, `koru / code-review`.
4. **scan-direct** on validator-agent `main` + matrix leg `todo2code`?
5. **`DIRECT_PR_SCAN_ENABLED=true`** for scheduled live approve?
6. **App installed** on `semcod/todo2code`?
7. **No push** after you freeze a head for dispatch.

## Commands

### Diagnosis

```bash
cd ~/github/subactor/twin-probes
node src/run.mjs --repo ~/github/semcod/todo2code --host todo2code \
  --only publication.gate --out /tmp/pub-cycle.json
jq '.results[0].violations, .proposals' /tmp/pub-cycle.json
```

### Immediate review (one PR) — preferred

```bash
# DO NOT push to the PR until this finishes
~/github/subactor/validator-agent/bin/dispatch-direct-pr.sh \
  --owner semcod --name todo2code --pr 66 --ticket ticket-048 \
  --wait-checks --watch
```

### Manual dispatch (only if script unavailable)

```bash
HEAD=$(gh pr view 66 --repo semcod/todo2code --json headRefOid -q .headRefOid)
# re-read HEAD again immediately before this call
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

### Confirm bot review

```bash
gh api repos/semcod/todo2code/pulls/66/reviews \
  --jq '.[] | select(.user.login|test("validator";"i")) | {user:.user.login,state,commit_id}'
```

After APPROVE, wait for `pull_request_review` to re-run governance; do not push
empty commits solely to “wake” CI unless the event path is broken.

## Human fallback

A human in `trusted-reviewers` may approve the exact head. Prefer the App for
routine traffic.
