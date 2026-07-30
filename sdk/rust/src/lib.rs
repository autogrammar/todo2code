//! Rust SDK for the todo2code A2A v1.0 endpoint.
//!
//! The client speaks HTTP/1.1 directly over [`std::net::TcpStream`], keeping
//! the dependency surface at `serde`/`serde_json` without an async runtime.
//!
//! ```no_run
//! use todo2code::Client;
//!
//! let client = Client::new("http://localhost:8787", None);
//! let graph = client.link(&serde_json::json!([]))?;
//! println!("{}", graph["fingerprint"]);
//! # Ok::<(), todo2code::Error>(())
//! ```

mod actions;
mod client;
mod error;
mod types;

pub use client::Client;
pub use error::Error;
pub use types::*;

/// The only A2A protocol version the server accepts.
pub const A2A_VERSION: &str = "1.0";

/// Action names accepted by the todo2code runtime.
pub mod action {
    pub const EXTRACT_NL: &str = "extract_nl";
    pub const EXTRACT_GIT: &str = "extract_git";
    pub const EXTRACT_AST: &str = "extract_ast";
    pub const EXTRACT_CONFIG: &str = "extract_config";
    pub const EXTRACT_MARKDOWN: &str = "extract_markdown";
    pub const EXTRACT_DOCS: &str = "extract_docs";
    pub const EXTRACT_COMMUNICATION: &str = "extract_communication";
    pub const ANALYZE_COMMUNICATION: &str = "analyze_communication";
    pub const LINK: &str = "link";
    pub const DIAGNOSE: &str = "diagnose";
    pub const SUMMARIZE: &str = "summarize";
    pub const DIFF: &str = "diff";
    pub const DIFF_FILES: &str = "diff_files";
    pub const DIFF_GIT: &str = "diff_git";
    pub const REALITY: &str = "reality";
    pub const COMPARE_WORKSPACE: &str = "compare_workspace";
    pub const PIPELINE: &str = "pipeline";
    pub const PROPOSE_TODO: &str = "propose_todo";
    pub const RENDER_TODO: &str = "render_todo";
    pub const APPLY_TODO: &str = "apply_todo";
}
