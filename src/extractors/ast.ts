import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import type { T2CConfig } from '../config/env.js';
import { readText, relativePosix, walkFiles, pathExists } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type { ExtractionResult, IntentAction, IntentRecord, JsonValue } from '../core/types.js';

const execFileAsync = promisify(execFile);
const JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

interface AdapterFact {
  path: string;
  lineStart: number;
  lineEnd: number;
  kind: string;
  action: IntentAction;
  object: string;
  symbol: string | null;
  subject: string | null;
  excerpt: string;
  contentHash: string;
  metadata: Record<string, JsonValue>;
}

interface AdapterOutput {
  facts: AdapterFact[];
  warnings: string[];
}

export interface AstExtractionOptions {
  root: string;
}

export async function extractAstIntent(options: AstExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  const root = path.resolve(options.root);
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const files = await walkFiles(root, { extensions: JS_EXTENSIONS, maxFiles: 20_000 });

  for (const file of files) {
    try {
      const body = await readText(file, config.maxFileBytes);
      records.push(...extractTypeScriptFile(root, file, body));
    } catch (error) {
      warnings.push(`${relativePosix(root, file)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (config.enablePythonAst) {
    const python = await extractPythonAst(root, config);
    records.push(...python.records);
    warnings.push(...python.warnings);
  }
  if (config.enableGoAst) {
    const go = await extractGoAst(root, config);
    records.push(...go.records);
    warnings.push(...go.warnings);
  }
  if (config.enableJavaAst) {
    const java = await extractJavaAst(root, config);
    records.push(...java.records);
    warnings.push(...java.warnings);
  }
  if (config.enableRustAst) {
    const rust = await extractRustAst(root, config);
    records.push(...rust.records);
    warnings.push(...rust.warnings);
  }
  return { records, warnings };
}

function extractTypeScriptFile(root: string, filePath: string, body: string): IntentRecord[] {
  const relative = relativePosix(root, filePath);
  const sourceFile = ts.createSourceFile(filePath, body, ts.ScriptTarget.Latest, true, scriptKind(filePath));
  const records: IntentRecord[] = [];
  const scope: string[] = [];

  function lineRange(node: ts.Node): { start: number; end: number } {
    return {
      start: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      end: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
    };
  }

  function excerpt(node: ts.Node): string {
    return node.getText(sourceFile).slice(0, 2000);
  }

  function add(node: ts.Node, input: {
    kind: string;
    action: IntentAction;
    object: string;
    symbol?: string | null;
    subject?: string | null;
    metadata?: Record<string, JsonValue>;
  }): void {
    const symbol = input.symbol ?? null;
    records.push(buildRecord({
      kind: input.kind,
      action: input.action,
      subject: input.subject ?? (scope.length ? scope.join('.') : null),
      object: input.object,
      target: {
        paths: [relative],
        symbols: symbol ? [symbol] : [],
      },
      modality: 'observed',
      text: `${input.action} ${input.object}`,
      lifecycle: 'implemented',
      sourceKind: 'ast',
      sourcePath: relative,
      sourceLines: lineRange(node),
      symbol,
      extractor: 't2c/typescript-ast@1',
      rawExcerpt: excerpt(node),
      epistemicClass: 'fact',
      confidence: 1,
      basis: ['typescript_compiler_ast'],
      metadata: {
        language: languageName(filePath),
        syntaxKind: ts.SyntaxKind[node.kind] ?? String(node.kind),
        llmUsed: false,
        ...(input.metadata ?? {}),
      },
    }));
  }

  function nameOf(node: ts.Node & { name?: ts.Node }): string | null {
    if (!node.name) return null;
    return node.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
  }

  function modifiers(node: ts.Node): string[] {
    if (!ts.canHaveModifiers(node)) return [];
    return (ts.getModifiers(node) ?? []).map((modifier) => ts.SyntaxKind[modifier.kind] ?? String(modifier.kind));
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      add(node, { kind: 'module_dependency_fact', action: 'depend_on', object: node.moduleSpecifier.text, metadata: { importClause: node.importClause?.getText(sourceFile) ?? null } });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      add(node, { kind: 'module_dependency_fact', action: 'depend_on', object: node.moduleSpecifier.text, metadata: { reExport: true } });
    } else if (
      ts.isFunctionDeclaration(node)
      || ts.isClassDeclaration(node)
      || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node)
      || ts.isEnumDeclaration(node)
      || ts.isMethodDeclaration(node)
    ) {
      const symbol = nameOf(node);
      if (symbol) {
        add(node, {
          kind: 'symbol_fact',
          action: 'declare',
          object: symbol,
          symbol,
          metadata: {
            symbolKind: ts.SyntaxKind[node.kind] ?? 'unknown',
            modifiers: modifiers(node),
            exported: modifiers(node).includes('ExportKeyword'),
          },
        });
        scope.push(symbol);
        ts.forEachChild(node, visit);
        scope.pop();
        return;
      }
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const declarationIsCallable = Boolean(node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));
      if (declarationIsCallable || isTopLevel(node)) {
        add(node, {
          kind: 'symbol_fact',
          action: 'declare',
          object: node.name.text,
          symbol: node.name.text,
          metadata: { symbolKind: declarationIsCallable ? 'callable_variable' : 'variable' },
        });
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile).slice(0, 300);
      add(node, {
        kind: 'call_fact',
        action: 'call',
        object: callee,
        symbol: scope.length ? scope.join('.') : null,
        metadata: { callee, argumentCount: node.arguments.length },
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return records;
}

function isTopLevel(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current) || ts.isClassLike(current)) return false;
    if (ts.isSourceFile(current)) return true;
    current = current.parent;
  }
  return false;
}

function scriptKind(filePath: string): ts.ScriptKind {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.tsx') return ts.ScriptKind.TSX;
  if (extension === '.jsx') return ts.ScriptKind.JSX;
  if (['.js', '.mjs', '.cjs'].includes(extension)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function languageName(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return ['.js', '.jsx', '.mjs', '.cjs'].includes(extension) ? 'javascript' : 'typescript';
}

/**
 * Runs the Go adapter through `go run`, mirroring the Python helper.
 *
 * The Go toolchain is optional: a repository without Go sources, or a machine
 * without `go` installed, degrades to a warning instead of failing the run.
 */
async function extractGoAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../golang/ast_extract.go');
  if (!(await pathExists(script))) return { records: [], warnings: [`Go AST helper not found: ${script}`] };

  // `go run` compiles the helper on every call, so skip the cost entirely when
  // the tree holds no Go sources.
  const goFiles = await walkFiles(root, { extensions: ['.go'], maxFiles: 20_000 });
  if (goFiles.length === 0) return { records: [], warnings: [] };

  try {
    const result = await execFileAsync(config.goExecutable, ['run', script, root, '--max-file-bytes', String(config.maxFileBytes)], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const parsed = JSON.parse(result.stdout) as AdapterOutput;
    const records = adapterRecords(parsed.facts ?? [], 't2c/go-ast@1', 'go_stdlib_ast', 'go');
    return { records, warnings: parsed.warnings ?? [] };
  } catch (error) {
    return { records: [], warnings: [`Go AST extraction failed: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

async function extractPythonAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../python/ast_extract.py');
  if (!(await pathExists(script))) return { records: [], warnings: [`Python AST helper not found: ${script}`] };
  try {
    const result = await execFileAsync(config.pythonExecutable, [script, root, '--max-file-bytes', String(config.maxFileBytes)], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PYTHONUTF8: '1' },
    });
    const parsed = JSON.parse(result.stdout) as AdapterOutput;
    const records = adapterRecords(parsed.facts ?? [], 't2c/python-ast@1', 'python_stdlib_ast', 'python');
    return { records, warnings: parsed.warnings ?? [] };
  } catch (error) {
    return { records: [], warnings: [`Python AST extraction failed: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

async function extractJavaAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../java/JavaAstExtract.java');
  if (!(await pathExists(script))) return { records: [], warnings: [`Java AST helper not found: ${script}`] };
  const files = await walkFiles(root, { extensions: ['.java'], maxFiles: 20_000 });
  if (files.length === 0) return { records: [], warnings: [] };
  try {
    const result = await execFileAsync(config.javaExecutable, [
      '--add-modules', 'jdk.compiler', script, root, '--max-file-bytes', String(config.maxFileBytes),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const parsed = JSON.parse(result.stdout) as AdapterOutput;
    return {
      records: adapterRecords(parsed.facts ?? [], 't2c/java-compiler-ast@1', 'java_compiler_tree_api', 'java'),
      warnings: parsed.warnings ?? [],
    };
  } catch (error) {
    return { records: [], warnings: [`Java AST extraction failed: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

async function extractRustAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const manifest = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../rust-ast/Cargo.toml');
  if (!(await pathExists(manifest))) return { records: [], warnings: [`Rust AST helper not found: ${manifest}`] };
  const files = await walkFiles(root, { extensions: ['.rs'], maxFiles: 20_000 });
  if (files.length === 0) return { records: [], warnings: [] };
  try {
    const result = await execFileAsync(config.cargoExecutable, [
      'run', '--quiet', '--manifest-path', manifest, '--', root, '--max-file-bytes', String(config.maxFileBytes),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const parsed = JSON.parse(result.stdout) as AdapterOutput;
    return {
      records: adapterRecords(parsed.facts ?? [], 't2c/rust-syn-ast@1', 'rust_syn_ast', 'rust'),
      warnings: parsed.warnings ?? [],
    };
  } catch (error) {
    return { records: [], warnings: [`Rust AST extraction failed: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

function adapterRecords(
  facts: AdapterFact[],
  extractor: string,
  basis: string,
  language: string,
): IntentRecord[] {
  return facts.map((fact) => buildRecord({
    kind: fact.kind,
    action: fact.action,
    subject: fact.subject,
    object: fact.object,
    target: { paths: [fact.path], symbols: fact.symbol ? [fact.symbol] : [] },
    modality: 'observed',
    text: `${fact.action} ${fact.object}`,
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: fact.path,
    sourceLines: { start: fact.lineStart, end: fact.lineEnd },
    symbol: fact.symbol,
    extractor,
    rawExcerpt: fact.excerpt,
    epistemicClass: 'fact',
    confidence: 1,
    basis: [basis],
    metadata: { language, llmUsed: false, ...fact.metadata },
  }));
}
