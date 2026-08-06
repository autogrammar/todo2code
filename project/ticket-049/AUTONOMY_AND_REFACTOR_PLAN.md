# Autonomy audit, operator guide, and refactor plan

**Ticket**: ticket-049  
**Date**: 2026-08-06 (updated same day after freeze + publication.gate landings)  
**Repos**: ticket-048 / PR #66 publication path; agent misconfiguration of
`subactor/validator-agent` "autonomy"

## 0. External documentation map (canonical)

| Topic | Repository | Path |
| --- | --- | --- |
| **publication.gate** (what / where / not trust) | `subactor/twin-probes` | `docs/PUBLICATION_PROBE.md`, `docs/ECOSYSTEM.md` |
| Exact-head freeze + dispatcher | `subactor/validator-agent` | `docs/PUBLICATION_FREEZE.md`, `bin/dispatch-direct-pr.sh` |
| Validator runbook | `subactor/validator-agent` | `docs/VALIDATOR_RUNBOOK.md` |
| Coding-agent skill | `subactor/skills-agent` | `SKILLS/0014_publication-freeze/`, process `publication-freeze.v1` |
| Grok skill | user home | `~/.grok/skills/publish-validate/SKILL.md` |

**`publication.gate` is a probe inside `twin-probes`, not a separate product.**
It measures open-PR readiness and emits NEXT tasks; it never approves or merges.

### Landed outside this ticket (2026-08-06)

- validator-agent PR #8: `scan-direct` + todo2code matrix  
- validator-agent PR #10: freeze dispatcher + PUBLICATION_FREEZE.md  
- skills-agent PR #11: publication-freeze.v1 + skill 0014  
- twin-probes PR #1: `publication.gate` probe + docs  

### Still blocking PR #66 (snapshot)

- No Validator APPROVE on current head  
- Hosted checks may be queued during **GitHub Actions major_outage** while
  local build/tests pass — wait for Actions, do not invent product defects  

---

## 1. What still does not work

### 1.1 Product and structure (working)

- Adapter behavior for ticket-048 is complete: no `process.env`, required
  flags, `SOURCE "github-actions"`, tests and docs updated.
- Host gates: `make verify`, `verify:env`, docker-smoke, CI-equivalent
  governance structure checks report pass for the PR head when Actions is
  healthy. Local focused tests: 10/10 on acquisition cases.
- Koru may fail on **attestation ID-token 503** during infra incidents even
  when the review body would pass.

### 1.2 Publication gate (not working)

Branch protection / governance still requires **trusted merge approval evidence**
bound to repository, PR, exact head, ticket and actor. Without a review from a
login in `trusted-reviewers` or a Bot in `trusted-validator-apps`,
`governance / enforce` ends in `GOV-APPROVAL-001/002` and merge stays
**BLOCKED**.

Markdown comments and agent narratives are **not** merge authorization
(AGENTS.md §12–13).

### 1.3 Autonomy path (partially fixed, still fragile)

| Failure mode | Why agents got it wrong | Status after 2026-08-06 work |
| --- | --- | --- |
| Set only `DIRECT_PR_SCAN_*` variables | Docs talk about variables; agents assumed that is sufficient | Variables alone never scheduled a todo2code review while `scan-direct` was **not on main** |
| Assume scheduled cron reviews every allowlisted repo | Matrix was hardcoded without `semcod/todo2code` | Fixed on validator-agent `main` (PR #8 + matrix commit) |
| Assume `DIRECT_PR_SCAN_CONFIG` repo variable is read by the workflow | Workflow embeds config in YAML env; Python reads `DIRECT_PR_SCAN_CONFIG` from process env injected by the job | Variable useful only if workflow assigns it; embedded baseline is source of truth today |
| Treat `direct-pr` form as the autonomous path | Form is manual; `scan-direct` was designed to replace it | Manual `direct-pr` remains the **fast path** for one PR; scan is **steady-state** autonomy |
| Queue saturation / Actions CDN outage | Cancelling peers + retries needed; agents reported "configured" while jobs never ran | Still real: 2026-08-06 **Actions major_outage** left check runs `queued`; use status.github.com + publication.gate NEXT=wait |
| twin-probes ignored / misused as trust root | Agents either never diagnosed or expected twin-probes to unlock merge | **publication.gate** landed for diagnosis; freeze + App remain trust path |
| Intent-conformance noise on validator-agent | Blocking diagnostics on large feature PRs slow landing | PR #8 merged despite unstable checks (private repo protection weak); not a model for todo2code |

### 1.4 What AI still needs to improve (process, not model)

1. **Config completeness checks**: before claiming autonomy, verify (a) job
   exists on `main`, (b) repository in **matrix**, (c) config entry, (d)
   allowlist, (e) App installed, (f) `DIRECT_PR_SCAN_ENABLED=true`, (g) required
   checks names match branch protection exactly.
2. **Distinguish dry-run from live**: `force=false` never publishes a review.
3. **Do not invent in-repo triggers** that make the reviewed PR approve itself
   (AGENTS.md trust root).
4. **Idempotent correlation IDs**: prefer body `Correlation ID:` without head
   suffix so re-pushes do not thrash identity (already applied on #66).
5. **Runner hygiene**: cancel obsolete checks after merge; avoid flooding the
   shared Actions pool when dispatching.
6. **False provenance**: never claim `github-api` (or any source) without a
   real producer path (fixed for the adapter; keep as a review rule).

---

## 2. Operator guide (how autonomy actually works)

### 2.1 Trust root (non-negotiable)

```
reviewed repository  ──x──>  must not trigger its own Validator approval
subactor/validator-agent  ──>  discovers / validates / reviews externally
```

- `project-queue`: `if-uri` only + Project #2 membership.
- `direct-pr`: named owner/name/PR/head/ticket/correlation; human or agent
  dispatch from **outside** the PR checkout.
- `scan-direct`: scheduled (or forced dispatch) matrix over allowlisted repos
  outside `if-uri`.

### 2.2 Steady-state autonomy for `semcod/todo2code`

1. `subactor/validator-agent` `main` contains `scan-direct` with matrix leg
   `semcod` / `todo2code`.
2. Job env `DIRECT_PR_SCAN_CONFIG` includes:

   ```json
   "semcod/todo2code": {
     "required_checks": [
       "verify",
       "Java adapter (JDK 17 required)",
       "koru / code-review"
     ],
     "allowed_base_branches": ["main"]
   }
   ```

3. Repo variable `DIRECT_PR_SCAN_ENABLED=true` (scheduled live path).
4. GitHub App with client id in `VALIDATOR_APP_CLIENT_ID` installed on
   `semcod/todo2code` with pull-request write.
5. PR body (strongest attribution) contains:

   ```text
   Ticket: ticket-NNN
   Correlation ID: todo2code-pr-<n>-ticket-NNN
   ```

6. PR is not draft; head is 40-char SHA; base is `main`; age within
   `BRANCH_MAX_AGE_DAYS`.
7. Required checks green; no prior Validator approval on that exact head.
8. Within ~5 minutes of the schedule, the bot posts a review; `ci.yml`
   re-runs on `pull_request_review` and GOV-APPROVAL can clear.

### 2.3 Immediate path for one PR

```bash
gh api -X POST repos/subactor/validator-agent/actions/workflows/validator.yml/dispatches \
  -f ref=main \
  -f 'inputs[strategy]=direct-pr' \
  -f 'inputs[repository_owner]=semcod' \
  -f 'inputs[repository_name]=todo2code' \
  -f 'inputs[pull_request]=66' \
  -f 'inputs[expected_head_sha]=<40-char-head>' \
  -f 'inputs[ticket]=ticket-048' \
  -f 'inputs[correlation_id]=todo2code-pr-66-ticket-048' \
  -f 'inputs[allowed_base]=main' \
  -f 'inputs[execution_profile]=production' \
  -f 'inputs[force]=true'
```

Dry-run first with `force=false` when validating a new config. Live review
requires `force=true`.

### 2.4 Anti-patterns (do not implement)

| Anti-pattern | Why |
| --- | --- |
| Workflow in `todo2code` that dispatches validator | PR-controlled trigger = untrusted evidence |
| Treating agent chat approval as merge auth | Markdown is audit only |
| Setting variables without matrix membership | Silent no-op |
| Correlation ID embedding head SHA | Breaks identity on every push |
| Recording `SOURCE "github-api"` for Actions payloads | False provenance |

---

## 3. Refactor plan (ordered)

### Phase A — unblock ticket-048 (now)

| # | Work | Owner repo | Ticket |
| --- | --- | --- | --- |
| A1 | Land trusted review on PR #66 exact head | `subactor/validator-agent` dispatch / human review | ticket-048 (VALIDATION) |
| A2 | Re-run governance on `pull_request_review`; merge | `semcod/todo2code` | ticket-048 |
| A3 | After merge: `git fetch && git reset --hard origin/main` on stale locals | operators | ops note |

### Phase B — durable autonomy (validator-agent)

| # | Work | Notes |
| --- | --- | --- |
| B1 | Keep `semcod/todo2code` in matrix + config | **Done** on main (PR #8) |
| B1b | Publication freeze script + docs | **Done** (PR #10) |
| B2 | Optionally read config from `vars.DIRECT_PR_SCAN_CONFIG` **merged** with embedded baseline (never replace wholesale with a partial var) | External PR |
| B3 | Separate concurrency groups for `direct-scan` vs `project-queue` | Avoid mutual queueing |
| B4 | Surface skip reasons as PR comments when dry-run finds candidates but live is off | Observability; also feed twin-probes publication.gate facts |
| B5 | Fix intent-conformance noise so feature PRs do not rely on weak branch protection | External |

### Phase B′ — measurement (twin-probes)

| # | Work | Notes |
| --- | --- | --- |
| B′1 | `publication.gate` probe + PUBLICATION_PROBE + ECOSYSTEM docs | **Done** (PR #1) |
| B′2 | Fleet/cron host for todo2code publication.gate | Follow-up |
| B′3 | Ingest scan-direct skip reasons + Actions infra facts | Follow-up |

### Phase C — todo2code governance ergonomics

| # | Work | Ticket |
| --- | --- | --- |
| C1 | Decide ownership of `CHANGELOG.md` and `.env.example` (own via standard bump, or explicit forever-exclude with agent-visible docs) | ticket-050 |
| C2 | Optional CI step that **invokes** `scripts/github-event-log.mjs` with explicit flags only (never ambient fallbacks) | ticket-051 |
| C3 | Commit operator checklist under governance-owned docs path or ticket evidence; link from AGENTS.md after approval | ticket-052 |

### Phase D — agent policy improvements

| # | Work | Where |
| --- | --- | --- |
| D1 | Pre-flight script or checklist in agent runbooks: matrix ∩ config ∩ enabled ∩ App | validator-agent docs + this plan |
| D2 | When GOV-APPROVAL blocks, agents must report exact missing actor class, not "wait for CI" | AGENTS.md cross-link (ticket-052) |
| D3 | Never propose in-repo auto-approve | already forbidden; restate in checklist |

---

## 4. Dependency graph

```text
ticket-048 (IN_PROGRESS / VALIDATION)
    │  needs trusted review on head
    ▼
merge #66 ──► enables clean main for follow-ups
    │
    ├─► ticket-050  unowned root paths (can plan in parallel)
    ├─► ticket-051  CI wiring of acquisition (after 048 merge preferred)
    └─► ticket-052  AGENTS / operator checklist (can plan in parallel)

External (not in this monorepo ticket ID space):
    validator-agent B2–B5
```

---

## 5. Verification commands (operators)

```bash
# Variables
gh variable list --repo subactor/validator-agent

# Main carries scan-direct + todo2code matrix
gh api repos/subactor/validator-agent/contents/.github/workflows/validator.yml?ref=main \
  --jq .content | base64 -d | rg 'scan-direct|todo2code'

# PR eligibility (manual)
gh pr view 66 --repo semcod/todo2code --json body,baseRefName,isDraft,headRefOid

# Reviews
gh api repos/semcod/todo2code/pulls/66/reviews --jq '.[]|{user:.user.login,state}'
```

---

## 6. Decision log

| Decision | Rationale |
| --- | --- |
| Do not add todo2code workflow that dispatches validator | Preserves external trust root (ticket-018 lineage) |
| Prefer body Ticket/Correlation lines | Fail-closed attribution; no guess from prose |
| Document variable+matrix dual gate | Prevents next agent from repeating the no-op config |
| Split 050–052 from 049 | Keeps plan ticket docs-only; implementation scopes separate |
