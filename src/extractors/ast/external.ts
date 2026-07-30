import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathExists, walkFiles } from '../../core/io.js';
import type { ExtractionResult } from '../../core/types.js';
import { adapterRecords } from './records.js';
import type { AdapterOutput } from './types.js';

const execFileAsync = promisify(execFile);

export interface ExternalAdapterOptions {
  root: string;
  executable: string;
  helperPath: string;
  arguments: string[];
  extractor: string;
  basis: string;
  language: string;
  label: string;
  sourceExtensions?: string[];
  environment?: NodeJS.ProcessEnv;
}

export async function runExternalAstAdapter(options: ExternalAdapterOptions): Promise<ExtractionResult> {
  if (!(await pathExists(options.helperPath))) {
    return { records: [], warnings: [`${options.label} AST helper not found: ${options.helperPath}`] };
  }
  if (options.sourceExtensions) {
    const files = await walkFiles(options.root, { extensions: options.sourceExtensions, maxFiles: 20_000 });
    if (files.length === 0) return { records: [], warnings: [] };
  }
  try {
    const result = await execFileAsync(options.executable, options.arguments, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      ...(options.environment ? { env: options.environment } : {}),
    });
    const parsed = JSON.parse(result.stdout) as AdapterOutput;
    return {
      records: adapterRecords(parsed.facts ?? [], options.extractor, options.basis, options.language),
      warnings: parsed.warnings ?? [],
    };
  } catch (error) {
    return {
      records: [],
      warnings: [`${options.label} AST extraction failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
