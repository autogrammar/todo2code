use serde_json::{json, Value};

use crate::{action, Client, DiagnosticReport, Error, ExtractionResult};

impl Client {
    pub fn extract_ast(&self, root: &str) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(action::EXTRACT_AST, &json!({ "root": root }))?)?)
    }

    pub fn extract_config(&self, root: &str) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(action::EXTRACT_CONFIG, &json!({ "root": root }))?)?)
    }

    pub fn extract_nl(&self, root: &str, file: &str) -> Result<ExtractionResult, Error> {
        self.extract_nl_mode(root, file, None)
    }

    pub fn extract_nl_mode(&self, root: &str, file: &str, nl_mode: Option<&str>) -> Result<ExtractionResult, Error> {
        let mut input = json!({ "root": root, "file": file });
        if let Some(mode) = nl_mode { input["nlMode"] = json!(mode); }
        Ok(serde_json::from_value(self.call(action::EXTRACT_NL, &input)?)?)
    }

    pub fn extract_docs(&self, root: &str, patterns: &[&str], excludes: &[&str]) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(
            action::EXTRACT_DOCS,
            &json!({ "root": root, "patterns": patterns, "excludes": excludes }),
        )?)?)
    }

    pub fn extract_markdown(&self, root: &str) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(action::EXTRACT_MARKDOWN, &json!({ "root": root }))?)?)
    }

    pub fn extract_markdown_mode(&self, root: &str, markdown_mode: &str) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(
            action::EXTRACT_MARKDOWN,
            &json!({ "root": root, "markdownMode": markdown_mode }),
        )?)?)
    }

    pub fn extract_git(&self, root: &str, count: u32) -> Result<ExtractionResult, Error> {
        Ok(serde_json::from_value(self.call(action::EXTRACT_GIT, &json!({ "root": root, "count": count }))?)?)
    }

    pub fn link(&self, records: &Value) -> Result<Value, Error> {
        self.call(action::LINK, &json!({ "records": records }))
    }

    pub fn diagnose(&self, graph: &Value) -> Result<DiagnosticReport, Error> {
        Ok(serde_json::from_value(self.call(action::DIAGNOSE, &json!({ "graph": graph }))?)?)
    }

    pub fn reality(&self, graph: &Value, diagnostics: Option<&Value>, options: &Value) -> Result<Value, Error> {
        let mut input = json!({ "graph": graph });
        if let Some(report) = diagnostics { input["diagnostics"] = report.clone(); }
        merge(&mut input, options);
        self.call(action::REALITY, &input)
    }

    pub fn diff_git(&self, options: &Value) -> Result<Value, Error> {
        self.call(action::DIFF_GIT, options)
    }

    pub fn diff_files(&self, before: &str, after: &str, options: &Value) -> Result<Value, Error> {
        let mut input = json!({ "before": before, "after": after });
        merge(&mut input, options);
        self.call(action::DIFF_FILES, &input)
    }

    pub fn diff_graphs(&self, before: &Value, after: &Value, include_svg: bool) -> Result<Value, Error> {
        self.call(action::DIFF, &json!({ "beforeGraph": before, "afterGraph": after, "includeSvg": include_svg }))
    }

    pub fn compare_workspace(&self, options: &Value) -> Result<Value, Error> {
        self.call(action::COMPARE_WORKSPACE, options)
    }

    pub fn pipeline(&self, options: &Value) -> Result<Value, Error> {
        self.call(action::PIPELINE, options)
    }

    pub fn propose_todo(&self, input: &Value) -> Result<Value, Error> {
        self.call(action::PROPOSE_TODO, input)
    }

    pub fn render_todo(&self, input: &Value) -> Result<Value, Error> {
        self.call(action::RENDER_TODO, input)
    }

    pub fn apply_todo(&self, input: &Value) -> Result<Value, Error> {
        self.call(action::APPLY_TODO, input)
    }
}

fn merge(target: &mut Value, extra: &Value) {
    if let (Some(map), Some(source)) = (target.as_object_mut(), extra.as_object()) {
        for (key, value) in source { map.insert(key.clone(), value.clone()); }
    }
}
