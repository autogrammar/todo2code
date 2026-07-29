#!/usr/bin/env python3
"""Use the canonical TypeScript runtime locally, without an A2A server."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from todo2code import TypeScriptRuntime  # noqa: E402


def main() -> int:
    repository = Path(__file__).resolve().parents[3]
    runtime = TypeScriptRuntime(repository)
    print("runtime:", runtime.version())

    run = runtime.pipeline(
        task_file=None,
        documents=("README.md",),
        documentation_llm=False,
        output_dir=".intent-python",
    )
    reality = runtime.reality(
        run["graphPath"],
        diagnostics_path=run["diagnosticsPath"],
        gaps_only=True,
    )
    print(reality["markdown"].splitlines()[0])
    print("topics:", reality["view"]["totals"]["topics"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
