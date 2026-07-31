import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { ContentCache } from '../core/content-cache.js';
import { sha256 } from '../core/id.js';
import { loadIgnoreMatcher } from '../core/ignore.js';
import { readText, relativePosix, walkFiles } from '../core/io.js';
import { assertIntentRecords } from '../core/schema.js';
import type { CachedExtractionResult, ExtractionResult, IntentRecord } from '../core/types.js';
import { T2C_VERSION } from '../version.js';
import { extractGoAst } from './ast/go.js';
import { extractJavaAst } from './ast/java.js';
import { extractPhpAst } from './ast/php.js';
import { extractPythonAst } from './ast/python.js';
import { extractRustAst } from './ast/rust.js';
import { extractTypeScriptFile, JS_EXTENSIONS, TYPESCRIPT_AST_CACHE_IDENTITY } from './ast/typescript.js';
import { unsupportedSourceWarning } from './ast/unsupported.js';

export interface AstExtractionOptions {
  root: string;
}

/** Coordinates independently versioned language adapters behind one public envelope. */
export async function extractAstIntent(options: AstExtractionOptions, config: T2CConfig): Promise<CachedExtractionResult> {
  const root = path.resolve(options.root);
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const cache = new ContentCache({ root, outputDir: config.outputDir, enabled: config.cacheEnabled ?? true });
  const matcher = await loadIgnoreMatcher(root);
  const files = await walkFiles(root, { extensions: JS_EXTENSIONS, maxFiles: 20_000, matcher });

  for (const file of files) {
    try {
      const body = await readText(file, config.maxFileBytes);
      const relative = relativePosix(root, file);
      const extracted = await cache.getOrCompute({
        namespace: 'ast-typescript-v1',
        inputs: { path: relative, contentHash: sha256(body), extractor: TYPESCRIPT_AST_CACHE_IDENTITY },
        compute: () => extractTypeScriptFile(root, file, body),
        validate: isIntentRecords,
      });
      records.push(...extracted);
    } catch (error) {
      warnings.push(`${relativePosix(root, file)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const adapters: ExternalCacheAdapter[] = [
    {
      enabled: config.enablePythonAst,
      namespace: 'ast-python-v1',
      extensions: ['.py'],
      executable: config.pythonExecutable,
      useIgnoreMatcher: true,
      extract: () => extractPythonAst(root, config),
    },
    {
      enabled: config.enableGoAst,
      namespace: 'ast-go-v1',
      extensions: ['.go'],
      executable: config.goExecutable,
      extract: () => extractGoAst(root, config),
    },
    {
      enabled: config.enableJavaAst,
      namespace: 'ast-java-v1',
      extensions: ['.java'],
      executable: config.javaExecutable,
      extract: () => extractJavaAst(root, config),
    },
    {
      enabled: config.enablePhpAst,
      namespace: 'ast-php-v1',
      extensions: ['.php'],
      executable: config.phpExecutable,
      useIgnoreMatcher: true,
      extract: () => extractPhpAst(root, config),
    },
    {
      enabled: config.enableRustAst,
      namespace: 'ast-rust-v1',
      extensions: ['.rs'],
      executable: config.cargoExecutable,
      extract: () => extractRustAst(root, config),
    },
  ];
  for (const adapter of adapters) {
    if (!adapter.enabled) continue;
    const adapterFiles = await walkFiles(root, {
      extensions: adapter.extensions,
      maxFiles: 20_000,
      ...(adapter.useIgnoreMatcher ? { matcher } : {}),
    });
    if (adapterFiles.length === 0) continue;
    const manifest = await sourceManifest(root, adapterFiles, config.maxFileBytes);
    const result = manifest
      ? await cache.getOrCompute({
        namespace: adapter.namespace,
        inputs: {
          files: manifest,
          executable: adapter.executable,
          maxFileBytes: config.maxFileBytes,
          runtimeVersion: T2C_VERSION,
        },
        compute: adapter.extract,
        validate: isExtractionResult,
        // Toolchain and parse warnings can disappear without a source change.
        shouldStore: (value) => value.warnings.length === 0,
      })
      : await adapter.extract();
    records.push(...result.records);
    warnings.push(...result.warnings);
  }

  const unsupported = await unsupportedSourceWarning(root, matcher, config.enablePhpAst ? ['.php'] : []);
  if (unsupported) warnings.push(unsupported);
  return { records, warnings, cache: cache.snapshot() };
}

interface ExternalCacheAdapter {
  enabled: boolean;
  namespace: string;
  extensions: string[];
  executable: string;
  useIgnoreMatcher?: boolean;
  extract: () => Promise<ExtractionResult>;
}

async function sourceManifest(
  root: string,
  files: string[],
  maxFileBytes: number,
): Promise<Array<{ path: string; contentHash: string }> | null> {
  const manifest: Array<{ path: string; contentHash: string }> = [];
  try {
    for (const file of files) {
      const body = await readText(file, maxFileBytes);
      manifest.push({ path: relativePosix(root, file), contentHash: sha256(body) });
    }
    return manifest;
  } catch {
    return null;
  }
}

function isIntentRecords(value: unknown): value is IntentRecord[] {
  try {
    assertIntentRecords(value);
    return true;
  } catch {
    return false;
  }
}

function isExtractionResult(value: unknown): value is ExtractionResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<ExtractionResult>;
  return isIntentRecords(result.records) && Array.isArray(result.warnings)
    && result.warnings.every((warning) => typeof warning === 'string');
}
