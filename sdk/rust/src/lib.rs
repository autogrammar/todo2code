//! Rust SDK for the todo2code A2A v1.0 endpoint.
//!
//! The client speaks HTTP/1.1 directly over [`std::net::TcpStream`], which keeps
//! the dependency surface at `serde`/`serde_json` and avoids pulling an async
//! runtime in for what are short, blocking calls.
//!
//! # Transport
//!
//! Plaintext HTTP only. The todo2code A2A server binds to `T2C_A2A_HOST`
//! without TLS; terminate TLS in a reverse proxy when exposing it beyond
//! localhost.
//!
//! # Example
//!
//! ```no_run
//! use todo2code::Client;
//!
//! let client = Client::new("http://localhost:8787", None);
//! let graph = client.link(&serde_json::json!([]))?;
//! println!("{}", graph["fingerprint"]);
//! # Ok::<(), todo2code::Error>(())
//! ```

use std::fmt;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// The only A2A protocol version the server accepts.
pub const A2A_VERSION: &str = "1.0";

/// Action names accepted by the todo2code runtime.
pub mod action {
    pub const EXTRACT_NL: &str = "extract_nl";
    pub const EXTRACT_GIT: &str = "extract_git";
    pub const EXTRACT_AST: &str = "extract_ast";
    pub const EXTRACT_MARKDOWN: &str = "extract_markdown";
    pub const EXTRACT_DOCS: &str = "extract_docs";
    pub const LINK: &str = "link";
    pub const DIAGNOSE: &str = "diagnose";
    pub const SUMMARIZE: &str = "summarize";
    pub const DIFF: &str = "diff";
    pub const DIFF_FILES: &str = "diff_files";
    pub const DIFF_GIT: &str = "diff_git";
    pub const REALITY: &str = "reality";
    pub const COMPARE_WORKSPACE: &str = "compare_workspace";
    pub const PIPELINE: &str = "pipeline";
}

/// Errors returned by the SDK.
#[derive(Debug)]
pub enum Error {
    /// The URL could not be parsed or resolved.
    InvalidUrl(String),
    /// Socket-level failure.
    Io(std::io::Error),
    /// The response body was not valid JSON.
    Json(serde_json::Error),
    /// The runtime returned a JSON-RPC error, or a task did not complete.
    Runtime { code: i64, message: String },
    /// The response was well formed but did not contain what was expected.
    Protocol(String),
}

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::InvalidUrl(value) => write!(formatter, "invalid url: {value}"),
            Error::Io(error) => write!(formatter, "io error: {error}"),
            Error::Json(error) => write!(formatter, "json error: {error}"),
            Error::Runtime { code, message } => write!(formatter, "todo2code error {code}: {message}"),
            Error::Protocol(message) => write!(formatter, "protocol error: {message}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Error::Io(error)
    }
}

impl From<serde_json::Error> for Error {
    fn from(error: serde_json::Error) -> Self {
        Error::Json(error)
    }
}

/// The 1-based inclusive line span a record was taken from.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceLineRange {
    pub start: u32,
    pub end: u32,
}

/// Resolved targets of a statement.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IntentTarget {
    #[serde(default)]
    pub paths: Vec<String>,
    #[serde(default)]
    pub symbols: Vec<String>,
    #[serde(default)]
    pub tickets: Vec<String>,
    #[serde(default)]
    pub versions: Vec<String>,
}

/// The normalized intent expressed by a record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentStatement {
    pub kind: String,
    pub actor: Option<String>,
    pub action: String,
    pub subject: Option<String>,
    pub object: String,
    #[serde(default)]
    pub target: IntentTarget,
    pub modality: String,
    pub polarity: String,
    pub text: String,
}

/// Exactly where a statement came from.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentSource {
    pub kind: String,
    pub path: Option<String>,
    pub lines: Option<SourceLineRange>,
    pub revision: Option<String>,
    pub symbol: Option<String>,
    #[serde(rename = "commitIndex")]
    pub commit_index: Option<i64>,
    pub extractor: String,
    #[serde(rename = "contentHash")]
    pub content_hash: String,
    #[serde(rename = "rawExcerpt")]
    pub raw_excerpt: Option<String>,
}

/// Confidence and its justification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentEpistemic {
    pub class: String,
    pub confidence: f64,
    #[serde(default)]
    pub basis: Vec<String>,
}

/// Lifecycle status wrapper.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentLifecycle {
    pub status: String,
}

/// A single `t2c.intent/v1` record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentRecord {
    #[serde(rename = "schemaVersion")]
    pub schema_version: String,
    pub id: String,
    pub statement: IntentStatement,
    pub lifecycle: IntentLifecycle,
    pub source: IntentSource,
    pub epistemic: IntentEpistemic,
    #[serde(rename = "observedAt")]
    pub observed_at: Option<String>,
    #[serde(default)]
    pub metadata: Value,
}

/// One detected alignment finding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub id: String,
    pub code: String,
    pub severity: String,
    pub title: String,
    pub detail: String,
    #[serde(rename = "recordIds", default)]
    pub record_ids: Vec<String>,
    #[serde(rename = "suggestedAction", default)]
    pub suggested_action: String,
}

/// The `t2c.diagnostics/v1` payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    #[serde(rename = "graphFingerprint")]
    pub graph_fingerprint: String,
    #[serde(default)]
    pub diagnostics: Vec<Diagnostic>,
    #[serde(default)]
    pub counts: Value,
}

/// What every `extract_*` action returns.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    #[serde(default)]
    pub records: Vec<IntentRecord>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub audit: Value,
}

/// Client for a todo2code A2A server.
pub struct Client {
    host: String,
    port: u16,
    base_path: String,
    token: Option<String>,
    timeout: Duration,
    counter: AtomicU64,
}

impl Client {
    /// Creates a client for `base_url`, for example `http://localhost:8787`.
    pub fn new(base_url: &str, token: Option<&str>) -> Self {
        let (host, port, base_path) = parse_base_url(base_url).unwrap_or_else(|_| ("localhost".into(), 8787, String::new()));
        Self {
            host,
            port,
            base_path,
            token: token.map(str::to_owned),
            timeout: Duration::from_secs(120),
            counter: AtomicU64::new(0),
        }
    }

    /// Overrides the socket read/write timeout.
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    fn next_id(&self, prefix: &str) -> String {
        let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_millis()).unwrap_or(0);
        format!("{prefix}-{millis}-{}", self.counter.fetch_add(1, Ordering::Relaxed) + 1)
    }

    /// Returns the server liveness payload.
    pub fn health(&self) -> Result<Value, Error> {
        self.get("/healthz")
    }

    /// Returns the advertised A2A agent card.
    pub fn agent_card(&self) -> Result<Value, Error> {
        self.get("/.well-known/agent-card.json")
    }

    /// Performs one JSON-RPC call and returns the raw result.
    pub fn rpc(&self, method: &str, params: Value) -> Result<Value, Error> {
        let body = json!({
            "jsonrpc": "2.0",
            "id": self.next_id("req"),
            "method": method,
            "params": params,
        });
        let response = self.post("/a2a", &serde_json::to_string(&body)?)?;
        let payload: Value = serde_json::from_str(&response)?;
        if let Some(error) = payload.get("error").filter(|value| !value.is_null()) {
            return Err(Error::Runtime {
                code: error.get("code").and_then(Value::as_i64).unwrap_or(-32000),
                message: error.get("message").and_then(Value::as_str).unwrap_or("unknown error").to_owned(),
            });
        }
        payload
            .get("result")
            .cloned()
            .ok_or_else(|| Error::Protocol("response contained no result".into()))
    }

    /// Runs one action and returns the resulting A2A task.
    pub fn send(&self, action: &str, input: &Value) -> Result<Value, Error> {
        let params = json!({
            "message": {
                "messageId": self.next_id("msg"),
                "role": "ROLE_USER",
                "parts": [{ "data": { "action": action, "input": input }, "mediaType": "application/json" }],
            }
        });
        Ok(unwrap_task(self.rpc("SendMessage", params)?))
    }

    /// Runs one action and unwraps the first JSON artifact.
    pub fn call(&self, action: &str, input: &Value) -> Result<Value, Error> {
        let task = self.send(action, input)?;
        let state = task.pointer("/status/state").and_then(Value::as_str).unwrap_or("UNKNOWN");
        if state != "TASK_STATE_COMPLETED" {
            let id = task.get("id").and_then(Value::as_str).unwrap_or("?");
            return Err(Error::Runtime {
                code: -32000,
                message: format!("task {id} ended in {state}"),
            });
        }
        task.get("artifacts")
            .and_then(Value::as_array)
            .and_then(|artifacts| artifacts.iter().find_map(|artifact| {
                artifact
                    .get("parts")
                    .and_then(Value::as_array)
                    .and_then(|parts| parts.iter().find_map(|part| part.get("data").cloned()))
            }))
            .ok_or_else(|| Error::Protocol("task returned no JSON artifact".into()))
    }

    /// Extracts AST facts from `root`.
    pub fn extract_ast(&self, root: &str) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(action::EXTRACT_AST, &json!({ "root": root }))?)?)
    }

    /// Extracts TODO and CHANGELOG records from `root`.
    pub fn extract_markdown(&self, root: &str) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(action::EXTRACT_MARKDOWN, &json!({ "root": root }))?)?)
    }

    /// Extracts TODO and CHANGELOG records with an explicit LLM mode.
    pub fn extract_markdown_mode(&self, root: &str, markdown_mode: &str) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(
            action::EXTRACT_MARKDOWN,
            &json!({ "root": root, "markdownMode": markdown_mode }),
        )?)?)
    }

    /// Extracts intent claims from the last `count` commits.
    pub fn extract_git(&self, root: &str, count: u32) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(action::EXTRACT_GIT, &json!({ "root": root, "count": count }))?)?)
    }

    /// Builds the deterministic evidence graph from `records`.
    pub fn link(&self, records: &Value) -> Result<Value, Error> {
        self.call(action::LINK, &json!({ "records": records }))
    }

    /// Runs alignment diagnostics over `graph`.
    pub fn diagnose(&self, graph: &Value) -> Result<DiagnosticReport, Error> {
        Ok(serde_json::from_value(self.call(action::DIAGNOSE, &json!({ "graph": graph }))?)?)
    }

    /// Compares declared intent against observed code for one graph.
    pub fn reality(&self, graph: &Value, diagnostics: Option<&Value>, options: &Value) -> Result<Value, Error> {
        let mut input = json!({ "graph": graph });
        if let Some(report) = diagnostics {
            input["diagnostics"] = report.clone();
        }
        merge(&mut input, options);
        self.call(action::REALITY, &input)
    }

    /// Renders the Git work tree or index against a revision.
    pub fn diff_git(&self, options: &Value) -> Result<Value, Error> {
        self.call(action::DIFF_GIT, options)
    }

    /// Renders a diff between two files under the server root.
    pub fn diff_files(&self, before: &str, after: &str, options: &Value) -> Result<Value, Error> {
        let mut input = json!({ "before": before, "after": after });
        merge(&mut input, options);
        self.call(action::DIFF_FILES, &input)
    }

    /// Compares two intent graphs.
    pub fn diff_graphs(&self, before: &Value, after: &Value, include_svg: bool) -> Result<Value, Error> {
        self.call(action::DIFF, &json!({ "beforeGraph": before, "afterGraph": after, "includeSvg": include_svg }))
    }

    /// Compares a Git base ref with committed and uncommitted workspace intent.
    pub fn compare_workspace(&self, options: &Value) -> Result<Value, Error> {
        self.call(action::COMPARE_WORKSPACE, options)
    }

    /// Runs the full todo2code pipeline on the server.
    pub fn pipeline(&self, options: &Value) -> Result<Value, Error> {
        self.call(action::PIPELINE, options)
    }

    // -- transport ----------------------------------------------------------

    fn get(&self, path: &str) -> Result<Value, Error> {
        let request = self.build_request("GET", path, None);
        Ok(serde_json::from_str(&self.exchange(&request)?)?)
    }

    fn post(&self, path: &str, body: &str) -> Result<String, Error> {
        let request = self.build_request("POST", path, Some(body));
        self.exchange(&request)
    }

    fn build_request(&self, method: &str, path: &str, body: Option<&str>) -> String {
        let target = format!("{}{}", self.base_path, path);
        let mut request = format!(
            "{method} {target} HTTP/1.1\r\nHost: {}:{}\r\nAccept: application/json\r\nA2A-Version: {A2A_VERSION}\r\nConnection: close\r\n",
            self.host, self.port
        );
        if let Some(token) = &self.token {
            request.push_str(&format!("Authorization: Bearer {token}\r\n"));
        }
        match body {
            Some(payload) => {
                request.push_str(&format!(
                    "Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{payload}",
                    payload.len()
                ));
            }
            None => request.push_str("\r\n"),
        }
        request
    }

    fn exchange(&self, request: &str) -> Result<String, Error> {
        let address = (self.host.as_str(), self.port)
            .to_socket_addrs()?
            .next()
            .ok_or_else(|| Error::InvalidUrl(format!("{}:{}", self.host, self.port)))?;
        let mut stream = TcpStream::connect_timeout(&address, self.timeout)?;
        stream.set_read_timeout(Some(self.timeout))?;
        stream.set_write_timeout(Some(self.timeout))?;
        stream.write_all(request.as_bytes())?;
        stream.flush()?;

        let mut raw = Vec::new();
        stream.read_to_end(&mut raw)?;
        let response = String::from_utf8_lossy(&raw).into_owned();
        let separator = response
            .find("\r\n\r\n")
            .ok_or_else(|| Error::Protocol("response had no header terminator".into()))?;
        let head = &response[..separator];
        let body = &response[separator + 4..];

        let status = head
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .and_then(|code| code.parse::<u16>().ok())
            .unwrap_or(0);

        // `Connection: close` means the server may still answer with chunked
        // transfer encoding; decode it before handing the body to serde.
        let body = if head.to_ascii_lowercase().contains("transfer-encoding: chunked") {
            decode_chunked(body)?
        } else {
            body.to_owned()
        };

        if status >= 400 && !body.trim_start().starts_with('{') {
            return Err(Error::Runtime { code: status as i64, message: format!("HTTP {status}") });
        }
        Ok(body)
    }
}

/// `SendMessage` wraps the task as `{"task": …}`; `GetTask` returns it bare.
fn unwrap_task(result: Value) -> Value {
    match result.get("task") {
        Some(task) if !task.is_null() => task.clone(),
        _ => result,
    }
}

fn merge(target: &mut Value, extra: &Value) {
    if let (Some(map), Some(source)) = (target.as_object_mut(), extra.as_object()) {
        for (key, value) in source {
            map.insert(key.clone(), value.clone());
        }
    }
}

fn parse_base_url(base_url: &str) -> Result<(String, u16, String), Error> {
    let rest = base_url
        .strip_prefix("http://")
        .ok_or_else(|| Error::InvalidUrl(format!("{base_url} (only http:// is supported)")))?;
    let (authority, path) = match rest.find('/') {
        Some(index) => (&rest[..index], rest[index..].trim_end_matches('/').to_owned()),
        None => (rest, String::new()),
    };
    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => (
            host.to_owned(),
            port.parse::<u16>().map_err(|_| Error::InvalidUrl(base_url.to_owned()))?,
        ),
        None => (authority.to_owned(), 80),
    };
    Ok((host, port, path))
}

fn decode_chunked(body: &str) -> Result<String, Error> {
    let mut output = String::new();
    let mut rest = body;
    loop {
        let line_end = rest.find("\r\n").ok_or_else(|| Error::Protocol("malformed chunk header".into()))?;
        let size = usize::from_str_radix(rest[..line_end].trim(), 16)
            .map_err(|_| Error::Protocol("malformed chunk size".into()))?;
        if size == 0 {
            break;
        }
        let start = line_end + 2;
        let end = start + size;
        if end > rest.len() {
            return Err(Error::Protocol("truncated chunk".into()));
        }
        output.push_str(&rest[start..end]);
        rest = &rest[(end + 2).min(rest.len())..];
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_base_urls() {
        assert_eq!(parse_base_url("http://localhost:8787").unwrap(), ("localhost".into(), 8787, String::new()));
        assert_eq!(parse_base_url("http://example.test").unwrap(), ("example.test".into(), 80, String::new()));
        assert!(parse_base_url("https://example.test").is_err());
    }

    #[test]
    fn decodes_chunked_bodies() {
        assert_eq!(decode_chunked("4\r\ntest\r\n0\r\n\r\n").unwrap(), "test");
    }
}
