import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../../config/env.js';
import type { ExtractionResult } from '../../core/types.js';
import { runExternalAstAdapter } from './external.js';

export async function extractPythonAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../python/ast_extract.py');
  return runExternalAstAdapter({
    root,
    executable: config.pythonExecutable,
    helperPath,
    arguments: [helperPath, root, '--max-file-bytes', String(config.maxFileBytes)],
    extractor: 't2c/python-ast@1',
    basis: 'python_stdlib_ast',
    language: 'python',
    label: 'Python',
    environment: { ...process.env, PYTHONUTF8: '1' },
  });
}
