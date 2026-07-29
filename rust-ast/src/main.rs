use proc_macro2::Span;
use quote::ToTokens;
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use syn::spanned::Spanned;
use syn::visit::{self, Visit};

const DEFAULT_MAX_BYTES: u64 = 524_288;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Fact {
    path: String,
    line_start: usize,
    line_end: usize,
    kind: String,
    action: String,
    object: String,
    symbol: Option<String>,
    subject: Option<String>,
    excerpt: String,
    content_hash: String,
    metadata: Map<String, Value>,
}

#[derive(Serialize)]
struct Output {
    facts: Vec<Fact>,
    warnings: Vec<String>,
}

fn main() {
    let (root, max_bytes) = arguments();
    let mut output = Output { facts: Vec::new(), warnings: Vec::new() };
    let mut files = Vec::new();
    collect_files(&root, &root, &mut files, &mut output.warnings);
    files.sort();

    for file in files {
        let relative = slash(file.strip_prefix(&root).unwrap_or(&file));
        let size = match fs::metadata(&file) {
            Ok(metadata) => metadata.len(),
            Err(error) => {
                output.warnings.push(format!("{relative}: {error}"));
                continue;
            }
        };
        if size > max_bytes {
            output.warnings.push(format!(
                "{relative}: skipped, {size} bytes exceeds limit {max_bytes}"
            ));
            continue;
        }
        let source = match fs::read_to_string(&file) {
            Ok(source) => source,
            Err(error) => {
                output.warnings.push(format!("{relative}: {error}"));
                continue;
            }
        };
        match syn::parse_file(&source) {
            Ok(parsed) => {
                let mut collector = Collector::new(relative, &source);
                collector.visit_file(&parsed);
                output.facts.extend(collector.facts);
            }
            Err(error) => output.warnings.push(format!(
                "{relative}:{}:{}: parse error: {error}",
                error.span().start().line,
                error.span().start().column + 1
            )),
        }
    }
    serde_json::to_writer(std::io::stdout(), &output).expect("serialize Rust AST output");
    println!();
}

fn arguments() -> (PathBuf, u64) {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut root = PathBuf::from(".");
    let mut max_bytes = DEFAULT_MAX_BYTES;
    let mut index = 0;
    while index < args.len() {
        if args[index] == "--max-file-bytes" && index + 1 < args.len() {
            max_bytes = args[index + 1].parse().unwrap_or(DEFAULT_MAX_BYTES);
            index += 2;
        } else {
            if !args[index].starts_with('-') {
                root = PathBuf::from(&args[index]);
            }
            index += 1;
        }
    }
    (root.canonicalize().unwrap_or(root), max_bytes)
}

fn collect_files(root: &Path, directory: &Path, output: &mut Vec<PathBuf>, warnings: &mut Vec<String>) {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) => {
            warnings.push(format!("{}: {error}", slash(directory.strip_prefix(root).unwrap_or(directory))));
            return;
        }
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if !matches!(
                name.as_ref(),
                ".git" | ".intent" | "node_modules" | "dist" | "build" | "target" | "coverage" | "vendor"
            ) && !name.starts_with('.') {
                collect_files(root, &path, output, warnings);
            }
        } else if path.extension().and_then(|value| value.to_str()) == Some("rs") {
            output.push(path);
        }
    }
}

struct Collector<'a> {
    relative: String,
    lines: Vec<&'a str>,
    facts: Vec<Fact>,
    modules: Vec<String>,
    impl_type: Option<String>,
    scope: Vec<String>,
}

impl<'a> Collector<'a> {
    fn new(relative: String, source: &'a str) -> Self {
        Self {
            relative,
            lines: source.lines().collect(),
            facts: Vec::new(),
            modules: Vec::new(),
            impl_type: None,
            scope: Vec::new(),
        }
    }

    fn qualified(&self, name: &str) -> String {
        if self.modules.is_empty() { name.to_owned() } else { format!("{}.{}", self.modules.join("."), name) }
    }

    fn add(
        &mut self,
        span: Span,
        kind: &str,
        action: &str,
        object: String,
        symbol: Option<String>,
        subject: Option<String>,
        metadata: Value,
    ) {
        let start = span.start().line.max(1);
        let end = span.end().line.max(start);
        let excerpt = self.excerpt(start, end);
        self.facts.push(Fact {
            path: self.relative.clone(),
            line_start: start,
            line_end: end,
            kind: kind.to_owned(),
            action: action.to_owned(),
            object,
            symbol,
            subject,
            excerpt,
            content_hash: String::new(),
            metadata: metadata.as_object().cloned().unwrap_or_default(),
        });
    }

    fn excerpt(&self, start: usize, end: usize) -> String {
        let from = start.saturating_sub(1).min(self.lines.len());
        let to = end.min(self.lines.len());
        let value = self.lines[from..to].join("\n");
        value.chars().take(2000).collect()
    }

    fn modifiers(attrs: &[syn::Attribute], visibility: &syn::Visibility) -> Value {
        let mut modifiers = BTreeSet::new();
        if !matches!(visibility, syn::Visibility::Inherited) {
            modifiers.insert(visibility.to_token_stream().to_string());
        }
        for attribute in attrs {
            modifiers.insert(format!("#{}", attribute.meta.path().to_token_stream()));
        }
        json!(modifiers)
    }
}

impl<'ast> Visit<'ast> for Collector<'_> {
    fn visit_item_mod(&mut self, node: &'ast syn::ItemMod) {
        let name = node.ident.to_string();
        let symbol = self.qualified(&name);
        self.add(node.span(), "rust_module_fact", "declare", symbol.clone(), Some(symbol.clone()),
            self.modules.last().cloned(), json!({ "kind": "module", "inline": node.content.is_some() }));
        self.modules.push(name);
        visit::visit_item_mod(self, node);
        self.modules.pop();
    }

    fn visit_item_use(&mut self, node: &'ast syn::ItemUse) {
        let dependency = node.tree.to_token_stream().to_string().replace(' ', "");
        self.add(node.span(), "rust_use_fact", "depend_on", dependency.clone(), None,
            self.modules.last().cloned(), json!({ "kind": "use", "dependency": dependency }));
        visit::visit_item_use(self, node);
    }

    fn visit_item_struct(&mut self, node: &'ast syn::ItemStruct) {
        self.type_item(node.span(), &node.ident, "struct", &node.attrs, &node.vis);
        visit::visit_item_struct(self, node);
    }

    fn visit_item_enum(&mut self, node: &'ast syn::ItemEnum) {
        self.type_item(node.span(), &node.ident, "enum", &node.attrs, &node.vis);
        visit::visit_item_enum(self, node);
    }

    fn visit_item_trait(&mut self, node: &'ast syn::ItemTrait) {
        self.type_item(node.span(), &node.ident, "trait", &node.attrs, &node.vis);
        visit::visit_item_trait(self, node);
    }

    fn visit_item_type(&mut self, node: &'ast syn::ItemType) {
        self.type_item(node.span(), &node.ident, "type", &node.attrs, &node.vis);
        visit::visit_item_type(self, node);
    }

    fn visit_item_const(&mut self, node: &'ast syn::ItemConst) {
        let symbol = self.qualified(&node.ident.to_string());
        self.add(node.span(), "rust_value_fact", "declare", symbol.clone(), Some(symbol),
            self.modules.last().cloned(), json!({ "kind": "const", "modifiers": Self::modifiers(&node.attrs, &node.vis) }));
        visit::visit_item_const(self, node);
    }

    fn visit_item_static(&mut self, node: &'ast syn::ItemStatic) {
        let symbol = self.qualified(&node.ident.to_string());
        self.add(node.span(), "rust_value_fact", "declare", symbol.clone(), Some(symbol),
            self.modules.last().cloned(), json!({ "kind": "static", "modifiers": Self::modifiers(&node.attrs, &node.vis) }));
        visit::visit_item_static(self, node);
    }

    fn visit_item_fn(&mut self, node: &'ast syn::ItemFn) {
        let symbol = self.qualified(&node.sig.ident.to_string());
        self.add(node.span(), "rust_function_fact", "declare", symbol.clone(), Some(symbol.clone()),
            self.modules.last().cloned(), json!({
                "kind": "function", "async": node.sig.asyncness.is_some(), "unsafe": node.sig.unsafety.is_some(),
                "parameterCount": node.sig.inputs.len(), "modifiers": Self::modifiers(&node.attrs, &node.vis)
            }));
        self.scope.push(symbol);
        visit::visit_item_fn(self, node);
        self.scope.pop();
    }

    fn visit_item_impl(&mut self, node: &'ast syn::ItemImpl) {
        let previous = self.impl_type.replace(node.self_ty.to_token_stream().to_string().replace(' ', ""));
        visit::visit_item_impl(self, node);
        self.impl_type = previous;
    }

    fn visit_impl_item_fn(&mut self, node: &'ast syn::ImplItemFn) {
        let receiver = self.impl_type.clone().unwrap_or_else(|| "impl".to_owned());
        let symbol = format!("{receiver}.{}", node.sig.ident);
        self.add(node.span(), "rust_method_fact", "declare", symbol.clone(), Some(symbol.clone()),
            Some(receiver.clone()), json!({
                "kind": "method", "receiver": receiver, "async": node.sig.asyncness.is_some(),
                "unsafe": node.sig.unsafety.is_some(), "parameterCount": node.sig.inputs.len()
            }));
        self.scope.push(symbol);
        visit::visit_impl_item_fn(self, node);
        self.scope.pop();
    }

    fn visit_expr_call(&mut self, node: &'ast syn::ExprCall) {
        let callee = node.func.to_token_stream().to_string().replace(' ', "");
        let scope = self.scope.last().cloned();
        self.add(node.span(), "rust_call_fact", "call", callee.clone(), scope.clone(), scope,
            json!({ "callee": callee, "argumentCount": node.args.len() }));
        visit::visit_expr_call(self, node);
    }

    fn visit_expr_method_call(&mut self, node: &'ast syn::ExprMethodCall) {
        let callee = node.method.to_string();
        let scope = self.scope.last().cloned();
        self.add(node.span(), "rust_call_fact", "call", callee.clone(), scope.clone(), scope,
            json!({ "callee": callee, "argumentCount": node.args.len(), "method": true }));
        visit::visit_expr_method_call(self, node);
    }
}

impl Collector<'_> {
    fn type_item(
        &mut self,
        span: Span,
        ident: &syn::Ident,
        kind: &str,
        attrs: &[syn::Attribute],
        visibility: &syn::Visibility,
    ) {
        let symbol = self.qualified(&ident.to_string());
        self.add(span, "rust_type_fact", "declare", symbol.clone(), Some(symbol),
            self.modules.last().cloned(), json!({ "kind": kind, "modifiers": Self::modifiers(attrs, visibility) }));
    }
}

fn slash(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
