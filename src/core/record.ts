import { createIntentId, sha256 } from './id.js';
import type {
  EpistemicClass,
  IntentAction,
  IntentGenerationMetadata,
  IntentGenerationMode,
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
import { generationMetadata } from './record-metadata.js';

export interface BuildRecordGenerationInput {
  requested?: IntentGenerationMode;
  used: IntentGenerationMode;
  degraded?: boolean;
  fallbackReason?: string | null;
  provider?: string | null;
  model?: string | null;
  responseId?: string | null;
}

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
  generation?: BuildRecordGenerationInput;
}

export function buildRecord(input: BuildRecordInput): IntentRecord {
  const target: IntentTarget = normalizeTarget(input.target);
  const rawExcerpt = input.rawExcerpt ?? input.text;
  const seed = buildRecordSeed(input, target, rawExcerpt);
  return {
    schemaVersion: 't2c.intent/v1',
    id: createIntentId(seed, input.prefix ?? sourcePrefix(input.sourceKind)),
    statement: buildRecordStatement(input, target),
    lifecycle: { status: input.lifecycle },
    source: buildRecordSource(input, rawExcerpt),
    epistemic: buildRecordEpistemic(input),
    observedAt: input.observedAt ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      generation: generationMetadata(input.extractor, input.generation),
    },
  };
}

function buildRecordSeed(input: BuildRecordInput, target: IntentTarget, rawExcerpt: string): Omit<IntentRecord, 'schemaVersion' | 'id' | 'statement' | 'lifecycle' | 'source' | 'epistemic' | 'observedAt' | 'metadata'> {
  return {
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
}

function buildRecordStatement(input: BuildRecordInput, target: IntentTarget): IntentRecord['statement'] {
  return {
    kind: input.kind,
    actor: input.actor ?? null,
    action: input.action,
    subject: input.subject ?? null,
    object: input.object,
    target,
    modality: input.modality ?? 'unknown',
    polarity: input.polarity ?? 'positive',
    text: input.text,
  };
}

function buildRecordSource(input: BuildRecordInput, rawExcerpt: string): IntentRecord['source'] {
  return {
    kind: input.sourceKind,
    path: input.sourcePath ?? null,
    lines: input.sourceLines ?? null,
    revision: input.revision ?? null,
    symbol: input.symbol ?? null,
    commitIndex: input.commitIndex ?? null,
    extractor: input.extractor,
    contentHash: sha256(rawExcerpt),
    rawExcerpt,
  };
}

function buildRecordEpistemic(input: BuildRecordInput): IntentRecord['epistemic'] {
  return {
    class: input.epistemicClass,
    confidence: clamp(input.confidence),
    basis: [...new Set(input.basis)].sort(),
  };
}

/** Updates runtime-owned mode/fallback provenance without losing generator identity. */
export function withRecordGeneration(
  record: IntentRecord,
  overrides: Pick<IntentGenerationMetadata, 'requested' | 'used' | 'degraded' | 'fallbackReason'>,
): IntentRecord {
  return {
    ...record,
    metadata: {
      ...record.metadata,
      generation: { ...record.metadata.generation, ...overrides },
    },
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
