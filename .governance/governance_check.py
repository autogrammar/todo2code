#!/usr/bin/env python3
"""Deterministic policy-as-code validator for new-project target repositories."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

RUNTIME_VERSION = "0.8.0"
ACTIVE_DEFAULT = {"PLAN", "IN_PROGRESS", "BLOCKED"}
EXECUTABLE_SUFFIXES = {
    ".bat", ".c", ".cc", ".cmd", ".cpp", ".go", ".java", ".js", ".jsx",
    ".mjs", ".php", ".ps1", ".py", ".rb", ".rs", ".sh", ".ts", ".tsx",
}
SECRET_RE = re.compile(
    r"(?i)(api[_-]?key|access[_-]?key|client[_-]?secret|password|private[_-]?key|token)"
    r"[ \t]*[:=][ \t]*['\"]?([A-Za-z0-9_./+=-]{12,})"
)
SAFE_SECRET_VALUES = re.compile(r"(?i)^(example|placeholder|changeme|your[_-]|\$\{|<|xxx|test)")
LOCAL_PATH_RE = re.compile(r"(?:[A-Za-z]:[\\/](?:Users|Documents|Desktop)[\\/]|/(?:home|Users)/[^/\s]+/)")


@dataclass(order=True)
class Finding:
    code: str
    severity: str
    message: str
    remediation: str
    paths: list[str] = field(default_factory=list, compare=False)
    evidence: dict[str, Any] = field(default_factory=dict, compare=False)


@dataclass
class TicketRecord:
    directory: Path
    status: str | None
    workflow: str | None
    intent: dict[str, Any] | None
    intent_error: str | None


class Report:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.findings: list[Finding] = []

    def add(
        self,
        code: str,
        message: str,
        remediation: str,
        paths: Iterable[str] = (),
        evidence: dict[str, Any] | None = None,
        severity: str = "error",
    ) -> None:
        self.findings.append(Finding(
            code=code,
            severity=severity,
            message=message,
            remediation=remediation,
            paths=sorted(set(paths)),
            evidence=evidence or {},
        ))

    @property
    def errors(self) -> int:
        return sum(item.severity == "error" for item in self.findings)

    def payload(self) -> dict[str, Any]:
        findings = sorted(self.findings)
        return {
            "schema": "new-project.governance-report/v1",
            "runtimeVersion": RUNTIME_VERSION,
            "root": ".",
            "status": "passed" if self.errors == 0 else "failed",
            "summary": {
                "errors": self.errors,
                "warnings": sum(item.severity == "warning" for item in findings),
                "findings": len(findings),
            },
            "findings": [asdict(item) for item in findings],
        }


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def rel(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def safe_repo_path(root: Path, raw: str) -> Path:
    candidate = (root / raw).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(f"path escapes repository: {raw}") from error
    return candidate


def matches(path: str, patterns: Iterable[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)


def git_output(root: Path, args: list[str]) -> bytes:
    return subprocess.run(
        ["git", *args], cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    ).stdout


def changed_paths(root: Path, base: str | None, head: str, explicit: list[str]) -> list[str]:
    if explicit:
        return sorted(set(path.replace("\\", "/").removeprefix("./") for path in explicit if path))
    try:
        if base:
            raw = git_output(root, ["diff", "--name-only", "-z", f"{base}...{head}"])
            paths = raw.decode("utf-8", "surrogateescape").split("\0")
        else:
            tracked = git_output(root, ["diff", "--name-only", "-z", "HEAD"])
            untracked = git_output(root, ["ls-files", "--others", "--exclude-standard", "-z"])
            paths = (tracked + untracked).decode("utf-8", "surrogateescape").split("\0")
        return sorted(set(path for path in paths if path))
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []


def check_history_order(
    root: Path,
    base: str | None,
    head: str,
    ticket_name: str,
    intent_path: str,
    governance_patterns: list[str],
    report: Report,
) -> None:
    if not base:
        return
    try:
        commits = git_output(root, ["rev-list", "--reverse", f"{base}..{head}"]).decode().splitlines()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return
    first_implementation: tuple[int, str] | None = None
    for index, commit in enumerate(commits):
        try:
            raw = git_output(root, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "-z", commit])
        except subprocess.CalledProcessError:
            continue
        paths = [path for path in raw.decode("utf-8", "surrogateescape").split("\0") if path]
        if any(not matches(path, governance_patterns) for path in paths):
            first_implementation = (index, commit)
            break
    if first_implementation is None:
        return
    index, commit = first_implementation
    parent = f"{commit}^" if index > 0 else base
    ticket_intent = f"project/{ticket_name}/{intent_path}"
    try:
        subprocess.run(
            ["git", "cat-file", "-e", f"{parent}:{ticket_intent}"], cwd=root,
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        report.add(
            "GOV-INTENT-003",
            f"{ticket_intent} did not exist before the first implementation commit.",
            "Commit the plan-only ticket and intent first; start implementation in a later commit after review.",
            [ticket_intent], {"firstImplementationCommit": commit},
        )


def basic_manifest_valid(manifest: Any) -> bool:
    if not isinstance(manifest, dict) or manifest.get("schema") not in {
        "new-project.governance/v1", "new-project.governance/v2",
    }:
        return False
    standard = manifest.get("standard")
    ticket = manifest.get("ticket")
    docker = manifest.get("docker")
    common_valid = (
        isinstance(standard, dict)
        and standard.get("id") == "wellmanifest/new-project"
        and isinstance(standard.get("version"), str)
        and isinstance(manifest.get("requiredFiles"), list)
        and isinstance(manifest.get("governancePaths"), list)
        and isinstance(manifest.get("trustedApprovalSources"), list)
        and isinstance(ticket, dict)
        and all(key in ticket for key in (
            "root", "directoryPattern", "requiredFiles", "requiredAgentFiles",
            "activeStatuses", "closedStatuses", "implementationStates", "intentFile",
        ))
        and isinstance(docker, dict)
        and all(key in docker for key in ("required", "dockerfiles", "composeFiles"))
    )
    if not common_valid or manifest.get("schema") == "new-project.governance/v1":
        return common_valid
    coordination = manifest.get("coordination")
    return (
        isinstance(coordination, dict)
        and coordination.get("mode") == "workstreams"
        and isinstance(coordination.get("maxActiveTicketsPerWorkstream"), int)
        and coordination["maxActiveTicketsPerWorkstream"] >= 1
        and isinstance(coordination.get("rejectActiveScopeOverlap"), bool)
        and isinstance(coordination.get("workstreams"), dict)
        and bool(coordination["workstreams"])
        and all(
            isinstance(item, dict)
            and isinstance(item.get("ownedPaths"), list)
            and bool(item["ownedPaths"])
            for item in coordination["workstreams"].values()
        )
        and isinstance(coordination.get("integration"), dict)
        and isinstance(coordination["integration"].get("workstream"), str)
        and isinstance(coordination["integration"].get("requiredForPaths"), list)
        and coordination["integration"]["workstream"] in coordination["workstreams"]
    )


def check_lock(root: Path, lock_path: Path | None, report: Report) -> None:
    if lock_path is None:
        return
    if not lock_path.is_file():
        report.add(
            "GOV-SYNC-001", "Governance lock file is missing.",
            "Copy the versioned manifest lock from the approved standard adoption.",
            [rel(root, lock_path)] if lock_path.is_relative_to(root) else [],
        )
        return
    try:
        lock = load_json(lock_path)
        managed = lock["managedFiles"]
        if lock.get("schema") != "new-project.lock/v1" or not isinstance(managed, dict):
            raise ValueError("unsupported lock schema")
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        report.add("GOV-SYNC-001", f"Governance lock is invalid: {error}", "Regenerate the lock from a trusted standard release.", [rel(root, lock_path)])
        return
    for raw_path, expected in sorted(managed.items()):
        try:
            path = safe_repo_path(root, raw_path)
        except ValueError as error:
            report.add("GOV-SYNC-001", str(error), "Use repository-relative managed paths.", [raw_path])
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
        if actual != expected:
            report.add(
                "GOV-SYNC-001", f"Managed governance file digest differs: {raw_path}",
                "Restore the pinned file or perform an explicit standard upgrade and regenerate the lock.",
                [raw_path], {"expectedSha256": expected, "actualSha256": actual},
            )


def parse_ticket_state(readme: Path) -> tuple[str | None, str | None]:
    try:
        text = readme.read_text(encoding="utf-8")
    except OSError:
        return None, None
    status_match = re.search(r"(?mi)^-[ \t]+\*\*Status\*\*:[ \t]*([A-Z_]+)[ \t]*$", text)
    state_match = re.search(r"(?mi)^-[ \t]+\*\*Workflow state\*\*:[ \t]*([A-Z_]+)[ \t]*$", text)
    return (
        status_match.group(1).upper() if status_match else None,
        state_match.group(1).upper() if state_match else None,
    )


def ticket_directories(root: Path, config: dict[str, Any]) -> list[Path]:
    ticket_root = safe_repo_path(root, config["root"])
    pattern = re.compile(config["directoryPattern"])
    if not ticket_root.is_dir():
        return []
    return sorted(path for path in ticket_root.iterdir() if path.is_dir() and pattern.fullmatch(path.name))


def validate_intent(path: Path, ticket_name: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        intent = load_json(path)
    except (OSError, json.JSONDecodeError) as error:
        return None, str(error)
    v1_fields = {"schema", "ticket", "summary", "allowedPaths", "forbiddenPaths", "stacks"}
    v2_fields = v1_fields | {"workstream", "dependsOn", "conflictsWith", "integrationTicket"}
    if not isinstance(intent, dict) or intent.get("schema") not in {
        "new-project.intent/v1", "new-project.intent/v2",
    }:
        return None, "unsupported intent schema"
    expected = v2_fields if intent["schema"] == "new-project.intent/v2" else v1_fields
    if set(intent) != expected:
        return None, f"intent must contain exactly the {intent['schema'].rsplit('/', 1)[-1]} fields"
    if intent.get("ticket") != ticket_name:
        return None, "intent schema or ticket identity differs"
    if not isinstance(intent.get("summary"), str) or not intent["summary"].strip():
        return None, "intent summary is blank"
    for field_name in ("allowedPaths", "forbiddenPaths", "stacks"):
        if not isinstance(intent.get(field_name), list) or not all(isinstance(value, str) and value for value in intent[field_name]):
            return None, f"intent {field_name} must be a list of non-blank strings"
    if not intent["allowedPaths"]:
        return None, "intent allowedPaths is empty"
    if intent["schema"] == "new-project.intent/v2":
        if not isinstance(intent.get("workstream"), str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", intent["workstream"]):
            return None, "intent workstream is invalid"
        for field_name in ("dependsOn", "conflictsWith"):
            values = intent.get(field_name)
            if not isinstance(values, list) or not all(isinstance(value, str) and re.fullmatch(r"ticket-[0-9]{3}", value) for value in values):
                return None, f"intent {field_name} must contain ticket IDs"
            if len(values) != len(set(values)):
                return None, f"intent {field_name} contains duplicates"
        integration = intent.get("integrationTicket")
        if integration is not None and (not isinstance(integration, str) or not re.fullmatch(r"ticket-[0-9]{3}", integration)):
            return None, "intent integrationTicket must be null or a ticket ID"
    return intent, None


def load_ticket_records(directories: list[Path], config: dict[str, Any]) -> list[TicketRecord]:
    records = []
    for directory in directories:
        status, workflow = parse_ticket_state(directory / "README.md")
        intent, error = validate_intent(directory / config["intentFile"], directory.name)
        records.append(TicketRecord(directory, status, workflow, intent, error))
    return records


def repository_files(root: Path, changed: list[str]) -> list[str]:
    try:
        raw = git_output(root, ["ls-files", "-co", "--exclude-standard", "-z"])
        files = raw.decode("utf-8", "surrogateescape").split("\0")
    except (subprocess.CalledProcessError, FileNotFoundError):
        files = [rel(root, path) for path in root.rglob("*") if path.is_file() and ".git" not in path.parts]
    return sorted(set([*files, *changed]) - {""})


def check_coordination(
    root: Path,
    manifest: dict[str, Any],
    records: list[TicketRecord],
    changed: list[str],
    report: Report,
) -> None:
    coordination = manifest.get("coordination")
    if not isinstance(coordination, dict):
        return
    config = manifest["ticket"]
    active_statuses = set(config.get("activeStatuses", ACTIVE_DEFAULT))
    closed_statuses = set(config.get("closedStatuses", []))
    active = [record for record in records if record.status in active_statuses]
    by_name = {record.directory.name: record for record in records}
    workstreams = coordination["workstreams"]
    valid_active: list[TicketRecord] = []

    for record in active:
        intent_path = rel(root, record.directory / config["intentFile"])
        if record.intent_error:
            report.add(
                "GOV-INTENT-002", f"Ticket intent is invalid: {record.intent_error}",
                "Create a valid new-project.intent/v2 file before implementation.", [intent_path],
            )
            continue
        assert record.intent is not None
        if record.intent["schema"] != "new-project.intent/v2":
            report.add(
                "GOV-INTENT-002", f"Active ticket {record.directory.name} still uses intent v1.",
                "Migrate the active ticket explicitly to intent v2; archived closed v1 tickets remain readable.", [intent_path],
            )
            continue
        workstream = record.intent["workstream"]
        if workstream not in workstreams:
            report.add(
                "GOV-WORKSTREAM-001", f"Active ticket {record.directory.name} declares unknown workstream '{workstream}'.",
                "Choose a workstream declared in the pinned governance manifest and obtain fresh plan approval.", [intent_path],
                {"workstream": workstream, "knownWorkstreams": sorted(workstreams)},
            )
            continue
        valid_active.append(record)

    limit = coordination["maxActiveTicketsPerWorkstream"]
    grouped: dict[str, list[TicketRecord]] = {}
    for record in valid_active:
        grouped.setdefault(record.intent["workstream"], []).append(record)  # type: ignore[index]
    for workstream, members in sorted(grouped.items()):
        if len(members) > limit:
            report.add(
                "GOV-WORKSTREAM-002", f"Workstream '{workstream}' has {len(members)} active tickets; limit is {limit}.",
                "Keep one active implementation ticket in this workstream or close/block-route the competing scope.",
                [rel(root, member.directory) for member in members],
                {"workstream": workstream, "tickets": [member.directory.name for member in members], "limit": limit},
            )

    graph: dict[str, list[str]] = {}
    for record in records:
        if record.intent and record.intent.get("schema") == "new-project.intent/v2":
            graph[record.directory.name] = list(record.intent["dependsOn"])
            if record.directory.name in record.intent["dependsOn"] or record.directory.name in record.intent["conflictsWith"]:
                report.add(
                    "GOV-DEPENDENCY-001", f"Ticket {record.directory.name} references itself as a dependency or conflict.",
                    "Remove the self-reference and keep only directed edges to other tickets.", [rel(root, record.directory / config["intentFile"])],
                )

    visiting: set[str] = set()
    visited: set[str] = set()
    cycle: list[str] = []

    def visit(name: str, trail: list[str]) -> bool:
        if name in visiting:
            cycle.extend(trail[trail.index(name):] + [name])
            return True
        if name in visited:
            return False
        visiting.add(name)
        for dependency in graph.get(name, []):
            if dependency in graph and visit(dependency, [*trail, dependency]):
                return True
        visiting.remove(name)
        visited.add(name)
        return False

    for name in sorted(graph):
        if visit(name, [name]):
            report.add(
                "GOV-DEPENDENCY-001", "Ticket dependency graph contains a cycle.",
                "Break the cycle by choosing a directed implementation order or an explicit integration ticket.",
                [f"project/{item}/intent.json" for item in sorted(set(cycle))], {"cycle": cycle},
            )
            break

    active_names = {record.directory.name for record in active}
    conflict_pairs: set[tuple[str, str]] = set()
    for record in valid_active:
        assert record.intent is not None
        for dependency in record.intent["dependsOn"]:
            prerequisite = by_name.get(dependency)
            if prerequisite is None or prerequisite.status not in closed_statuses:
                report.add(
                    "GOV-DEPENDENCY-002", f"Active ticket {record.directory.name} has unfinished or missing dependency {dependency}.",
                    "Complete the prerequisite or return the dependent ticket to a non-active planning backlog.",
                    [rel(root, record.directory / config["intentFile"])],
                    {"ticket": record.directory.name, "dependency": dependency, "dependencyStatus": prerequisite.status if prerequisite else None},
                )
        for conflict in record.intent["conflictsWith"]:
            if conflict in active_names:
                conflict_pairs.add(tuple(sorted((record.directory.name, conflict))))
    for first, second in sorted(conflict_pairs):
        report.add(
            "GOV-CONFLICT-001", f"Conflicting tickets {first} and {second} are active together.",
            "Serialize the tickets or resolve the conflict through an approved integration plan.",
            [f"project/{first}/intent.json", f"project/{second}/intent.json"],
        )

    files = repository_files(root, changed)
    governance_patterns = manifest["governancePaths"]
    for record in valid_active:
        assert record.intent is not None
        owned_paths = workstreams[record.intent["workstream"]]["ownedPaths"]
        unowned_claims = [
            path for path in files
            if not matches(path, governance_patterns)
            and matches(path, record.intent["allowedPaths"])
            and not matches(path, record.intent["forbiddenPaths"])
            and not matches(path, owned_paths)
        ]
        if unowned_claims:
            report.add(
                "GOV-WORKSTREAM-003", f"Ticket {record.directory.name} claims concrete paths outside workstream '{record.intent['workstream']}'.",
                "Narrow allowedPaths or route the concrete files to their owning workstream/integration ticket and obtain fresh approval.",
                unowned_claims[:20],
                {"ticket": record.directory.name, "workstream": record.intent["workstream"], "ownedPaths": owned_paths, "concretePathCount": len(unowned_claims)},
            )

    if coordination["rejectActiveScopeOverlap"]:
        for index, first in enumerate(valid_active):
            assert first.intent is not None
            for second in valid_active[index + 1:]:
                assert second.intent is not None
                shared_files = [
                    path for path in files
                    if not matches(path, governance_patterns)
                    and matches(path, first.intent["allowedPaths"])
                    and not matches(path, first.intent["forbiddenPaths"])
                    and matches(path, second.intent["allowedPaths"])
                    and not matches(path, second.intent["forbiddenPaths"])
                ]
                common_patterns = sorted(
                    (set(first.intent["allowedPaths"]) & set(second.intent["allowedPaths"]))
                    - set(governance_patterns)
                )
                if shared_files or common_patterns:
                    report.add(
                        "GOV-WORKSTREAM-004",
                        f"Active ticket scopes overlap: {first.directory.name} and {second.directory.name}.",
                        "Narrow one allowedPaths declaration, serialize the work, or route the shared contract through integration.",
                        shared_files[:20],
                        {"tickets": [first.directory.name, second.directory.name], "commonPatterns": common_patterns, "concretePathCount": len(shared_files)},
                    )


def check_required_files(root: Path, manifest: dict[str, Any], report: Report) -> None:
    missing = []
    for raw in manifest["requiredFiles"]:
        try:
            if not safe_repo_path(root, raw).exists():
                missing.append(raw)
        except ValueError:
            missing.append(raw)
    if missing:
        report.add("GOV-BOOT-001", "Required target-repository files are missing.", "Run the approved new-project bootstrap before implementation.", missing)

    docker = manifest["docker"]
    if docker["required"]:
        dockerfile = next((name for name in docker["dockerfiles"] if safe_repo_path(root, name).is_file()), None)
        compose = next((name for name in docker["composeFiles"] if safe_repo_path(root, name).is_file()), None)
        if dockerfile is None or compose is None:
            report.add(
                "GOV-DOCKER-001", "Required Dockerfile or Compose declaration is missing.",
                "Add a pinned Docker runtime and validate its Compose configuration.",
                [*([] if dockerfile else docker["dockerfiles"]), *([] if compose else docker["composeFiles"])],
            )


def check_stacks(root: Path, manifest: dict[str, Any], profiles_path: Path | None, report: Report) -> None:
    stacks = manifest.get("stacks", [])
    if not stacks or profiles_path is None:
        return
    try:
        profiles = load_json(profiles_path)["profiles"]
    except (OSError, KeyError, json.JSONDecodeError):
        report.add("GOV-MANIFEST-001", "Stack profile catalog is unreadable.", "Restore the pinned stack profile catalog.", [])
        return
    for stack in stacks:
        profile = profiles.get(stack)
        if not isinstance(profile, dict):
            report.add("GOV-STACK-001", f"Unknown stack profile: {stack}", "Declare a profile published by the pinned governance standard.", [])
            continue
        markers = profile.get("anyFiles", [])
        if markers and not any(safe_repo_path(root, marker).exists() for marker in markers):
            report.add("GOV-STACK-001", f"Declared stack '{stack}' has no recognized project marker.", "Add the stack marker or remove the inaccurate stack declaration.", markers)


def check_ticket_content(root: Path, directories: list[Path], config: dict[str, Any], report: Report) -> None:
    for directory in directories:
        status, _ = parse_ticket_state(directory / "README.md")
        if status in set(config["activeStatuses"]):
            missing = [rel(root, directory / item) for item in config["requiredFiles"] if not (directory / item).is_file()]
            for pattern in config["requiredAgentFiles"]:
                if not any(directory.glob(pattern)):
                    missing.append(rel(root, directory / pattern))
            if missing:
                report.add("GOV-TICKET-003", f"Active ticket {directory.name} is missing required governance files.", "Complete the ticket scaffold before implementation.", missing)
        for path in directory.rglob("*"):
            if not path.is_file():
                continue
            mode_executable = bool(path.stat().st_mode & 0o111)
            if path.suffix.lower() in EXECUTABLE_SUFFIXES or mode_executable:
                report.add(
                    "GOV-TICKET-004", f"Executable content is forbidden in ticket directory: {rel(root, path)}",
                    "Move implementation to the repository's normal source, test or scripts directory.", [rel(root, path)],
                )


def check_changed_content(root: Path, changed: list[str], actor: str, trusted_human_change: bool, report: Report) -> None:
    human_paths = [path for path in changed if fnmatch.fnmatchcase(path, "project/ticket-*/user-*.md")]
    if human_paths and (actor != "human" or not trusted_human_change):
        report.add(
            "GOV-OWNER-001", "Human-owned participant content changed without trusted human intake evidence.",
            "Revert the agent edit or have the human owner submit it through the trusted intake boundary.", human_paths,
        )
    for raw in changed:
        try:
            path = safe_repo_path(root, raw)
        except ValueError:
            continue
        if not path.is_file() or path.stat().st_size > 1_000_000:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        secrets = []
        for match in SECRET_RE.finditer(text):
            if text[match.end(2):].startswith("="):
                continue
            if re.match(r"^[A-Z][A-Z0-9_]*=", match.group(2)):
                continue
            if not SAFE_SECRET_VALUES.match(match.group(2)):
                secrets.append(match.group(1))
        if secrets:
            report.add(
                "GOV-SECRET-001", f"Probable secret assignment detected in {raw}.",
                "Remove and rotate the secret; keep only placeholders in tracked files.", [raw], {"fieldNames": sorted(set(secrets))},
            )
        if raw.startswith(("project/ticket-", ".governance/")) and LOCAL_PATH_RE.search(text):
            report.add(
                "GOV-PATH-001", f"Machine-local absolute path detected in governed artifact: {raw}",
                "Replace it with a repository-relative path before publication.", [raw],
            )


def check_change_gate(
    root: Path,
    manifest: dict[str, Any],
    records: list[TicketRecord],
    changed: list[str],
    base: str | None,
    head: str,
    approval_source: str | None,
    approved_ticket: str | None,
    enforce_approval: bool,
    report: Report,
) -> None:
    governance_patterns = manifest["governancePaths"]
    implementation = [path for path in changed if not matches(path, governance_patterns)]
    if not implementation:
        return
    config = manifest["ticket"]
    active = [record for record in records if record.status in set(config.get("activeStatuses", ACTIVE_DEFAULT))]
    if not active:
        report.add(
            "GOV-TICKET-001", "Implementation paths changed without an active ticket.",
            "Create the next target-repository ticket, publish its plan and obtain approval before editing implementation.", implementation,
        )
        return
    coordination = manifest.get("coordination")
    if not isinstance(coordination, dict):
        if len(active) > 1:
            report.add(
                "GOV-TICKET-002", "More than one active ticket exists.",
                "Continue the existing ticket or close/cancel it before creating another.",
                [rel(root, item.directory) for item in active], {"tickets": [item.directory.name for item in active]},
            )
            return
        selected = active[0]
    else:
        candidates = [
            record for record in active
            if record.intent is not None
            and record.intent.get("schema") == "new-project.intent/v2"
            and all(
                matches(path, record.intent["allowedPaths"])
                and not matches(path, record.intent["forbiddenPaths"])
                for path in implementation
            )
        ]
        if len(candidates) == 1:
            selected = candidates[0]
        elif not candidates and len(active) == 1:
            selected = active[0]
        else:
            path_owners = {
                path: [
                    record.directory.name for record in active
                    if record.intent is not None
                    and matches(path, record.intent["allowedPaths"])
                    and not matches(path, record.intent["forbiddenPaths"])
                ]
                for path in implementation
            }
            report.add(
                "GOV-TICKET-005", "Implementation diff does not resolve to exactly one active ticket.",
                "Use one ticket per branch/PR, narrow allowedPaths, or create an approved integration ticket for the combined diff.",
                implementation, {"candidateTickets": [record.directory.name for record in candidates], "pathOwners": path_owners},
            )
            return
    directory = selected.directory
    workflow = selected.workflow
    check_history_order(
        root, base=base, head=head, ticket_name=directory.name,
        intent_path=config["intentFile"], governance_patterns=governance_patterns,
        report=report,
    )
    if workflow not in set(config["implementationStates"]):
        report.add(
            "GOV-INTENT-001", f"Ticket {directory.name} is in workflow state {workflow or 'UNKNOWN'}, not an implementation state.",
            "Keep the change plan-only until explicit approval moves the ticket to EDIT.", implementation,
        )
    intent_path = directory / config["intentFile"]
    intent, error = selected.intent, selected.intent_error
    if error:
        report.add("GOV-INTENT-002", f"Ticket intent is invalid: {error}", "Create a valid intent file before implementation.", [rel(root, intent_path)])
    else:
        outside = [path for path in implementation if not matches(path, intent["allowedPaths"]) or matches(path, intent["forbiddenPaths"])]
        if outside:
            report.add(
                "GOV-SCOPE-001", "Changed implementation paths are outside the ticket intent.",
                "Revert the paths or return to PLAN, expand allowedPaths and obtain fresh approval.", outside,
                {"ticket": directory.name, "allowedPaths": intent["allowedPaths"]},
            )
        if isinstance(coordination, dict) and intent.get("schema") == "new-project.intent/v2":
            workstream = coordination["workstreams"].get(intent["workstream"])
            if isinstance(workstream, dict):
                unowned = [path for path in implementation if not matches(path, workstream["ownedPaths"])]
                if unowned:
                    report.add(
                        "GOV-WORKSTREAM-003", f"Changed paths are not owned by workstream '{intent['workstream']}'.",
                        "Move the change to its owning workstream or create and approve an integration ticket; do not widen ownership retroactively.",
                        unowned, {"ticket": directory.name, "workstream": intent["workstream"], "ownedPaths": workstream["ownedPaths"]},
                    )
            integration = coordination["integration"]
            shared = [path for path in implementation if matches(path, integration["requiredForPaths"])]
            if shared and intent["workstream"] != integration["workstream"]:
                integration_name = intent["integrationTicket"]
                integration_record = next((record for record in records if record.directory.name == integration_name), None)
                valid_integration = (
                    integration_record is not None
                    and integration_record.intent is not None
                    and integration_record.intent.get("schema") == "new-project.intent/v2"
                    and integration_record.intent.get("workstream") == integration["workstream"]
                    and integration_record.status != "CANCELLED"
                )
                if not valid_integration:
                    report.add(
                        "GOV-INTEGRATION-001", "Shared contract paths lack valid integration-ticket routing.",
                        "Create an integration-workstream ticket, record it in integrationTicket and obtain fresh approval before changing the shared contract.",
                        shared, {"ticket": directory.name, "integrationTicket": integration_name, "requiredWorkstream": integration["workstream"]},
                    )
    if enforce_approval:
        trusted = set(manifest["trustedApprovalSources"])
        if approval_source not in trusted:
            report.add(
                "GOV-APPROVAL-001", "No trusted external approval was supplied for implementation.",
                "Require an approving CODEOWNER GitHub review or signed attestation; Markdown status alone is not trusted.",
                [rel(root, directory / "README.md")], {"suppliedSource": approval_source, "trustedSources": sorted(trusted)},
            )
        approved_tickets = set((approved_ticket or "").split(",")) - {""}
        if directory.name not in approved_tickets:
            report.add(
                "GOV-APPROVAL-002", "Trusted approval does not identify the active ticket.",
                "Approve the current ticket after reviewing its latest intent and implementation diff.",
                [rel(root, directory)], {"activeTicket": directory.name, "approvedTickets": sorted(approved_tickets)},
            )


def sarif(payload: dict[str, Any]) -> dict[str, Any]:
    findings = payload["findings"]
    rules = {}
    results = []
    for item in findings:
        rules[item["code"]] = {
            "id": item["code"],
            "shortDescription": {"text": item["message"]},
            "help": {"text": item["remediation"]},
        }
        result: dict[str, Any] = {
            "ruleId": item["code"],
            "level": "error" if item["severity"] == "error" else "warning",
            "message": {"text": item["message"]},
        }
        if item["paths"]:
            result["locations"] = [{
                "physicalLocation": {"artifactLocation": {"uri": item["paths"][0]}},
            }]
        results.append(result)
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {"name": "new-project-governance", "version": RUNTIME_VERSION, "rules": [rules[key] for key in sorted(rules)]}},
            "results": results,
        }],
    }


def render_text(payload: dict[str, Any]) -> str:
    lines = []
    for item in payload["findings"]:
        paths = f" [{', '.join(item['paths'])}]" if item["paths"] else ""
        lines.append(f"{item['code']} {item['severity'].upper()}: {item['message']}{paths}")
        lines.append(f"  remediation: {item['remediation']}")
    summary = payload["summary"]
    code = "GOV-PASS" if payload["status"] == "passed" else "GOV-FAIL"
    lines.append(f"{code}: {payload['status']} ({summary['errors']} errors, {summary['warnings']} warnings)")
    return "\n".join(lines) + "\n"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    parser.add_argument("--manifest", default=".governance/manifest.json")
    parser.add_argument("--lock", default=None)
    parser.add_argument("--stack-profiles", default=None)
    parser.add_argument("--base")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--changed-file", action="append", default=[])
    parser.add_argument("--actor", choices=["agent", "human", "ci"], default="agent")
    parser.add_argument("--trusted-human-change", action="store_true")
    parser.add_argument("--enforce-approval", action="store_true")
    parser.add_argument("--approval-source")
    parser.add_argument("--approved-ticket")
    parser.add_argument("--format", choices=["text", "json", "sarif"], default="text")
    parser.add_argument("--output")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    root = Path(args.root).resolve()
    report = Report(root)
    try:
        manifest_path = safe_repo_path(root, args.manifest)
    except ValueError as error:
        report.add("GOV-MANIFEST-001", str(error), "Use a repository-relative manifest path.")
        manifest = None
    else:
        try:
            manifest = load_json(manifest_path)
            if not basic_manifest_valid(manifest):
                raise ValueError("required manifest fields are missing or invalid")
        except (OSError, ValueError, json.JSONDecodeError) as error:
            report.add("GOV-MANIFEST-001", f"Governance manifest is invalid: {error}", "Restore a manifest conforming to the pinned governance schema.", [args.manifest])
            manifest = None

    if manifest is not None:
        lock_path = safe_repo_path(root, args.lock) if args.lock else None
        profiles_path = safe_repo_path(root, args.stack_profiles) if args.stack_profiles else None
        changed = changed_paths(root, args.base, args.head, args.changed_file)
        check_lock(root, lock_path, report)
        check_required_files(root, manifest, report)
        check_stacks(root, manifest, profiles_path, report)
        directories = ticket_directories(root, manifest["ticket"])
        check_ticket_content(root, directories, manifest["ticket"], report)
        records = load_ticket_records(directories, manifest["ticket"])
        check_coordination(root, manifest, records, changed, report)
        check_changed_content(root, changed, args.actor, args.trusted_human_change, report)
        check_change_gate(
            root, manifest, records, changed, args.base, args.head, args.approval_source,
            args.approved_ticket, args.enforce_approval, report,
        )

    payload = report.payload()
    if args.format == "json":
        output = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    elif args.format == "sarif":
        output = json.dumps(sarif(payload), indent=2, sort_keys=True) + "\n"
    else:
        output = render_text(payload)
    if args.output:
        output_path = safe_repo_path(root, args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output, encoding="utf-8")
    else:
        sys.stdout.write(output)
    return 0 if report.errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
