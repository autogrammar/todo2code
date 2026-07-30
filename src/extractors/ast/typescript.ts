import path from 'node:path';
import ts from 'typescript';
import { relativePosix } from '../../core/io.js';
import { buildRecord } from '../../core/record.js';
import type { IntentAction, IntentRecord, JsonValue } from '../../core/types.js';
import { boundedCapabilities, moduleTopicText } from './records.js';

export const JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

export function extractTypeScriptFile(root: string, filePath: string, body: string): IntentRecord[] {
  const relative = relativePosix(root, filePath);
  const sourceFile = ts.createSourceFile(filePath, body, ts.ScriptTarget.Latest, true, scriptKind(filePath));
  const records: IntentRecord[] = [];
  const scope: string[] = [];
  const moduleCapabilities = new Set<string>();

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
    text?: string;
  }): void {
    const symbol = input.symbol ?? null;
    if (input.kind === 'symbol_fact' || input.kind === 'module_dependency_fact') moduleCapabilities.add(input.object);
    records.push(buildRecord({
      kind: input.kind,
      action: input.action,
      subject: input.subject ?? (scope.length ? scope.join('.') : null),
      object: input.object,
      target: { paths: [relative], symbols: symbol ? [symbol] : [] },
      modality: 'observed',
      text: input.text ?? `${input.action} ${input.object}`,
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
        const symbolModifiers = modifiers(node);
        add(node, {
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
  const capabilities = boundedCapabilities(moduleCapabilities);
  add(sourceFile, {
    kind: 'module_fact',
    action: 'declare',
    object: relative,
    text: moduleTopicText(relative, capabilities),
    metadata: { aggregate: 'module', factGranularity: 'file', capabilities },
  });
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
