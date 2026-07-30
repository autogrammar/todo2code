use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

use crate::{Error, A2A_VERSION};

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
    pub fn new(base_url: &str, token: Option<&str>) -> Self {
        let (host, port, base_path) = parse_base_url(base_url)
            .unwrap_or_else(|_| ("localhost".into(), 8787, String::new()));
        Self {
            host,
            port,
            base_path,
            token: token.map(str::to_owned),
            timeout: Duration::from_secs(120),
            counter: AtomicU64::new(0),
        }
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    fn next_id(&self, prefix: &str) -> String {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_millis())
            .unwrap_or(0);
        format!("{prefix}-{millis}-{}", self.counter.fetch_add(1, Ordering::Relaxed) + 1)
    }

    pub fn health(&self) -> Result<Value, Error> {
        self.get("/healthz")
    }

    pub fn agent_card(&self) -> Result<Value, Error> {
        self.get("/.well-known/agent-card.json")
    }

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
        payload.get("result").cloned()
            .ok_or_else(|| Error::Protocol("response contained no result".into()))
    }

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

    pub fn call(&self, action: &str, input: &Value) -> Result<Value, Error> {
        let task = self.send(action, input)?;
        let state = task.pointer("/status/state").and_then(Value::as_str).unwrap_or("UNKNOWN");
        if state != "TASK_STATE_COMPLETED" {
            let id = task.get("id").and_then(Value::as_str).unwrap_or("?");
            return Err(Error::Runtime { code: -32000, message: format!("task {id} ended in {state}") });
        }
        first_artifact_data(&task).ok_or_else(|| Error::Protocol("task returned no JSON artifact".into()))
    }

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
        if let Some(payload) = body {
            request.push_str(&format!(
                "Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{payload}",
                payload.len()
            ));
        } else {
            request.push_str("\r\n");
        }
        request
    }

    fn exchange(&self, request: &str) -> Result<String, Error> {
        let address = (self.host.as_str(), self.port).to_socket_addrs()?.next()
            .ok_or_else(|| Error::InvalidUrl(format!("{}:{}", self.host, self.port)))?;
        let mut stream = TcpStream::connect_timeout(&address, self.timeout)?;
        stream.set_read_timeout(Some(self.timeout))?;
        stream.set_write_timeout(Some(self.timeout))?;
        stream.write_all(request.as_bytes())?;
        stream.flush()?;
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw)?;
        parse_http_response(&String::from_utf8_lossy(&raw))
    }
}

fn first_artifact_data(task: &Value) -> Option<Value> {
    task.get("artifacts")?.as_array()?.iter().find_map(|artifact| {
        artifact.get("parts")?.as_array()?.iter().find_map(|part| part.get("data").cloned())
    })
}

fn unwrap_task(result: Value) -> Value {
    match result.get("task") {
        Some(task) if !task.is_null() => task.clone(),
        _ => result,
    }
}

fn parse_http_response(response: &str) -> Result<String, Error> {
    let separator = response.find("\r\n\r\n")
        .ok_or_else(|| Error::Protocol("response had no header terminator".into()))?;
    let head = &response[..separator];
    let raw_body = &response[separator + 4..];
    let status = head.lines().next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .unwrap_or(0);
    let body = if head.to_ascii_lowercase().contains("transfer-encoding: chunked") {
        decode_chunked(raw_body)?
    } else {
        raw_body.to_owned()
    };
    if status >= 400 && !body.trim_start().starts_with('{') {
        return Err(Error::Runtime { code: status as i64, message: format!("HTTP {status}") });
    }
    Ok(body)
}

fn parse_base_url(base_url: &str) -> Result<(String, u16, String), Error> {
    let rest = base_url.strip_prefix("http://")
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
        if size == 0 { break; }
        let start = line_end + 2;
        let end = start + size;
        if end > rest.len() { return Err(Error::Protocol("truncated chunk".into())); }
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
