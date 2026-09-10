import type { IntentRecord } from './types-foundation.js';

export * from './types-foundation.js';
export * from './types-code-change.js';
export * from './types-runtime.js';

/**
 * Additive view of observed conflict-marker syntax in t2c.intent/v1.
 * This is neither Git-index verification nor authority to choose a merge side.
 * blockSha256 binds the complete block; rawExcerpt may be truncated.
 */
export type MergeConflictFact = IntentRecord & {
  statement: IntentRecord['statement'] & {
    kind: 'merge_conflict_fact';
    action: 'block';
    modality: 'observed';
  };
  lifecycle: { status: 'blocked' };
  source: IntentRecord['source'] & {
    kind: 'git';
    path: string;
    lines: { start: number; end: number };
    extractor: 't2c/merge-conflict-markers@1';
    rawExcerpt: string;
  };
  epistemic: IntentRecord['epistemic'] & { class: 'fact' };
  metadata: IntentRecord['metadata'] & {
    llmUsed: false;
    gitIndexVerified: false;
    conflictStyle: 'merge' | 'diff3';
    markerWidth: number;
    blockSha256: string;
  };
};
