import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../../config/env.js';
import type { ExtractionResult } from '../../core/types.js';
import { runExternalAstAdapter } from './external.js';

export async function extractGoAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../golang/ast_extract.go');
  return runExternalAstAdapter({
    root,
    executable: config.goExecutable,
    helperPath,
    arguments: ['run', helperPath, root, '--max-file-bytes', String(config.maxFileBytes)],
    extractor: 't2c/go-ast@1',
    basis: 'go_stdlib_ast',
    language: 'go',
    label: 'Go',
    sourceExtensions: ['.go'],
  });
}
