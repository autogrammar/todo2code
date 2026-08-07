import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { readText, relativePosix } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type {
  ExtractionResult,
  IntentAction,
  IntentRecord,
  LifecycleStatus,
  Modality,
  Polarity,
} from '../core/types.js';

const EXTRACTOR = 't2c/docs-intent-block@1';
const FENCE = /^\s*(?:```|~~~)\s*t2c-intent\s*$/;
const FENCE_CLOSE = /^\s*(?:```|~~~)\s*$/;
const MAX_RECORDS = 500;

const ACTIONS = new Set<IntentAction>([
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
]);
const MODALITIES = new Set<Modality>(['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown']);
const LIFECYCLES = new Set<LifecycleStatus>([
  'proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown',
]);

/**
 * Deterministic intent authored directly in documentation.
 *
 * A `t2c-intent` fenced block lets a doc carry machine-checkable intent instead
 * of prose, so the runtime (graph + Intent-vs-Reality diagnostics) validates the
 * document against code — no LLM in the loop. Each block is JSON: one record or
 * `{ "records": [ ... ] }`. Records enter as `declaration` (authored intent),
 * link to code through `target.paths`/`target.symbols` and to work through
 * `target.tickets`. Invalid records are reported as warnings and skipped, never
 * fabricated.
 */
export async function extractDocsIntentBlocks(
  fileInput: string,
  config: T2CConfig,
  rootInput?: string,
): Promise<ExtractionResult> {
  const filePath = path.resolve(fileInput);
  const root = path.resolve(rootInput ?? process.cwd());
  const body = await readText(filePath, config.maxFileBytes);
  const sourcePath = relativePosix(root, filePath);
  const lines = body.split(/\r?\n/);

  const records: IntentRecord[] = [];
  const warnings: string[] = [];

  let index = 0;
  while (index < lines.length) {
    if (!FENCE.test(lines[index]!)) {
      index += 1;
      continue;
    }
    const start = index + 1; // 1-based line of the opening fence
    index += 1;
    const bodyLines: string[] = [];
    while (index < lines.length && !FENCE_CLOSE.test(lines[index]!)) {
      bodyLines.push(lines[index]!);
      index += 1;
    }
    const end = index + 1; // 1-based line of the closing fence
    index += 1; // step past the closing fence

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyLines.join('\n'));
    } catch (error) {
      warnings.push(`${sourcePath}:${start}: t2c-intent block is not JSON (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    const rawRecords = Array.isArray((parsed as { records?: unknown })?.records)
      ? (parsed as { records: unknown[] }).records
      : [parsed];
    for (const raw of rawRecords) {
      if (records.length >= MAX_RECORDS) {
        warnings.push(`${sourcePath}: truncated at ${MAX_RECORDS} authored records`);
        return { records, warnings };
      }
      const record = toRecord(raw, { sourcePath, start, end }, warnings);
      if (record) records.push(record);
    }
  }
  return { records, warnings };
}

interface BlockContext {
  sourcePath: string;
  start: number;
  end: number;
}

function toRecord(raw: unknown, context: BlockContext, warnings: string[]): IntentRecord | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`${context.sourcePath}:${context.start}: t2c-intent entry is not an object`);
    return null;
  }
  const item = raw as Record<string, unknown>;
  const object = text(item.object);
  const statement = text(item.text) || object;
  if (!object) {
    warnings.push(`${context.sourcePath}:${context.start}: t2c-intent entry missing required "object"`);
    return null;
  }
  const action = enumValue(item.action, ACTIONS, 'declare') as IntentAction;
  const modality = enumValue(item.modality, MODALITIES, 'required') as Modality;
  const lifecycle = enumValue(item.lifecycle, LIFECYCLES, 'planned') as LifecycleStatus;
  const polarity: Polarity = text(item.polarity) === 'negative' ? 'negative' : 'positive';
  const targetRaw = (item.target && typeof item.target === 'object' ? item.target : {}) as Record<string, unknown>;

  return buildRecord({
    kind: text(item.kind) || 'documented_intent',
    action,
    object,
    subject: text(item.subject) || null,
    target: {
      paths: stringList(targetRaw.paths),
      symbols: stringList(targetRaw.symbols),
      tickets: stringList(targetRaw.tickets),
      versions: stringList(targetRaw.versions),
    },
    modality,
    polarity,
    text: statement,
    lifecycle,
    sourceKind: 'document',
    sourcePath: context.sourcePath,
    sourceLines: { start: context.start, end: context.end },
    symbol: object,
    extractor: EXTRACTOR,
    rawExcerpt: statement,
    epistemicClass: 'declaration',
    confidence: 0.9,
    basis: ['authored_intent_block', ...stringList(item.basis)],
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const candidate = text(value) as T;
  return allowed.has(candidate) ? candidate : fallback;
}
