import { keywords, topicKeywords } from '../core/text.js';
import type { IntentRecord } from '../core/types.js';

export interface RecordKeywords {
  object: Set<string>;
  text: Set<string>;
  topics: Set<string>;
}

export function indexKeywords(records: IntentRecord[]): Map<string, RecordKeywords> {
  return new Map(records.map((record) => [record.id, {
    object: new Set(keywords(record.statement.object)),
    text: new Set(keywords(record.statement.text)),
    topics: new Set(topicKeywords(`${record.statement.object} ${record.statement.text}`)),
  }]));
}

export function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let intersection = 0;
  for (const item of small) {
    if (large.has(item)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

export function intersectionSize(left: Set<string>, right: Set<string>): number {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let size = 0;
  for (const value of small) if (large.has(value)) size += 1;
  return size;
}
