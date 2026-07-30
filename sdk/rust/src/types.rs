use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceLineRange {
    pub start: u32,
    pub end: u32,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentEpistemic {
    pub class: String,
    pub confidence: f64,
    #[serde(default)]
    pub basis: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentLifecycle {
    pub status: String,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    #[serde(rename = "schemaVersion")]
    pub schema_version: String,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    #[serde(rename = "graphFingerprint")]
    pub graph_fingerprint: String,
    #[serde(default)]
    pub diagnostics: Vec<Diagnostic>,
    #[serde(default)]
    pub counts: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    #[serde(default)]
    pub records: Vec<IntentRecord>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub audit: Value,
}
