import type { IntentAction, JsonValue } from '../../core/types.js';

export interface AdapterFact {
  path: string;
  lineStart: number;
  lineEnd: number;
  kind: string;
  action: IntentAction;
  object: string;
  symbol: string | null;
  subject: string | null;
  excerpt: string;
  contentHash: string;
  metadata: Record<string, JsonValue>;
}

export interface AdapterOutput {
  facts: AdapterFact[];
  warnings: string[];
}
