import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../../config/env.js';
import type { ExtractionResult } from '../../core/types.js';
import { runExternalAstAdapter } from './external.js';

export async function extractRustAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../rust-ast/Cargo.toml');
  return runExternalAstAdapter({
    root,
    executable: config.cargoExecutable,
    helperPath,
    arguments: ['run', '--quiet', '--manifest-path', helperPath, '--', root, '--max-file-bytes', String(config.maxFileBytes)],
    extractor: 't2c/rust-syn-ast@1',
    basis: 'rust_syn_ast',
    language: 'rust',
    label: 'Rust',
    sourceExtensions: ['.rs'],
  });
}
