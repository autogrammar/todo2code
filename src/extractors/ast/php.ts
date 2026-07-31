import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../../config/env.js';
import { loadIgnoreMatcher } from '../../core/ignore.js';
import { relativePosix, walkFiles } from '../../core/io.js';
import type { ExtractionResult } from '../../core/types.js';
import { runExternalAstAdapter } from './external.js';

export async function extractPhpAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../php/ast_extract.php');
  const matcher = await loadIgnoreMatcher(root);
  const files = await walkFiles(root, { extensions: ['.php'], maxFiles: 20_000, matcher });
  if (files.length === 0) return { records: [], warnings: [] };

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-php-files-'));
  const filesPath = path.join(temporaryDirectory, 'files.json');
  try {
    await fs.writeFile(filesPath, JSON.stringify(files.map((file) => relativePosix(root, file))), 'utf8');
    return await runExternalAstAdapter({
      root,
      executable: config.phpExecutable,
      helperPath,
      arguments: [helperPath, root, '--max-file-bytes', String(config.maxFileBytes), '--files-from', filesPath],
      extractor: 't2c/php-syntax@1',
      basis: 'php_syntax_tokens',
      language: 'php',
      label: 'PHP',
    });
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
