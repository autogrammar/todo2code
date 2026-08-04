#!/usr/bin/env python3
"""Usage test for the todo2code Python SDK.

Start the server first:
    node dist/src/interfaces/a2a.js

Then run:
    python3 sdk/python/examples/basic.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from todo2code import T2CClient, T2CError  # noqa: E402

DEFAULT_A2A_URL = "http://localhost:8787"
DEFAULT_EXAMPLE_ROOT = "examples/backend"
DEFAULT_COMPARE_BASE = "origin/main"
TODO_PATCH_PATH = ".intent-sdk/python/TODO.patch"
TODO_AUDIT_PATH = ".intent-sdk/python/TODO.patch.json"
TODO_RECEIPT_PATH = ".intent-sdk/python/TODO.patch.receipt.json"


@dataclass(frozen=True)
class ExampleContext:
    base_url: str
    token: str | None
    root: str
    compare_base: str
    compare_workspace: bool


@dataclass(frozen=True)
class ExtractionArtifacts:
    graph: object
    report: object
    record_count: int


@dataclass(frozen=True)
class ProposalArtifacts:
    new_proposal_ids: tuple[str, ...]
    duplicate_proposal_ids: tuple[str, ...]
    patch_hash: str


def main() -> int:
    context = read_example_context()
    client = T2CClient(context.base_url, token=context.token)

    print("health:", client.health())
    run_flow(client, context)
    print("OK")
    return 0


def read_example_context() -> ExampleContext:
    return ExampleContext(
        base_url=os.environ.get("T2C_A2A_URL", DEFAULT_A2A_URL),
        token=os.environ.get("T2C_A2A_TOKEN"),
        root=os.environ.get("T2C_EXAMPLE_ROOT", DEFAULT_EXAMPLE_ROOT),
        compare_base=os.environ.get("T2C_COMPARE_BASE", DEFAULT_COMPARE_BASE),
        compare_workspace=os.environ.get("T2C_COMPARE_WORKSPACE", "0") == "1",
    )


def run_flow(client: T2CClient, context: ExampleContext) -> None:
    card = client.agent_card()
    print("agent skills:", ", ".join(skill["id"] for skill in card.get("skills", ())))

    extraction = run_extraction_flow(client, context.root)
    print(f"extracted {extraction.record_count} records from {context.root}")

    proposal = run_proposal_flow(
        client,
        context.root,
        extraction.graph,
        extraction.report,
    )
    print("proposal ids:", ",".join(proposal.new_proposal_ids) or "-")
    print("duplicate ids:", ",".join(proposal.duplicate_proposal_ids) or "-")
    print("patch fingerprint:", proposal.patch_hash[:16])

    run_reality_and_diff(client, extraction.graph, extraction.report, context.root)
    run_optional_workspace_comparison(
        client,
        context.root,
        context.compare_base,
        context.compare_workspace,
    )


def run_extraction_flow(client: T2CClient, root: str) -> ExtractionArtifacts:
    nl = client.extract_nl_result("task.md", root, nl_mode="deterministic")
    assert_audit_success(nl.audit, "NL", check_mode=True)
    print("NL audit:", nl.audit.get("status"), nl.audit.get("effectiveMode"))

    ast_records = client.extract_ast(root)
    markdown = client.extract_markdown_result(root, markdown_mode="deterministic")
    assert_audit_success(markdown.audit, "Markdown")
    print("markdown audit:", markdown.audit.get("status"), markdown.audit.get("effectiveMode"))

    records = [*nl.records, *ast_records, *markdown.records]
    graph = client.link(records)
    print("graph fingerprint:", graph.fingerprint[:16])
    print("records by source:", graph.stats.get("bySource"))

    report = client.diagnose(graph)
    print("diagnostics:", dict(report.counts))
    for diagnostic in report.diagnostics[:3]:
        print(f"  - [{diagnostic.severity}] {diagnostic.code}: {diagnostic.title}")

    return ExtractionArtifacts(
        graph=graph,
        report=report,
        record_count=len(records),
    )


def assert_audit_success(
    audit: dict[str, object] | None,
    label: str,
    check_mode: bool = False,
) -> None:
    if audit is None or audit.get("status") != "succeeded":
        raise RuntimeError(f"unexpected {label} audit: {audit}")
    if check_mode and audit.get("effectiveMode") != "deterministic":
        raise RuntimeError(f"unexpected {label} mode: {audit.get('effectiveMode')} for {label}")


def run_proposal_flow(
    client: T2CClient,
    root: str,
    graph: object,
    report: object,
) -> ProposalArtifacts:
    synthesis = client.propose_todo({
        "root": root,
        "graph": graph.raw,
        "diagnostics": report.raw,
        "mode": "prefer-llm",
    })
    validation = synthesis.get("validation", {})

    rendered = client.render_todo({
        "root": root,
        "graph": graph.raw,
        "diagnostics": report.raw,
        "synthesis": synthesis,
        "todo": "TODO.md",
        "patch": TODO_PATCH_PATH,
        "audit": TODO_AUDIT_PATH,
    })

    patch_hash = rendered["artifact"]["renderedPatchHash"]
    client.apply_todo({
        "root": root,
        "todo": "TODO.md",
        "patch": TODO_PATCH_PATH,
        "audit": TODO_AUDIT_PATH,
        "receipt": TODO_RECEIPT_PATH,
        "actor": "sdk-python",
        "approvalHash": patch_hash,
    })

    return ProposalArtifacts(
        new_proposal_ids=tuple(validation.get("newProposalIds", ())),
        duplicate_proposal_ids=tuple(validation.get("duplicateProposalIds", ())),
        patch_hash=patch_hash,
    )


def run_reality_and_diff(
    client: T2CClient,
    graph: object,
    report: object,
    root: str,
) -> None:
    reality = client.reality(graph, report, gapsOnly=True, includeSvg=True)
    print("reality svg bytes:", len(reality.get("svg", "")))
    print(reality["markdown"].split("\n")[4])

    git_diff = client.diff_git(root=root, revision="HEAD", includeSvg=True)
    print("git diff files:", len(git_diff.get("diffs", ())))


def run_optional_workspace_comparison(
    client: T2CClient,
    root: str,
    compare_base: str,
    compare_workspace: bool,
) -> None:
    if not compare_workspace:
        return

    comparison = client.compare_workspace(root=root, base=compare_base)
    print("workspace trend:", comparison.get("trend", {}).get("direction"))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except T2CError as error:
        print(f"example failed: {error} (code {error.code})", file=sys.stderr)
        raise SystemExit(1) from error
