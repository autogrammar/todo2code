import type { T2CConfig } from '../config/env.js';
import type { ExtractionResult, IntentRecord } from '../core/types.js';
import { extractChangelog } from './changelog.js';
import { extractTodo } from './todo.js';

export { extractChangelog } from './changelog.js';
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
  if (options.todoPath) {
    const todo = await extractTodo(options.root, options.todoPath, config);
    records.push(...todo.records);
    warnings.push(...todo.warnings);
  }
  if (options.changelogPath) {
    const changelog = await extractChangelog(options.root, options.changelogPath, config);
    records.push(...changelog.records);
    warnings.push(...changelog.warnings);
  }
  return { records, warnings };
}
