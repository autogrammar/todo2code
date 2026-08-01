import type { T2CConfig } from '../config/env.js';
import type { ExtractionResult, IntentRecord } from '../core/types.js';
import { extractChangelog } from './changelog.js';
import { createMarkdownPathResolver } from './markdown-paths.js';
import { extractTodo } from './todo.js';

export { extractChangelog } from './changelog.js';
export { createMarkdownPathResolver, type MarkdownPathResolver } from './markdown-paths.js';
export { extractTodo } from './todo.js';

export interface MarkdownExtractionOptions {
  root: string;
  todoPath?: string | null;
  changelogPath?: string | null;
}

/** Composes the independent TODO and CHANGELOG converters without merging their source semantics. */
export async function extractMarkdownIntent(options: MarkdownExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  // One resolver for both converters: the repository is indexed at most once,
  // and a file named by both documents resolves to the same target path.
  const pathResolver = createMarkdownPathResolver(options.root);
  if (options.todoPath) {
    const todo = await extractTodo(options.root, options.todoPath, config, pathResolver);
    records.push(...todo.records);
    warnings.push(...todo.warnings);
  }
  if (options.changelogPath) {
    const changelog = await extractChangelog(options.root, options.changelogPath, config, pathResolver);
    records.push(...changelog.records);
    warnings.push(...changelog.warnings);
  }
  return { records, warnings };
}
