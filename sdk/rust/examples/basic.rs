//! Usage test for the todo2code Rust SDK.
//!
//! Start the server first:
//!
//! ```text
//! node dist/src/interfaces/a2a.js
//! ```
//!
//! Then run:
//! ```text
//! cd sdk/rust && cargo run --example basic
//! ```

use std::env;

use serde_json::json;
use todo2code::Client;

const DEFAULT_A2A_URL: &str = "http://localhost:8787";
const DEFAULT_EXAMPLE_ROOT: &str = "examples/backend";
const DEFAULT_COMPARE_BASE: &str = "origin/main";
const TODO_FILE: &str = "TODO.md";
const PATCH_PATH: &str = ".intent-sdk/rust/TODO.patch";
const PATCH_AUDIT_PATH: &str = ".intent-sdk/rust/TODO.patch.json";
const PATCH_RECEIPT_PATH: &str = ".intent-sdk/rust/TODO.patch.receipt.json";

fn main() {
    if let Err(error) = run() {
        eprintln!("example failed: {error}");
        std::process::exit(1);
    }
}

struct ExampleContext {
    base_url: String,
    token: Option<String>,
    root: String,
    compare_base: String,
    compare_workspace: bool,
}

fn run() -> Result<(), todo2code::Error> {
    let context = build_example_context();
    let client = Client::new(&context.base_url, context.token.as_deref());

    println!("health: {}", client.health()?);

    let (record_count, graph, report) = run_extraction(&client, &context.root)?;
    println!("extracted {record_count} records from {}", context.root);

    let patch_hash = run_proposal_flow(&client, &context.root, &graph, &report)?;
    println!("patch fingerprint: {}", truncate_hash(&patch_hash, 16));

    run_reality_view(&client, &graph, &report)?;
    run_diff_view(&client, &context.root)?;
    run_optional_workspace_comparison(&client, &context.root, &context.compare_base, context.compare_workspace)?;

    println!("OK");
    Ok(())
}

fn build_example_context() -> ExampleContext {
    ExampleContext {
        base_url: env::var("T2C_A2A_URL").unwrap_or_else(|_| DEFAULT_A2A_URL.to_owned()),
        token: env::var("T2C_A2A_TOKEN").ok(),
        root: env::var("T2C_EXAMPLE_ROOT").unwrap_or_else(|_| DEFAULT_EXAMPLE_ROOT.to_owned()),
        compare_base: env::var("T2C_COMPARE_BASE").unwrap_or_else(|_| DEFAULT_COMPARE_BASE.to_owned()),
        compare_workspace: env::var("T2C_COMPARE_WORKSPACE").ok().as_deref() == Some("1"),
    }
}

fn run_extraction(
    client: &Client,
    root: &str,
) -> Result<(usize, serde_json::Value, serde_json::Value), todo2code::Error> {
    let diagnostics = run_deterministic_extraction(client, root)?;
    println!("diagnostics: {}", diagnostics["counts"]);
    if let Some(items) = diagnostics["diagnostics"].as_array() {
        for diagnostic in items.iter().take(3) {
            println!(
                "  - [{}] {}: {}",
                diagnostic["severity"], diagnostic["code"], diagnostic["title"]
            );
        }
    }
    Ok(diagnostics)
}

fn run_deterministic_extraction(
    client: &Client,
    root: &str,
) -> Result<(usize, serde_json::Value, serde_json::Value), todo2code::Error> {
    let nl = client.extract_nl_mode(root, "task.md", Some("deterministic"))?;
    validate_audit(&nl.audit, "NL")?;

    let ast = client.extract_ast(root)?;
    let markdown = client.extract_markdown_mode(root, "deterministic")?;
    validate_markdown_audit(&markdown)?;

    let mut records = nl.records;
    records.extend(ast.records);
    records.extend(markdown.records);

    let graph = client.link(&serde_json::to_value(&records)?)?;
    let fingerprint = graph["fingerprint"].as_str().unwrap_or_default();
    println!("graph fingerprint: {}", truncate_hash(fingerprint, 16));

    let report = client.diagnose(&graph)?;
    let report_value = serde_json::to_value(&report)?;
    let record_count = records.len();

    println!(
        "markdown audit: {} {}",
        markdown.audit["status"],
        markdown.audit["effectiveMode"]
    );

    Ok((record_count, graph, report_value))
}

fn validate_audit(audit: &serde_json::Value, label: &str) -> Result<(), todo2code::Error> {
    if audit["status"] != "succeeded" || audit["effectiveMode"] != "deterministic" {
        return Err(todo2code::Error::Protocol(format!("unexpected {label} audit: {audit}")));
    }
    println!("{label} audit: {} {}", audit["status"], audit["effectiveMode"]);
    Ok(())
}

fn validate_markdown_audit(markdown: &serde_json::Value) -> Result<(), todo2code::Error> {
    if markdown["audit"]["status"] != "succeeded" {
        return Err(todo2code::Error::Protocol(format!("unexpected Markdown audit: {}", markdown["audit"])));
    }
    Ok(())
}

fn run_proposal_flow(
    client: &Client,
    root: &str,
    graph: &serde_json::Value,
    report: &serde_json::Value,
) -> Result<String, todo2code::Error> {
    let synthesis = client.propose_todo(&json!({
        "root": root,
        "graph": graph,
        "diagnostics": report,
        "mode": "prefer-llm"
    }))?;

    let rendered = client.render_todo(&json!({
        "root": root,
        "graph": graph,
        "diagnostics": report,
        "synthesis": synthesis,
        "todo": TODO_FILE,
        "patch": PATCH_PATH,
        "audit": PATCH_AUDIT_PATH,
    }))?;

    let patch_hash = rendered["artifact"]["renderedPatchHash"].as_str().unwrap_or_default();
    client.apply_todo(&json!({
        "root": root,
        "todo": TODO_FILE,
        "patch": PATCH_PATH,
        "audit": PATCH_AUDIT_PATH,
        "receipt": PATCH_RECEIPT_PATH,
        "actor": "sdk-rust",
        "approvalHash": patch_hash,
    }))?;

    let validation = synthesis["validation"].as_object().expect("validation payload missing");
    let new_ids = joined_ids(validation.get("newProposalIds"));
    let duplicate_ids = joined_ids(validation.get("duplicateProposalIds"));
    println!("proposal ids: {new_ids}");
    println!("duplicate ids: {duplicate_ids}");

    Ok(patch_hash.to_owned())
}

fn run_reality_view(
    client: &Client,
    graph: &serde_json::Value,
    report: &serde_json::Value,
) -> Result<(), todo2code::Error> {
    let reality = client.reality(graph, Some(report), &json!({ "gapsOnly": true, "includeSvg": true }))?;
    println!(
        "reality svg bytes: {}",
        reality["svg"].as_str().unwrap_or_default().len()
    );
    Ok(())
}

fn run_diff_view(client: &Client, root: &str) -> Result<(), todo2code::Error> {
    let diff = client.diff_git(&json!({ "root": root, "revision": "HEAD", "includeSvg": true }))?;
    println!(
        "git diff files: {}, svg bytes: {}",
        diff["diffs"].as_array().map(Vec::len).unwrap_or(0),
        diff["svg"].as_str().unwrap_or_default().len()
    );
    Ok(())
}

fn run_optional_workspace_comparison(
    client: &Client,
    root: &str,
    compare_base: &str,
    should_compare: bool,
) -> Result<(), todo2code::Error> {
    if !should_compare {
        return Ok(());
    }

    let comparison = client.compare_workspace(&json!({ "root": root, "base": compare_base }))?;
    println!("workspace trend: {}", comparison["trend"]["direction"]);
    Ok(())
}

fn joined_ids(value: Option<&serde_json::Value>) -> String {
    let values = value
        .and_then(serde_json::Value::as_array)
        .map(|items| items.iter().filter_map(|item| item.as_str()).collect::<Vec<_>>())
        .unwrap_or_default();
    if values.is_empty() {
        "-".to_owned()
    } else {
        values.join(",")
    }
}

fn truncate_hash(value: &str, size: usize) -> &str {
    if value.len() <= size {
        value
    } else {
        &value[..size]
    }
}
