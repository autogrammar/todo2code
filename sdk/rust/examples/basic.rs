//! Usage test for the todo2code Rust SDK.
//!
//! Start the server first:
//!
//! ```text
//! node dist/src/interfaces/a2a.js
//! ```
//!
//! Then run:
//!
//! ```text
//! cd sdk/rust && cargo run --example basic
//! ```

use std::env;

use serde_json::json;
use todo2code::Client;

fn main() {
    if let Err(error) = run() {
        eprintln!("example failed: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), todo2code::Error> {
    let base_url = env::var("T2C_A2A_URL").unwrap_or_else(|_| "http://localhost:8787".to_owned());
    let token = env::var("T2C_A2A_TOKEN").ok();
    let root = env::var("T2C_EXAMPLE_ROOT").unwrap_or_else(|_| "examples/backend".to_owned());

    let client = Client::new(&base_url, token.as_deref());

    println!("health: {}", client.health()?);

    // 1. Deterministic extraction -> graph -> diagnostics.
    let nl = client.extract_nl_mode(&root, "task.md", Some("deterministic"))?;
    if nl.audit["status"] != "succeeded" || nl.audit["effectiveMode"] != "deterministic" {
        return Err(todo2code::Error::Protocol(format!("unexpected NL audit: {}", nl.audit)));
    }
    println!("NL audit: {} {}", nl.audit["status"], nl.audit["effectiveMode"]);
    let ast = client.extract_ast(&root)?;
    let markdown = client.extract_markdown_mode(&root, "deterministic")?;
    if markdown.audit["status"] != "succeeded" {
        return Err(todo2code::Error::Protocol(format!("unexpected Markdown audit: {}", markdown.audit)));
    }
    println!("markdown audit: {} {}", markdown.audit["status"], markdown.audit["effectiveMode"]);
    println!("extracted {} records from {root}", nl.records.len() + ast.records.len() + markdown.records.len());

    let mut records = nl.records;
    records.extend(ast.records);
    records.extend(markdown.records);
    let graph = client.link(&serde_json::to_value(&records)?)?;
    let fingerprint = graph["fingerprint"].as_str().unwrap_or_default();
    println!("graph fingerprint: {}", &fingerprint[..fingerprint.len().min(16)]);

    let report = client.diagnose(&graph)?;
    println!("diagnostics: {}", report.counts);
    for diagnostic in report.diagnostics.iter().take(3) {
        println!("  - [{}] {}: {}", diagnostic.severity, diagnostic.code, diagnostic.title);
    }

    // 2. Intent-vs-reality view.
    let diagnostics_value = serde_json::to_value(&report)?;
    let reality = client.reality(&graph, Some(&diagnostics_value), &json!({ "gapsOnly": true, "includeSvg": true }))?;
    println!("reality svg bytes: {}", reality["svg"].as_str().unwrap_or_default().len());

    // 3. Git diff rendered as SVG.
    let diff = client.diff_git(&json!({ "root": root, "revision": "HEAD", "includeSvg": true }))?;
    println!(
        "git diff files: {}, svg bytes: {}",
        diff["diffs"].as_array().map(Vec::len).unwrap_or(0),
        diff["svg"].as_str().unwrap_or_default().len()
    );

    // 4. Optional origin/main -> local filesystem Intent comparison.
    if env::var("T2C_COMPARE_WORKSPACE").ok().as_deref() == Some("1") {
        let base = env::var("T2C_COMPARE_BASE").unwrap_or_else(|_| "origin/main".to_owned());
        let comparison = client.compare_workspace(&json!({ "root": root, "base": base }))?;
        println!("workspace trend: {}", comparison["trend"]["direction"]);
    }

    println!("OK");
    Ok(())
}
