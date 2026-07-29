"""Local bridge from Python to the compiled todo2code TypeScript runtime.

The bridge intentionally uses only the Python standard library.  Node.js runs
the canonical implementation, so Python callers do not duplicate Intent DSL,
diff or reality semantics.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence


class TypeScriptRuntimeError(RuntimeError):
    """Raised when the local Node/TypeScript runtime cannot be executed."""


@dataclass(frozen=True)
class RuntimeResult:
    """Raw result of a local TypeScript CLI invocation."""

    stdout: str
    stderr: str
    returncode: int


class TypeScriptRuntime:
    """Execute the canonical TypeScript runtime from a Python process.

    ``cli_path`` may point at ``dist/src/cli.js`` or at an executable ``t2c``
    launcher.  When omitted, the bridge checks ``T2C_TYPESCRIPT_CLI``, the
    current repository and finally ``PATH``.
    """

    def __init__(
        self,
        root: str | os.PathLike[str] = ".",
        *,
        cli_path: str | os.PathLike[str] | None = None,
        node_executable: str = "node",
        timeout: float = 300.0,
        env: Mapping[str, str] | None = None,
    ) -> None:
        self.root = Path(root).resolve()
        if not self.root.is_dir():
            raise TypeScriptRuntimeError(f"Runtime root is not a directory: {self.root}")
        self.cli_path = _resolve_cli(cli_path)
        self.node_executable = node_executable
        self.timeout = timeout
        self.env = dict(env or {})

    def invoke(self, arguments: Sequence[str], *, timeout: float | None = None) -> RuntimeResult:
        """Invoke arbitrary ``t2c`` CLI arguments and capture their output."""

        command = (
            [self.node_executable, str(self.cli_path), *map(str, arguments)]
            if self.cli_path.suffix in {".js", ".mjs", ".cjs"}
            else [str(self.cli_path), *map(str, arguments)]
        )
        process_env = os.environ.copy()
        process_env.update(self.env)
        process_env["T2C_ROOT"] = str(self.root)
        try:
            completed = subprocess.run(
                command,
                cwd=self.root,
                env=process_env,
                capture_output=True,
                text=True,
                timeout=timeout or self.timeout,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise TypeScriptRuntimeError(f"Cannot execute TypeScript runtime: {error}") from error
        result = RuntimeResult(completed.stdout, completed.stderr, completed.returncode)
        if completed.returncode != 0:
            detail = completed.stderr.strip() or completed.stdout.strip() or f"exit code {completed.returncode}"
            raise TypeScriptRuntimeError(f"TypeScript runtime failed: {detail}")
        return result

    def version(self) -> str:
        return self.invoke(["--version"]).stdout.strip()

    def pipeline(
        self,
        *,
        task_file: str | None = None,
        todo_file: str | None = "TODO.md",
        changelog_file: str | None = "CHANGELOG.md",
        documents: Sequence[str] = ("README.md", "docs/**/*.md"),
        documentation_llm: bool = False,
        summary_llm: bool = False,
        nl_mode: str = "deterministic",
        markdown_mode: str = "deterministic",
        output_dir: str = ".intent",
        git_count: int = 10,
    ) -> Mapping[str, Any]:
        arguments = [
            "pipeline",
            str(self.root),
            "--task", task_file or "none",
            "--todo", todo_file or "none",
            "--changelog", changelog_file or "none",
            "--docs", ",".join(documents),
            "--nl-mode", nl_mode,
            "--markdown-mode", markdown_mode,
            "--out", output_dir,
            "--git-count", str(git_count),
        ]
        if not documentation_llm:
            arguments.append("--no-docs-llm")
        if not summary_llm:
            arguments.append("--no-summary-llm")
        return _parse_mapping(self.invoke(arguments).stdout, "pipeline result")

    def diagnose(self, graph_path: str | os.PathLike[str]) -> Mapping[str, Any]:
        with tempfile.TemporaryDirectory(prefix="t2c-python-") as temporary:
            output = Path(temporary) / "diagnostics.json"
            self.invoke(["diagnose", str(Path(graph_path).resolve()), "--out", str(output)])
            return _load_mapping(output, "diagnostics")

    def diff_graphs(
        self,
        before_path: str | os.PathLike[str],
        after_path: str | os.PathLike[str],
        *,
        include_svg: bool = True,
    ) -> Mapping[str, Any]:
        with tempfile.TemporaryDirectory(prefix="t2c-python-") as temporary:
            output = Path(temporary) / "diff.json"
            svg = Path(temporary) / "diff.svg"
            arguments = [
                "diff", str(Path(before_path).resolve()), str(Path(after_path).resolve()),
                "--out", str(output),
            ]
            if include_svg:
                arguments.extend(["--svg", str(svg)])
            self.invoke(arguments)
            result: dict[str, Any] = {"diff": _load_mapping(output, "graph diff")}
            if include_svg:
                result["svg"] = svg.read_text(encoding="utf-8")
            return result

    def reality(
        self,
        graph_path: str | os.PathLike[str],
        *,
        diagnostics_path: str | os.PathLike[str] | None = None,
        include_svg: bool = True,
        gaps_only: bool = False,
        max_rows: int = 30,
    ) -> Mapping[str, Any]:
        with tempfile.TemporaryDirectory(prefix="t2c-python-") as temporary:
            output = Path(temporary) / "reality.json"
            markdown = Path(temporary) / "reality.md"
            svg = Path(temporary) / "reality.svg"
            arguments = [
                "reality", str(Path(graph_path).resolve()),
                "--out", str(output), "--md", str(markdown), "--max-rows", str(max_rows),
            ]
            if diagnostics_path is not None:
                arguments.extend(["--diagnostics", str(Path(diagnostics_path).resolve())])
            if include_svg:
                arguments.extend(["--svg", str(svg)])
            if gaps_only:
                arguments.append("--gaps-only")
            self.invoke(arguments)
            result: dict[str, Any] = {
                "view": _load_mapping(output, "reality view"),
                "markdown": markdown.read_text(encoding="utf-8"),
            }
            if include_svg:
                result["svg"] = svg.read_text(encoding="utf-8")
            return result


def _resolve_cli(value: str | os.PathLike[str] | None) -> Path:
    explicit = value or os.environ.get("T2C_TYPESCRIPT_CLI")
    if explicit:
        candidate = Path(explicit).expanduser().resolve()
        if candidate.is_file():
            return candidate
        raise TypeScriptRuntimeError(f"TypeScript CLI does not exist: {candidate}")

    starts = [Path.cwd().resolve(), Path(__file__).resolve().parent]
    checked: set[Path] = set()
    for start in starts:
        for parent in (start, *start.parents):
            candidate = parent / "dist" / "src" / "cli.js"
            if candidate in checked:
                continue
            checked.add(candidate)
            if candidate.is_file():
                return candidate

    executable = shutil.which("t2c")
    if executable:
        return Path(executable).resolve()
    raise TypeScriptRuntimeError(
        "Cannot find the TypeScript runtime. Build the repository with `npm run build`, "
        "install the `t2c` executable, or set T2C_TYPESCRIPT_CLI."
    )


def _parse_mapping(content: str, label: str) -> Mapping[str, Any]:
    try:
        value = json.loads(content)
    except json.JSONDecodeError as error:
        raise TypeScriptRuntimeError(f"Invalid JSON {label}: {error}") from error
    if not isinstance(value, dict):
        raise TypeScriptRuntimeError(f"Invalid {label}: expected a JSON object")
    return value


def _load_mapping(path: Path, label: str) -> Mapping[str, Any]:
    try:
        return _parse_mapping(path.read_text(encoding="utf-8"), label)
    except OSError as error:
        raise TypeScriptRuntimeError(f"Cannot read {label}: {error}") from error
