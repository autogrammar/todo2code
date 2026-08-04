#!/usr/bin/env bash
# Universal ticket scaffolder for target System X repositories.

set -euo pipefail

TITLE="New Task Ticket"
USERS=""
AGENT="antigravity"
WORKSTREAM=""
TARGET_BRANCH="main"
COMPLEXITY="XS"
ESTIMATED_MINUTES=10
FORCE_NEW=false

usage() {
  cat <<'EOF'
Usage: ./project/new-ticket.sh [options]

  -t, --title TITLE       Ticket title
  -a, --agent ID         Agent provider/id used for ai-{ID}.md
  -w, --workstream ID    Required workstream declared in the governance manifest
      --target-branch ID Approved target branch (default: main)
      --complexity CLASS XS (<=10 minutes) or S (<=30 minutes)
      --minutes N        Estimated active implementation minutes (default: 10)
  -u, --users IDS        Compatibility input only; human files are not created
      --force-new        Create a new ticket despite an unfinished ticket
  -h, --help             Show this help

Only a human may authorize --force-new. Human-owned user-*.md files must be
created and written by that human or by a trusted intake boundary.
EOF
}

require_value() {
  if [[ $# -lt 2 || -z "${2:-}" ]]; then
    echo "Missing value for $1" >&2
    usage >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--title)
      require_value "$@"
      TITLE="$2"
      shift 2
      ;;
    -u|--users)
      require_value "$@"
      USERS="$2"
      shift 2
      ;;
    -a|--agent)
      require_value "$@"
      AGENT="$2"
      shift 2
      ;;
    -w|--workstream)
      require_value "$@"
      WORKSTREAM="$2"
      shift 2
      ;;
    --target-branch)
      require_value "$@"
      TARGET_BRANCH="$2"
      shift 2
      ;;
    --complexity)
      require_value "$@"
      COMPLEXITY="$(printf '%s' "$2" | tr '[:lower:]' '[:upper:]')"
      shift 2
      ;;
    --minutes)
      require_value "$@"
      ESTIMATED_MINUTES="$2"
      shift 2
      ;;
    --force-new)
      FORCE_NEW=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$TITLE" == *$'\n'* || "$TITLE" == *$'\r'* ]]; then
  echo "Ticket title must fit on one line" >&2
  exit 2
fi

AGENT="$(printf '%s' "$AGENT" | tr '[:upper:]' '[:lower:]')"
if [[ ! "$AGENT" =~ ^[a-z0-9][a-z0-9._-]*$ ]]; then
  echo "Agent id must match [a-z0-9][a-z0-9._-]*" >&2
  exit 2
fi

if [[ -z "$WORKSTREAM" ]]; then
  echo "Workstream is required; choose an id declared in .governance/manifest.json" >&2
  exit 2
fi

WORKSTREAM="$(printf '%s' "$WORKSTREAM" | tr '[:upper:]' '[:lower:]')"
if [[ ! "$WORKSTREAM" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Workstream id must match [a-z0-9][a-z0-9-]*" >&2
  exit 2
fi

if ! git check-ref-format --branch "$TARGET_BRANCH" >/dev/null 2>&1; then
  echo "Target branch is not a safe Git branch name" >&2
  exit 2
fi

if [[ "$COMPLEXITY" != "XS" && "$COMPLEXITY" != "S" ]]; then
  echo "Complexity must be XS or S" >&2
  exit 2
fi
if [[ ! "$ESTIMATED_MINUTES" =~ ^[0-9]+$ ]] || (( ESTIMATED_MINUTES < 1 || ESTIMATED_MINUTES > 30 )); then
  echo "Estimated minutes must be an integer between 1 and 30" >&2
  exit 2
fi
if [[ "$COMPLEXITY" == "XS" ]] && (( ESTIMATED_MINUTES > 10 )); then
  echo "XS work must fit within 10 minutes; use S or split the outcome" >&2
  exit 2
fi

accepted_base_sha="0000000000000000000000000000000000000000"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  accepted_base_sha="$(
    git rev-parse --verify "refs/remotes/origin/$TARGET_BRANCH^{commit}" 2>/dev/null \
      || git rev-parse --verify "refs/heads/$TARGET_BRANCH^{commit}" 2>/dev/null \
      || git rev-parse --verify "HEAD^{commit}"
  )"
fi

is_closed_ticket() {
  local readme="$1/README.md"
  [[ -f "$readme" ]] && grep -Eiq '^-[[:space:]]+\*\*Status\*\*:[[:space:]]*(DONE|CANCELLED)([[:space:]]|$)' "$readme"
}

highest=0
conflicting_ticket=""
if [[ -d project ]]; then
  for dir in project/ticket-*; do
    [[ -d "$dir" ]] || continue
    number="${dir##*-}"
    [[ "$number" =~ ^[0-9]+$ ]] || continue
    decimal=$((10#$number))
    (( decimal > highest )) && highest=$decimal
    if ! is_closed_ticket "$dir"; then
      active_workstream="$(sed -nE 's/^[[:space:]]*"workstream"[[:space:]]*:[[:space:]]*"([a-z0-9-]+)".*/\1/p' "$dir/intent.json" 2>/dev/null | head -n 1)"
      if [[ -z "$active_workstream" || "$active_workstream" == "unresolved" || "$WORKSTREAM" == "unresolved" || "$active_workstream" == "$WORKSTREAM" ]]; then
        conflicting_ticket="$dir"
      fi
    fi
  done
fi

if [[ -n "$conflicting_ticket" && "$FORCE_NEW" != true ]]; then
  echo "Active ticket conflicts with workstream '$WORKSTREAM': $conflicting_ticket" >&2
  echo "Continue it, choose a distinct declared workstream, close/cancel it, or use --force-new after an explicit human decision." >&2
  exit 3
fi

next_num=$((highest + 1))
ticket_num="$(printf '%03d' "$next_num")"
ticket_id="ticket-$ticket_num"
ticket_dir="project/$ticket_id"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
date_only="${timestamp%%T*}"
agent_file="ai-$AGENT.md"
agent_log="ai-$AGENT-logs.txt"

mkdir -p "$ticket_dir"

escape_sed() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//&/\\&}"
  value="${value//|/\\|}"
  printf '%s' "$value"
}

render_template() {
  local source="$1"
  local target="$2"
  sed \
    -e "s|{TICKET_ID}|$(escape_sed "$ticket_id")|g" \
    -e "s|{NNN}|$(escape_sed "$ticket_num")|g" \
    -e "s|{SHORT_TITLE}|$(escape_sed "$TITLE")|g" \
    -e "s|{TIMESTAMP}|$(escape_sed "$timestamp")|g" \
    -e "s|{YYYY-MM-DD}|$(escape_sed "$date_only")|g" \
    -e "s|{OWNER_NAME}|unresolved:human|g" \
    -e "s|{PROVIDER}|$(escape_sed "$AGENT")|g" \
    -e "s|{WORKSTREAM}|$(escape_sed "$WORKSTREAM")|g" \
    -e "s|{TARGET_BRANCH}|$(escape_sed "$TARGET_BRANCH")|g" \
    -e "s|{ACCEPTED_BASE_SHA}|$(escape_sed "$accepted_base_sha")|g" \
    -e "s|{COMPLEXITY}|$(escape_sed "$COMPLEXITY")|g" \
    -e "s|{ESTIMATED_MINUTES}|$(escape_sed "$ESTIMATED_MINUTES")|g" \
    "$source" > "$target"
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

render_json_template() {
  local source="$1"
  local target="$2"
  sed \
    -e "s|{TICKET_ID}|$(escape_sed "$(json_escape "$ticket_id")")|g" \
    -e "s|{NNN}|$(escape_sed "$(json_escape "$ticket_num")")|g" \
    -e "s|{SHORT_TITLE}|$(escape_sed "$(json_escape "$TITLE")")|g" \
    -e "s|{TIMESTAMP}|$(escape_sed "$(json_escape "$timestamp")")|g" \
    -e "s|{YYYY-MM-DD}|$(escape_sed "$(json_escape "$date_only")")|g" \
    -e "s|{PROVIDER}|$(escape_sed "$(json_escape "$AGENT")")|g" \
    -e "s|{WORKSTREAM}|$(escape_sed "$(json_escape "$WORKSTREAM")")|g" \
    -e "s|{TARGET_BRANCH}|$(escape_sed "$(json_escape "$TARGET_BRANCH")")|g" \
    -e "s|{ACCEPTED_BASE_SHA}|$(escape_sed "$(json_escape "$accepted_base_sha")")|g" \
    -e "s|{COMPLEXITY}|$(escape_sed "$(json_escape "$COMPLEXITY")")|g" \
    -e "s|{ESTIMATED_MINUTES}|$(escape_sed "$ESTIMATED_MINUTES")|g" \
    "$source" > "$target"
}

if [[ -f template/files/ticket.template.md ]]; then
  render_template template/files/ticket.template.md "$ticket_dir/README.md"
else
  cat > "$ticket_dir/README.md" <<EOF
# Ticket $ticket_num: $TITLE

- **ID**: $ticket_id
- **Owner**: unresolved:human
- **Status**: PLAN
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: $date_only

## Goal and scope

To be completed from human-owned input.

## Acceptance criteria

- [ ] AC-01: Scope is approved by a human owner.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [$agent_file]($agent_file)
EOF
fi

if [[ -f template/files/preprompt.template.md ]]; then
  render_template template/files/preprompt.template.md "$ticket_dir/preprompt.md"
else
  cat > "$ticket_dir/preprompt.md" <<EOF
# Ticket preprompt

- **Task ID**: $ticket_id
- **Task title**: $TITLE
- **Created**: $timestamp

Keep executable implementation outside this governance/evidence directory.
Read a human-owned user-*.md file only when one exists.
EOF
fi

if [[ -f template/files/intent.template.json ]]; then
  render_json_template template/files/intent.template.json "$ticket_dir/intent.json"
else
  cat > "$ticket_dir/intent.json" <<EOF
{
  "schema": "new-project.intent/v2",
  "ticket": "$ticket_id",
  "summary": "$(json_escape "$TITLE")",
  "workstream": "$WORKSTREAM",
  "allowedPaths": ["project/$ticket_id/**", "TODO.md", "project/TICKETS.md"],
  "forbiddenPaths": ["project/ticket-*/user-*.md"],
  "stacks": [],
  "dependsOn": [],
  "conflictsWith": [],
  "integrationTicket": null,
  "delivery": {
    "acceptedBaseSha": "$accepted_base_sha",
    "targetBranch": "$(json_escape "$TARGET_BRANCH")",
    "outcome": "$(json_escape "$TITLE")",
    "nonGoals": ["No work outside the approved allowed paths"],
    "complexity": "$COMPLEXITY",
    "estimatedMinutes": $ESTIMATED_MINUTES,
    "budgets": {
      "maxImplementationFiles": 5,
      "maxAffectedComponents": 2,
      "maxPublicInterfaceChanges": 0,
      "maxRuntimeDependencies": 0
    },
    "architecture": {
      "status": "accepted",
      "decision": "Keep the initial plan inside the governance component until scope approval",
      "components": [{"name": "governance", "paths": ["project/$ticket_id/**", "TODO.md", "project/TICKETS.md"]}],
      "responsibilityChanges": false,
      "interfaceChanges": [],
      "dataChanges": [],
      "ui": {"impact": "none", "states": [], "evidence": []},
      "rollback": "Revert the bounded implementation slice"
    },
    "runtimeDependencies": [],
    "validation": [{
      "criterion": "AC-01",
      "commands": ["./project/governance-check.sh --actor agent"],
      "evidence": "Governance and ticket-specific tests pass"
    }]
  }
}
EOF
fi

if [[ -f template/files/agent-participant.template.md ]]; then
  render_template template/files/agent-participant.template.md "$ticket_dir/$agent_file"
else
  cat > "$ticket_dir/$agent_file" <<EOF
---
participant-id: agent:$AGENT
participant: $AGENT
role: agent
ticket: $ticket_id
---
# Participant: $AGENT (AI agent)

## Understanding

To be completed after reading human-owned input and the ticket preprompt.

## Execution plan

1. Validate the ticket scope and acceptance evidence before implementation.

## Actual changes

- None; waiting for approval.

## Blockers

- Human approval is required before implementation.
EOF
fi

: > "$ticket_dir/$agent_log"

cat > "$ticket_dir/changelog.md" <<EOF
# Ticket Changelog ($ticket_id)

## [0.1.0] - $date_only

- Initial governance scaffold created.
- No human participant identity or content was generated.
EOF

if [[ -n "$USERS" ]]; then
  echo "warning: --users=$USERS did not create user-* files; human-owned input must come from a human or trusted intake boundary" >&2
fi

if [[ -f project/readme.sh ]]; then
  bash ./project/readme.sh
fi

echo "Successfully scaffolded $ticket_dir for '$TITLE'."
