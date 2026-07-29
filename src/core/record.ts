import { createIntentId, sha256 } from './id.js';
import type {
  EpistemicClass,
  IntentAction,
  IntentRecord,
  IntentTarget,
  JsonValue,
  LifecycleStatus,
  Modality,
  Polarity,
  SourceKind,
  SourceLineRange,
} from './types.js';
import { normalizeTarget } from './target.js';

export interface BuildRecordInput {
  prefix?: string;
  kind: string;
  actor?: string | null;
  action: IntentAction;
  subject?: string | null;
  object: string;
  target?: Partial<IntentTarget>;
  modality?: Modality;
  polarity?: Polarity;
  text: string;
  lifecycle: LifecycleStatus;
  sourceKind: SourceKind;
  sourcePath?: string | null;
  sourceLines?: SourceLineRange | null;
  revision?: string | null;
  symbol?: string | null;
  commitIndex?: number | null;
  extractor: string;
  rawExcerpt?: string | null;
  epistemicClass: EpistemicClass;
  confidence: number;
  basis: string[];
  observedAt?: string | null;
  metadata?: Record<string, JsonValue>;
}

export function buildRecord(input: BuildRecordInput): IntentRecord {
  const target: IntentTarget = normalizeTarget(input.target);
  const rawExcerpt = input.rawExcerpt ?? input.text;
  const seed = {
    kind: input.kind,
    action: input.action,
    object: input.object,
    target,
    sourceKind: input.sourceKind,
    sourcePath: input.sourcePath ?? null,
    sourceLines: input.sourceLines ?? null,
    revision: input.revision ?? null,
    symbol: input.symbol ?? null,
    rawExcerpt,
  };
  return {
    schemaVersion: 't2c.intent/v1',
    id: createIntentId(seed, input.prefix ?? sourcePrefix(input.sourceKind)),
    statement: {
      kind: input.kind,
      actor: input.actor ?? null,
      action: input.action,
      subject: input.subject ?? null,
      object: input.object,
      target,
      modality: input.modality ?? 'unknown',
      polarity: input.polarity ?? 'positive',
      text: input.text,
    },
    lifecycle: { status: input.lifecycle },
    source: {
      kind: input.sourceKind,
      path: input.sourcePath ?? null,
      lines: input.sourceLines ?? null,
      revision: input.revision ?? null,
      symbol: input.symbol ?? null,
      commitIndex: input.commitIndex ?? null,
      extractor: input.extractor,
      contentHash: sha256(rawExcerpt),
      rawExcerpt,
    },
    epistemic: {
      class: input.epistemicClass,
      confidence: clamp(input.confidence),
      basis: [...new Set(input.basis)].sort(),
    },
    observedAt: input.observedAt ?? null,
    metadata: input.metadata ?? {},
  };
}

function clamp(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function sourcePrefix(kind: SourceKind): string {
  const values: Record<SourceKind, string> = {
    nl: 'INT-NL',
    git: 'INT-GIT',
    ast: 'INT-AST',
    todo: 'INT-TODO',
    changelog: 'INT-CHANGELOG',
    document: 'INT-DOC',
    agent_log: 'INT-AGENT',
    test: 'INT-TEST',
    system: 'INT-SYS',
  };
  return values[kind];
}
