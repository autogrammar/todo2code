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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from todo2code import T2CClient, T2CError  # noqa: E402


def main() -> int:
    base_url = os.environ.get("T2C_A2A_URL", "http://localhost:8787")
    token = os.environ.get("T2C_A2A_TOKEN")
    root = os.environ.get("T2C_EXAMPLE_ROOT", "examples/backend")

    client = T2CClient(base_url, token=token)

    print("health:", client.health())
    card = client.agent_card()
    print("agent skills:", ", ".join(skill["id"] for skill in card.get("skills", ())))

    # 1. Deterministic extraction -> graph -> diagnostics.
    ast_records = client.extract_ast(root)
    markdown = client.extract_markdown_result(root, markdown_mode="deterministic")
    if markdown.audit is None or markdown.audit.get("status") != "succeeded":
        raise RuntimeError(f"unexpected Markdown audit: {markdown.audit}")
    print("markdown audit:", markdown.audit.get("status"), markdown.audit.get("effectiveMode"))
    records = [*ast_records, *markdown.records]
    print(f"extracted {len(records)} records from {root}")

    graph = client.link(records)
    print("graph fingerprint:", graph.fingerprint[:16])
    print("records by source:", graph.stats.get("bySource"))

    report = client.diagnose(graph)
    print("diagnostics:", dict(report.counts))
    for diagnostic in report.diagnostics[:3]:
        print(f"  - [{diagnostic.severity}] {diagnostic.code}: {diagnostic.title}")

    # 2. Intent-vs-reality view.
    reality = client.reality(graph, report, gapsOnly=True, includeSvg=True)
    print("reality svg bytes:", len(reality.get("svg", "")))
    print(reality["markdown"].split("\n")[4])

    # 3. Git diff rendered as SVG.
    git_diff = client.diff_git(root=root, revision="HEAD", includeSvg=True)
    print("git diff files:", len(git_diff.get("diffs", ())))

    # 4. Optional origin/main -> local filesystem Intent comparison.
    if os.environ.get("T2C_COMPARE_WORKSPACE") == "1":
        comparison = client.compare_workspace(root=root, base=os.environ.get("T2C_COMPARE_BASE", "origin/main"))
        print("workspace trend:", comparison.get("trend", {}).get("direction"))

    print("OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except T2CError as error:
        print(f"example failed: {error} (code {error.code})", file=sys.stderr)
        raise SystemExit(1) from error
