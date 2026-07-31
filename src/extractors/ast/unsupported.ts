import path from 'node:path';
import type { IgnoreMatcher } from '../../core/ignore.js';
import { walkFiles } from '../../core/io.js';

const UNSUPPORTED_SOURCE_EXTENSIONS = [
  '.php', '.rb', '.cs', '.fs', '.fsx', '.kt', '.kts', '.swift', '.scala',
  '.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.m', '.mm', '.lua',
  '.r', '.dart', '.ex', '.exs',
];

export async function unsupportedSourceWarning(
  root: string,
  matcher: IgnoreMatcher,
  supportedExtensions: string[] = [],
): Promise<string | null> {
  const files = await walkFiles(root, {
    extensions: UNSUPPORTED_SOURCE_EXTENSIONS.filter((extension) => !supportedExtensions.includes(extension)),
    maxFiles: 20_000,
    matcher,
  });
  if (!files.length) return null;
  const counts = new Map<string, number>();
  for (const file of files) {
    const extension = path.extname(file).toLowerCase().slice(1) || 'unknown';
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  const summary = [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([extension, count]) => `${extension}=${count}`).join(', ');
  return `UNSUPPORTED_AST_FILES: ${summary}; these source files were discovered but not converted to AST DSL`;
}
