import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { loadIgnoreMatcher } from '../core/ignore.js';
import { readText, relativePosix, walkFiles } from '../core/io.js';
import type { ExtractionResult, IntentRecord } from '../core/types.js';
import { extractGoAst } from './ast/go.js';
import { extractJavaAst } from './ast/java.js';
import { extractPythonAst } from './ast/python.js';
import { extractRustAst } from './ast/rust.js';
import { extractTypeScriptFile, JS_EXTENSIONS } from './ast/typescript.js';
import { unsupportedSourceWarning } from './ast/unsupported.js';

export interface AstExtractionOptions {
  root: string;
}

/** Coordinates independently versioned language adapters behind one public envelope. */
export async function extractAstIntent(options: AstExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  const root = path.resolve(options.root);
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const matcher = await loadIgnoreMatcher(root);
  const files = await walkFiles(root, { extensions: JS_EXTENSIONS, maxFiles: 20_000, matcher });

  for (const file of files) {
    try {
      const body = await readText(file, config.maxFileBytes);
      records.push(...extractTypeScriptFile(root, file, body));
    } catch (error) {
      warnings.push(`${relativePosix(root, file)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const adapters: Array<[boolean, () => Promise<ExtractionResult>]> = [
    [config.enablePythonAst, () => extractPythonAst(root, config)],
    [config.enableGoAst, () => extractGoAst(root, config)],
    [config.enableJavaAst, () => extractJavaAst(root, config)],
    [config.enableRustAst, () => extractRustAst(root, config)],
  ];
  for (const [enabled, extract] of adapters) {
    if (!enabled) continue;
    const result = await extract();
    records.push(...result.records);
    warnings.push(...result.warnings);
  }

  const unsupported = await unsupportedSourceWarning(root, matcher);
  if (unsupported) warnings.push(unsupported);
  return { records, warnings };
}
