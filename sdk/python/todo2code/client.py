"""A2A v1.0 client for todo2code, standard library only."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Sequence

A2A_VERSION = "1.0"

ACTIONS = (
    "extract_nl",
    "extract_git",
    "extract_ast",
    "extract_markdown",
    "extract_docs",
    "extract_communication",
    "analyze_communication",
    "link",
    "diagnose",
    "summarize",
    "diff",
    "diff_files",
    "diff_git",
    "reality",
    "compare_workspace",
    "pipeline",
    "propose_todo",
    "render_todo",
    "apply_todo",
)


class T2CError(RuntimeError):
    """Raised for JSON-RPC errors, transport failures and non-completed tasks."""

    def __init__(self, message: str, code: int = -32000, data: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.data = data


@dataclass(frozen=True)
class IntentRecord:
    """A single t2c.intent/v1 record."""

    id: str
    statement: Mapping[str, Any]
    lifecycle: Mapping[str, Any]
    source: Mapping[str, Any]
    epistemic: Mapping[str, Any]
    observed_at: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)
    schema_version: str = "t2c.intent/v1"

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "IntentRecord":
        return cls(
            id=payload["id"],
            statement=payload.get("statement", {}),
            lifecycle=payload.get("lifecycle", {}),
            source=payload.get("source", {}),
            epistemic=payload.get("epistemic", {}),
            observed_at=payload.get("observedAt"),
            metadata=payload.get("metadata", {}),
            schema_version=payload.get("schemaVersion", "t2c.intent/v1"),
        )

    @property
    def action(self) -> str:
        return str(self.statement.get("action", "unknown"))

    @property
    def source_kind(self) -> str:
        return str(self.source.get("kind", "system"))

    @property
    def confidence(self) -> float:
        return float(self.epistemic.get("confidence", 0.0))


@dataclass(frozen=True)
class ExtractionResult:
    """Records, warnings and the optional audited LLM stage result."""

    records: Sequence[IntentRecord]
    warnings: Sequence[str]
    audit: Mapping[str, Any] | None = None

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "ExtractionResult":
        audit = payload.get("audit")
        return cls(
            records=tuple(IntentRecord.from_dict(item) for item in payload.get("records", ())),
            warnings=tuple(str(item) for item in payload.get("warnings", ())),
            audit=audit if isinstance(audit, Mapping) else None,
        )


@dataclass(frozen=True)
class Diagnostic:
    id: str
    code: str
    severity: str
    title: str
    detail: str
    record_ids: Sequence[str]
    suggested_action: str

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "Diagnostic":
        return cls(
            id=payload["id"],
            code=payload["code"],
            severity=payload["severity"],
            title=payload.get("title", ""),
            detail=payload.get("detail", ""),
            record_ids=tuple(payload.get("recordIds", ())),
            suggested_action=payload.get("suggestedAction", ""),
        )


@dataclass(frozen=True)
class DiagnosticReport:
    graph_fingerprint: str
    diagnostics: Sequence[Diagnostic]
    counts: Mapping[str, int]
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "DiagnosticReport":
        return cls(
            graph_fingerprint=payload.get("graphFingerprint", ""),
            diagnostics=tuple(Diagnostic.from_dict(item) for item in payload.get("diagnostics", ())),
            counts=payload.get("counts", {}),
            raw=payload,
        )

    def blocking(self) -> Sequence[Diagnostic]:
        return tuple(item for item in self.diagnostics if item.severity == "blocking")


@dataclass(frozen=True)
class IntentGraph:
    fingerprint: str
    records: Sequence[IntentRecord]
    relations: Sequence[Mapping[str, Any]]
    stats: Mapping[str, Any]
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "IntentGraph":
        return cls(
            fingerprint=payload.get("fingerprint", ""),
            records=tuple(IntentRecord.from_dict(item) for item in payload.get("records", ())),
            relations=tuple(payload.get("relations", ())),
            stats=payload.get("stats", {}),
            raw=payload,
        )


class T2CClient:
    """Client for the todo2code A2A endpoint.

    Example:
        >>> client = T2CClient("http://localhost:8787")
        >>> graph = client.link(records)          # doctest: +SKIP
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8787",
        token: str | None = None,
        timeout: float = 120.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self._counter = 0

    # -- transport ---------------------------------------------------------

    def _headers(self, content_type: str | None = None) -> dict[str, str]:
        headers = {"Accept": "application/json", "A2A-Version": A2A_VERSION}
        if content_type:
            headers["Content-Type"] = content_type
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _open(self, request: urllib.request.Request) -> Any:
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:  # noqa: PERF203 - explicit branch is clearer
            body = error.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                raise T2CError(f"HTTP {error.code}: {body[:200]}", error.code) from error
            if isinstance(payload, dict) and "error" in payload:
                detail = payload["error"]
                if isinstance(detail, dict):
                    raise T2CError(detail.get("message", "unknown error"), detail.get("code", error.code), detail.get("data")) from error
                raise T2CError(str(detail), error.code) from error
            raise T2CError(f"HTTP {error.code}", error.code, payload) from error
        except urllib.error.URLError as error:
            raise T2CError(f"Connection failed: {error.reason}", -32003) from error

    def _rpc(self, method: str, params: Mapping[str, Any]) -> Any:
        self._counter += 1
        body = json.dumps(
            {"jsonrpc": "2.0", "id": f"req-{self._counter}", "method": method, "params": params}
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/a2a",
            data=body,
            headers=self._headers("application/json"),
            method="POST",
        )
        payload = self._open(request)
        if isinstance(payload, dict) and payload.get("error"):
            error = payload["error"]
            raise T2CError(error.get("message", "unknown error"), error.get("code", -32000), error.get("data"))
        return payload.get("result") if isinstance(payload, dict) else payload

    def _get(self, path: str) -> Any:
        request = urllib.request.Request(f"{self.base_url}{path}", headers=self._headers(), method="GET")
        return self._open(request)

    # -- core API ----------------------------------------------------------

    def health(self) -> Mapping[str, Any]:
        return self._get("/healthz")

    def agent_card(self) -> Mapping[str, Any]:
        return self._get("/.well-known/agent-card.json")

    def send(self, action: str, payload: Mapping[str, Any] | None = None) -> Mapping[str, Any]:
        """Sends one action and returns the raw A2A task."""
        if action not in ACTIONS:
            raise ValueError(f"Unknown action {action!r}; expected one of {', '.join(ACTIONS)}")
        self._counter += 1
        message = {
            "messageId": f"msg-{int(time.time() * 1000)}-{self._counter}",
            "role": "ROLE_USER",
            "parts": [{"data": {"action": action, "input": dict(payload or {})}, "mediaType": "application/json"}],
        }
        return _unwrap_task(self._rpc("SendMessage", {"message": message}))

    def call(self, action: str, payload: Mapping[str, Any] | None = None) -> Any:
        """Sends one action and unwraps the first JSON artifact."""
        task = self.send(action, payload)
        state = task.get("status", {}).get("state")
        if state != "TASK_STATE_COMPLETED":
            detail = " ".join(
                part.get("text", "")
                for part in task.get("status", {}).get("message", {}).get("parts", ())
            ).strip()
            raise T2CError(f"Task {task.get('id')} ended in {state}{': ' + detail if detail else ''}", -32000, task)
        for artifact in task.get("artifacts", ()):
            for part in artifact.get("parts", ()):
                if "data" in part:
                    return part["data"]
        raise T2CError(f"Task {task.get('id')} returned no JSON artifact", -32001, task)

    def compare_workspace(self, **options: Any) -> Mapping[str, Any]:
        """Compares a Git base ref with committed and uncommitted workspace intent."""
        return self.call("compare_workspace", options)

    def propose_todo(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Synthesizes audited grounded TODO proposals."""
        return self.call("propose_todo", payload)

    def render_todo(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Renders reviewable TODO.patch and JSON audit artifacts."""
        return self.call("render_todo", payload)

    def apply_todo(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Applies an explicitly approved TODO patch and returns its receipt."""
        return self.call("apply_todo", payload)

    def get_task(self, task_id: str, *, history_length: int | None = None, include_artifacts: bool = False) -> Mapping[str, Any]:
        params: dict[str, Any] = {"taskId": task_id, "includeArtifacts": include_artifacts}
        if history_length is not None:
            params["historyLength"] = history_length
        return _unwrap_task(self._rpc("GetTask", params))

    def cancel_task(self, task_id: str) -> Mapping[str, Any]:
        return _unwrap_task(self._rpc("CancelTask", {"taskId": task_id}))

    def list_tasks(self, **params: Any) -> Mapping[str, Any]:
        return self._rpc("ListTasks", params)

    # -- convenience wrappers ---------------------------------------------

    def extract_nl(
        self, file: str, root: str = ".", nl_mode: str | None = None
    ) -> Sequence[IntentRecord]:
        return self.extract_nl_result(file, root, nl_mode).records

    def extract_nl_result(
        self, file: str, root: str = ".", nl_mode: str | None = None
    ) -> ExtractionResult:
        payload: dict[str, Any] = {"file": file, "root": root}
        if nl_mode is not None:
            payload["nlMode"] = nl_mode
        return ExtractionResult.from_dict(self.call("extract_nl", payload))

    def extract_git(self, count: int = 10, root: str = ".") -> Sequence[IntentRecord]:
        result = self.call("extract_git", {"count": count, "root": root})
        return tuple(IntentRecord.from_dict(item) for item in result.get("records", ()))

    def extract_ast(self, root: str = ".") -> Sequence[IntentRecord]:
        result = self.call("extract_ast", {"root": root})
        return tuple(IntentRecord.from_dict(item) for item in result.get("records", ()))

    def extract_markdown(
        self,
        root: str = ".",
        todo: str = "TODO.md",
        changelog: str = "CHANGELOG.md",
        markdown_mode: str | None = None,
    ) -> Sequence[IntentRecord]:
        return self.extract_markdown_result(root, todo, changelog, markdown_mode).records

    def extract_markdown_result(
        self,
        root: str = ".",
        todo: str = "TODO.md",
        changelog: str = "CHANGELOG.md",
        markdown_mode: str | None = None,
    ) -> ExtractionResult:
        payload: dict[str, Any] = {"root": root, "todo": todo, "changelog": changelog}
        if markdown_mode is not None:
            payload["markdownMode"] = markdown_mode
        result = self.call("extract_markdown", payload)
        return ExtractionResult.from_dict(result)

    def extract_docs(
        self,
        root: str = ".",
        patterns: Sequence[str] | None = None,
        excludes: Sequence[str] | None = None,
    ) -> Sequence[IntentRecord]:
        return self.extract_docs_result(root, patterns, excludes).records

    def extract_docs_result(
        self,
        root: str = ".",
        patterns: Sequence[str] | None = None,
        excludes: Sequence[str] | None = None,
    ) -> ExtractionResult:
        payload: dict[str, Any] = {"root": root}
        if patterns is not None:
            payload["patterns"] = list(patterns)
        if excludes is not None:
            payload["excludes"] = list(excludes)
        return ExtractionResult.from_dict(self.call("extract_docs", payload))

    def link(self, records: Iterable[IntentRecord | Mapping[str, Any]]) -> IntentGraph:
        payload = [item.raw if isinstance(item, IntentGraph) else _as_dict(item) for item in records]
        return IntentGraph.from_dict(self.call("link", {"records": payload}))

    def diagnose(self, graph: IntentGraph | Mapping[str, Any]) -> DiagnosticReport:
        return DiagnosticReport.from_dict(self.call("diagnose", {"graph": _graph_dict(graph)}))

    def summarize(
        self,
        graph: IntentGraph | Mapping[str, Any],
        diagnostics: DiagnosticReport | Mapping[str, Any] | None = None,
        fallback: bool = False,
    ) -> Mapping[str, Any]:
        payload: dict[str, Any] = {"graph": _graph_dict(graph), "fallback": fallback}
        if diagnostics is not None:
            payload["diagnostics"] = _report_dict(diagnostics)
        return self.call("summarize", payload)

    def diff_graphs(
        self,
        before: IntentGraph | Mapping[str, Any],
        after: IntentGraph | Mapping[str, Any],
        include_svg: bool = True,
    ) -> Mapping[str, Any]:
        return self.call(
            "diff",
            {"beforeGraph": _graph_dict(before), "afterGraph": _graph_dict(after), "includeSvg": include_svg},
        )

    def diff_graphs_rest(self, **payload: Any) -> Mapping[str, Any]:
        """Graph diff over the REST fast path (``POST /api/diff``).

        Skips the A2A task envelope, so it costs one round-trip instead of a
        task create/complete cycle. Accepts inline graphs (``beforeGraph`` /
        ``afterGraph``) or repository-relative paths (``before`` / ``after``).
        """
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/api/diff",
            data=body,
            headers=self._headers("application/json"),
            method="POST",
        )
        result = self._open(request)
        return result if isinstance(result, Mapping) else {}

    def diff_files(self, before: str, after: str, **options: Any) -> Mapping[str, Any]:
        return self.call("diff_files", {"before": before, "after": after, **options})

    def diff_git(self, **options: Any) -> Mapping[str, Any]:
        return self.call("diff_git", options)

    def reality(
        self,
        graph: IntentGraph | Mapping[str, Any],
        diagnostics: DiagnosticReport | Mapping[str, Any] | None = None,
        **options: Any,
    ) -> Mapping[str, Any]:
        payload: dict[str, Any] = {"graph": _graph_dict(graph), **options}
        if diagnostics is not None:
            payload["diagnostics"] = _report_dict(diagnostics)
        return self.call("reality", payload)

    def pipeline(self, **options: Any) -> Mapping[str, Any]:
        return self.call("pipeline", options)


def _unwrap_task(result: Any) -> Mapping[str, Any]:
    """`SendMessage` wraps the task as ``{"task": ...}``; `GetTask` returns it bare."""
    if isinstance(result, Mapping) and "task" in result:
        return result["task"]
    return result if isinstance(result, Mapping) else {}


def _as_dict(value: Any) -> Mapping[str, Any]:
    if isinstance(value, IntentRecord):
        return {
            "schemaVersion": value.schema_version,
            "id": value.id,
            "statement": value.statement,
            "lifecycle": value.lifecycle,
            "source": value.source,
            "epistemic": value.epistemic,
            "observedAt": value.observed_at,
            "metadata": value.metadata,
        }
    return value


def _graph_dict(value: IntentGraph | Mapping[str, Any]) -> Mapping[str, Any]:
    return value.raw if isinstance(value, IntentGraph) else value


def _report_dict(value: DiagnosticReport | Mapping[str, Any]) -> Mapping[str, Any]:
    return value.raw if isinstance(value, DiagnosticReport) else value
