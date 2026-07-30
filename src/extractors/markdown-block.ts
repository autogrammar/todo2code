/**
 * Markdown list-item block reader.
 *
 * TODO and CHANGELOG entries are routinely wrapped across several lines:
 *
 * ```markdown
 * - [x] Define and document `t2c.conclusion/v1` and
 *   `t2c.todo-proposal/v1` schemas. Every conclusion must cite existing
 *   diagnostic and intent-record IDs.
 * ```
 *
 * Reading only the marker line keeps the first fragment and silently drops the
 * rest, which removes exactly the words a downstream linker needs to match a
 * task against a commit or an AST fact. This module joins the continuation
 * lines back into one statement and reports the true source range.
 */

/** A list item together with the continuation lines that belong to it. */
export interface MarkdownListBlock {
  /** Item content with continuations joined into a single statement. */
  text: string;
  /** Unmodified source lines covered by the block. */
  raw: string[];
  /** 1-based inclusive line numbers of the block. */
  startLine: number;
  endLine: number;
  /** 0-based index of the last consumed line, for the caller's loop cursor. */
  endIndex: number;
}

const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const HEADING = /^\s{0,3}#{1,6}\s/;
const FENCE = /^\s*(?:```|~~~)/;
const THEMATIC_BREAK = /^\s{0,3}(?:\*\s*){3,}$|^\s{0,3}(?:-\s*){3,}$|^\s{0,3}(?:_\s*){3,}$/;

/**
 * Collects the continuation lines of the list item starting at `index`.
 *
 * A line continues the item when it is indented, non-blank, and does not open a
 * new block: another list item, a heading, a fenced code block or a thematic
 * break all terminate the item. Unindented "lazy" continuations are
 * deliberately *not* consumed — in these documents an unindented line is always
 * a new construct, and consuming it would merge unrelated entries.
 */
export function readListBlock(lines: string[], index: number, content: string): MarkdownListBlock {
  const raw: string[] = [lines[index] ?? ''];
  const parts: string[] = [content.trim()];
  let cursor = index;

  for (let next = index + 1; next < lines.length; next += 1) {
    const line = lines[next] ?? '';
    if (!line.trim()) break;
    if (!/^[ \t]/.test(line)) break;
    if (LIST_MARKER.test(line) || HEADING.test(line) || FENCE.test(line) || THEMATIC_BREAK.test(line)) break;
    raw.push(line);
    parts.push(line.trim());
    cursor = next;
  }

  return {
    text: parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    raw,
    startLine: index + 1,
    endLine: cursor + 1,
    endIndex: cursor,
  };
}
