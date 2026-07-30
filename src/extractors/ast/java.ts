import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../../config/env.js';
import type { ExtractionResult } from '../../core/types.js';
import { runExternalAstAdapter } from './external.js';

export async function extractJavaAst(root: string, config: T2CConfig): Promise<ExtractionResult> {
  const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../java/JavaAstExtract.java');
  return runExternalAstAdapter({
    root,
    executable: config.javaExecutable,
    helperPath,
    arguments: ['--add-modules', 'jdk.compiler', helperPath, root, '--max-file-bytes', String(config.maxFileBytes)],
    extractor: 't2c/java-compiler-ast@1',
    basis: 'java_compiler_tree_api',
    language: 'java',
    label: 'Java',
    sourceExtensions: ['.java'],
  });
}
