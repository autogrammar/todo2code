import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../../config/env.js';
import { loadIgnoreMatcher } from '../../core/ignore.js';
import { relativePosix, walkFiles } from '../../core/io.js';
import type { ExtractionResult } from '../../core/types.js';
import { runExternalAstAdapter } from './external.js';

export async function extractPythonAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../python/ast_extract.py');
  const matcher = await loadIgnoreMatcher(root);
  const files = await walkFiles(root, { extensions: ['.py'], maxFiles: 20_000, matcher });
  if (files.length === 0) return { records: [], warnings: [] };

  // The helper used to walk the repository independently, bypassing ignore
  // files. On real repositories that pulled generated clones and fixtures into
  // one giant JSON response. Pass the exact Node-selected file set through a
  // private temporary manifest so every AST adapter sees the same scope.
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-python-files-'));
  const filesPath = path.join(temporaryDirectory, 'files.json');
  try {
    await fs.writeFile(filesPath, JSON.stringify(files.map((file) => relativePosix(root, file))), 'utf8');
    return await runExternalAstAdapter({
      root,
      executable: config.pythonExecutable,
      helperPath,
      arguments: [helperPath, root, '--max-file-bytes', String(config.maxFileBytes), '--files-from', filesPath],
      extractor: 't2c/python-ast@5',
      basis: 'python_stdlib_ast',
      language: 'python',
      label: 'Python',
      environment: { ...process.env, PYTHONUTF8: '1' },
    });
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
