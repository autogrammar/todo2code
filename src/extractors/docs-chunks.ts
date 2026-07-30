import type { DocumentationTargetHints, DocumentChunk } from './docs-types.js';

export function prioritizeDocumentChunks(
  chunks: DocumentChunk[],
  hints?: DocumentationTargetHints,
): DocumentChunk[] {
  const needles = hints
    ? [...hints.paths, ...hints.symbols, ...hints.tickets, ...hints.versions]
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length >= 2)
    : [];

  return chunks
    .map((chunk, index) => ({
      chunk,
      index,
      score: chunkPriority(chunk, needles),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ chunk }) => chunk);
}

function chunkPriority(chunk: DocumentChunk, needles: string[]): number {
  const haystack = `${chunk.path}\n${chunk.content}`.toLowerCase();
  const matches = needles.reduce(
    (count, needle) => count + (haystack.includes(needle) ? 1 : 0),
    0,
  );
  const importantFile = /(^|\/)(readme|architecture|requirements|protocols|dsl)(\.md)?$/i.test(chunk.path);
  return matches * 10 + (importantFile ? 1 : 0);
}

export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await mapper(item, index);
    }
  };

  const workerCount = Math.min(items.length, Math.max(1, Math.trunc(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function chunkMarkdown(relativePath: string, body: string, maxChars: number): DocumentChunk[] {
  const lines = body.split(/\r?\n/);
  const sections = markdownSections(lines);
  const chunks: DocumentChunk[] = [];
  let currentStart = 1;
  let currentEnd = 0;
  let current: string[] = [];

  const flush = (): void => {
    if (!current.length) return;
    chunks.push({
      path: relativePath,
      startLine: currentStart,
      endLine: currentEnd,
      content: current.join('\n'),
    });
    current = [];
  };

  for (const section of sections) {
    const sectionLines = lines.slice(section.start - 1, section.end);
    const sectionText = sectionLines.join('\n');
    if (sectionText.length > maxChars) {
      flush();
      chunks.push(...splitLongSection(relativePath, section.start, sectionLines, maxChars));
      continue;
    }

    const candidateSize = current.join('\n').length + sectionText.length + 1;
    if (current.length && candidateSize > maxChars) flush();
    if (!current.length) currentStart = section.start;
    current.push(...sectionLines);
    currentEnd = section.end;
  }

  flush();
  return chunks.filter((chunk) => chunk.content.trim());
}

function markdownSections(lines: string[]): Array<{ start: number; end: number }> {
  const sections: Array<{ start: number; end: number }> = [];
  let sectionStart = 1;
  for (let index = 1; index < lines.length; index += 1) {
    if (/^\s{0,3}#{1,6}\s+/.test(lines[index] ?? '')) {
      sections.push({ start: sectionStart, end: index });
      sectionStart = index + 1;
    }
  }
  sections.push({ start: sectionStart, end: lines.length });
  return sections;
}

function splitLongSection(
  relativePath: string,
  sectionStart: number,
  lines: string[],
  maxChars: number,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  for (let offset = 0; offset < lines.length;) {
    const batchStart = sectionStart + offset;
    const batch = takeLineBatch(lines, offset, maxChars);
    offset = batch.nextOffset;
    chunks.push({
      path: relativePath,
      startLine: batchStart,
      endLine: batchStart + batch.lines.length - 1,
      content: batch.lines.join('\n'),
    });
  }
  return chunks;
}

function takeLineBatch(
  lines: string[],
  start: number,
  maxChars: number,
): { lines: string[]; nextOffset: number } {
  const batch: string[] = [];
  let size = 0;
  let offset = start;
  while (offset < lines.length && size + (lines[offset]?.length ?? 0) + 1 <= maxChars) {
    const line = lines[offset] ?? '';
    batch.push(line);
    size += line.length + 1;
    offset += 1;
  }
  if (!batch.length) {
    batch.push((lines[offset] ?? '').slice(0, maxChars));
    offset += 1;
  }
  return { lines: batch, nextOffset: offset };
}
