"""Diff-focused facade over the todo2code Python SDK.

The implementation lives in the :mod:`todo2code` package next to this module,
alongside the Go, PHP, Rust and TypeScript clients, so all five languages share
one surface. This module keeps the ``Todo2CodeClient`` names stable for existing
callers and exposes the diff helpers with their original signatures.
"""

from __future__ import annotations

from typing import Any

try:
    # Imported as part of the `sdk.python` package (repository checkout).
    from .todo2code.client import T2CClient, T2CError
    from .todo2code.runtime import RuntimeResult, TypeScriptRuntime, TypeScriptRuntimeError
except ImportError:  # pragma: no cover - installed distribution
    # Imported as a top-level module, with `sdk/python` on sys.path.
    from todo2code.client import T2CClient, T2CError
    from todo2code.runtime import RuntimeResult, TypeScriptRuntime, TypeScriptRuntimeError

__all__ = [
    "RuntimeResult",
    "T2CClient",
    "T2CError",
    "Todo2CodeClient",
    "Todo2CodeError",
    "TypeScriptRuntime",
    "TypeScriptRuntimeError",
]

# The package raises T2CError; the legacy name stays importable and, being the
# same class, existing `except Todo2CodeError` blocks keep catching it.
Todo2CodeError = T2CError


class Todo2CodeClient:
    """Diff-focused client for the todo2code runtime.

    Graph comparisons use the REST fast path (``POST /api/diff``), which is one
    round-trip instead of an A2A task cycle; everything else goes over A2A.
    """

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8787",
        token: str | None = None,
        timeout: float = 120.0,
    ) -> None:
        self.client = T2CClient(base_url, token=token, timeout=timeout)

    @property
    def base_url(self) -> str:
        return self.client.base_url

    def health(self) -> dict[str, Any]:
        return dict(self.client.health())

    def extract_nl(
        self, file: str, root: str = ".", nl_mode: str | None = None
    ) -> dict[str, Any]:
        result = self.client.extract_nl_result(file, root, nl_mode)
        return {
            "records": [_record_dict(record) for record in result.records],
            "warnings": list(result.warnings),
            "audit": result.audit,
        }

    def extract_docs(
        self,
        root: str = ".",
        patterns: list[str] | None = None,
        excludes: list[str] | None = None,
    ) -> dict[str, Any]:
        result = self.client.extract_docs_result(root, patterns, excludes)
        return {
            "records": [_record_dict(record) for record in result.records],
            "warnings": list(result.warnings),
            "audit": result.audit,
        }

    def diff_graphs(
        self,
        before_graph: dict[str, Any],
        after_graph: dict[str, Any],
        include_svg: bool = True,
    ) -> dict[str, Any]:
        return dict(self.client.diff_graphs_rest(
            beforeGraph=before_graph,
            afterGraph=after_graph,
            includeSvg=include_svg,
        ))

    def diff_graph_files(
        self,
        before: str,
        after: str,
        include_svg: bool = True,
    ) -> dict[str, Any]:
        return dict(self.client.diff_graphs_rest(before=before, after=after, includeSvg=include_svg))

    def diff_text_files(
        self,
        before: str,
        after: str,
        *,
        context: int = 3,
        include_svg: bool = True,
        include_html: bool = False,
        max_rows: int = 400,
    ) -> dict[str, Any]:
        return dict(self.client.diff_files(
            before,
            after,
            context=context,
            includeSvg=include_svg,
            includeHtml=include_html,
            maxRows=max_rows,
        ))

    def diff_git(
        self,
        *,
        revision: str = "HEAD",
        staged: bool = False,
        context: int = 3,
        max_files: int = 50,
        include_svg: bool = True,
        include_html: bool = False,
    ) -> dict[str, Any]:
        return dict(self.client.diff_git(
            revision=revision,
            staged=staged,
            context=context,
            maxFiles=max_files,
            includeSvg=include_svg,
            includeHtml=include_html,
        ))

    def reality(
        self,
        graph: dict[str, Any],
        *,
        diagnostics: dict[str, Any] | None = None,
        gaps_only: bool = False,
        max_rows: int = 30,
        include_svg: bool = True,
    ) -> dict[str, Any]:
        return dict(self.client.reality(
            graph,
            diagnostics,
            gapsOnly=gaps_only,
            maxRows=max_rows,
            includeSvg=include_svg,
        ))

    def run(self, action: str, input_data: dict[str, Any] | None = None) -> Any:
        return self.client.call(action, input_data or {})


def _record_dict(record: Any) -> dict[str, Any]:
    return {
        "schemaVersion": record.schema_version,
        "id": record.id,
        "statement": dict(record.statement),
        "lifecycle": dict(record.lifecycle),
        "source": dict(record.source),
        "epistemic": dict(record.epistemic),
        "observedAt": record.observed_at,
        "metadata": dict(record.metadata),
    }
