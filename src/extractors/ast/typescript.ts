import path from 'node:path';
import ts from 'typescript';
import { relativePosix } from '../../core/io.js';
import { buildRecord } from '../../core/record.js';
import type { IntentAction, IntentRecord, JsonValue } from '../../core/types.js';
import { boundedCapabilities, moduleTopicText } from './records.js';

export const JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
export const TYPESCRIPT_AST_CACHE_IDENTITY = `t2c/typescript-ast@1/typescript-${ts.version}`;

export function extractTypeScriptFile(root: string, filePath: string, body: string): IntentRecord[] {
  const context = createTypeScriptExtractionContext({
    filePath,
    relative: relativePosix(root, filePath),
    sourceFile: ts.createSourceFile(filePath, body, ts.ScriptTarget.Latest, true, scriptKind(filePath)),
    records: [],
    scope: [],
    moduleCapabilities: new Set<string>(),
  });
  visitTypeScriptNode(context.sourceFile, context);
  const capabilities = boundedCapabilities(context.moduleCapabilities);
  recordModuleFact(context, context.sourceFile, capabilities);
  return context.records;
}

interface TypeScriptExtractionContext {
  filePath: string;
  relative: string;
  sourceFile: ts.SourceFile;
  records: IntentRecord[];
  scope: string[];
  moduleCapabilities: Set<string>;
}

function createTypeScriptExtractionContext(args: {
  filePath: string;
  relative: string;
  sourceFile: ts.SourceFile;
  records: IntentRecord[];
  scope: string[];
  moduleCapabilities: Set<string>;
}): TypeScriptExtractionContext {
  return args;
}

function visitTypeScriptNode(node: ts.Node, context: TypeScriptExtractionContext): void {
  if (handleNode(node, context)) {
    ts.forEachChild(node, (child) => visitTypeScriptNode(child, context));
  }
}

function handleNode(node: ts.Node, context: TypeScriptExtractionContext): boolean {
  if (handleImportDeclaration(node, context)) return true;
  if (handleExportDeclaration(node, context)) return true;
  if (handleSymbolDeclaration(node, context)) return true;
  if (handleVariableDeclaration(node, context)) return true;
  if (handleCallExpression(node, context)) return true;
  return true;
}

function handleImportDeclaration(node: ts.Node, context: TypeScriptExtractionContext): boolean {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return false;
  addTypeScriptRecord({
    context,
    node,
    kind: 'module_dependency_fact',
    action: 'depend_on',
    object: node.moduleSpecifier.text,
    metadata: { importClause: node.importClause?.getText(context.sourceFile) ?? null },
  });
  return true;
}

function handleExportDeclaration(node: ts.Node, context: TypeScriptExtractionContext): boolean {
  if (!ts.isExportDeclaration(node) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return false;
  addTypeScriptRecord({
    context,
    node,
    kind: 'module_dependency_fact',
    action: 'depend_on',
    object: node.moduleSpecifier.text,
    metadata: { reExport: true },
  });
  return true;
}

function handleSymbolDeclaration(node: ts.Node, context: TypeScriptExtractionContext): boolean {
  if (!isTypeScriptSymbolDeclaration(node)) return false;
  const symbol = extractSymbolName(node, context.sourceFile);
  if (!symbol) return true;
  const symbolModifiers = extractModifiers(node);
  addTypeScriptRecord({
    context,
    node,
    kind: 'symbol_fact',
    action: 'declare',
    object: symbol,
    symbol,
    metadata: {
      symbolKind: ts.SyntaxKind[node.kind] ?? 'unknown',
      modifiers: symbolModifiers,
      exported: symbolModifiers.includes('ExportKeyword'),
    },
  });
  context.scope.push(symbol);
  ts.forEachChild(node, (child) => visitTypeScriptNode(child, context));
  context.scope.pop();
  return false;
}

function handleVariableDeclaration(node: ts.Node, context: TypeScriptExtractionContext): boolean {
  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return false;
  const declarationIsCallable = Boolean(node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));
  if (!declarationIsCallable && !isTopLevel(node)) return true;
  addTypeScriptRecord({
    context,
    node,
    kind: 'symbol_fact',
    action: 'declare',
    object: node.name.text,
    symbol: node.name.text,
    metadata: { symbolKind: declarationIsCallable ? 'callable_variable' : 'variable' },
  });
  return true;
}

function handleCallExpression(node: ts.Node, context: TypeScriptExtractionContext): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression.getText(context.sourceFile).slice(0, 300);
  addTypeScriptRecord({
    context,
    node,
    kind: 'call_fact',
    action: 'call',
    object: callee,
    symbol: context.scope.length ? context.scope.join('.') : null,
    metadata: { callee, argumentCount: node.arguments.length },
  });
  return true;
}

function isTypeScriptSymbolDeclaration(
  node: ts.Node,
): node is
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
  | ts.MethodDeclaration {
  return (
    ts.isFunctionDeclaration(node)
    || ts.isClassDeclaration(node)
    || ts.isInterfaceDeclaration(node)
    || ts.isTypeAliasDeclaration(node)
    || ts.isEnumDeclaration(node)
    || ts.isMethodDeclaration(node)
  );
}

function extractSymbolName(
  node: ts.Node & { name?: ts.Node },
  sourceFile: ts.SourceFile,
): string | null {
  if (!node.name) return null;
  return node.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
}

function extractModifiers(node: ts.Node): string[] {
  if (!ts.canHaveModifiers(node)) return [];
  return (ts.getModifiers(node) ?? []).map((modifier) => ts.SyntaxKind[modifier.kind] ?? String(modifier.kind));
}

function addTypeScriptRecord(
  input: {
    context: TypeScriptExtractionContext;
    node: ts.Node;
    kind: string;
    action: IntentAction;
    object: string;
    symbol?: string | null;
    text?: string;
    subject?: string | null;
    metadata?: Record<string, JsonValue>;
  },
): void {
  const symbol = input.symbol ?? null;
  if (input.kind === 'symbol_fact' || input.kind === 'module_dependency_fact') {
    input.context.moduleCapabilities.add(input.object);
  }
  input.context.records.push(buildRecord({
    kind: input.kind,
    action: input.action,
    subject: input.subject ?? (input.context.scope.length ? input.context.scope.join('.') : null),
    object: input.object,
    target: { paths: [input.context.relative], symbols: symbol ? [symbol] : [] },
    modality: 'observed',
    text: input.text ?? `${input.action} ${input.object}`,
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: input.context.relative,
    sourceLines: sourceLineRange(input.node, input.context.sourceFile),
    symbol,
    extractor: 't2c/typescript-ast@1',
    rawExcerpt: nodeExcerpt(input.node, input.context.sourceFile),
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['typescript_compiler_ast'],
    metadata: {
      language: languageName(input.context.filePath),
      syntaxKind: ts.SyntaxKind[input.node.kind] ?? String(input.node.kind),
      llmUsed: false,
      ...(input.metadata ?? {}),
    },
  }));
}

function sourceLineRange(node: ts.Node, sourceFile: ts.SourceFile): { start: number; end: number } {
  return {
    start: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    end: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
  };
}

function nodeExcerpt(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).slice(0, 2000);
}

function recordModuleFact(
  context: TypeScriptExtractionContext,
  node: ts.SourceFile,
  capabilities: string[],
): void {
  addTypeScriptRecord({
    context,
    node,
    kind: 'module_fact',
    action: 'declare',
    object: context.relative,
    text: moduleTopicText(context.relative, capabilities),
    metadata: { aggregate: 'module', factGranularity: 'file', capabilities },
  });
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
