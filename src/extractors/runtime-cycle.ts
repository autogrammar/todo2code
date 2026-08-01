import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { readText, relativePosix } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type {
  ExtractionResult,
  IntentAction,
  IntentRecord,
  JsonValue,
  LifecycleStatus,
} from '../core/types.js';

const CYCLE_SCHEMA = 'subactor.autonom-cycle/v1';
const EXTRACTOR = 't2c/autonom-runtime-cycle@1';
const MAX_PER_SECTION = 200;

/**
 * An `autonom` observation cycle -> Intent DSL.
 *
 * `autonom` watches the running system (gates, services, HTTP, fact drift
 * between cycles); this project watches declared intent (git, code, docs,
 * TODO). Neither can see the other's half, so a runtime fact never reached the
 * intent graph and could not ground a conclusion or a TODO proposal.
 *
 * The cycle document is evidence, not intent: probe outcomes and drift enter as
 * `fact`, and the cycle's own suggestions as `inference`. Nothing here is a
 * plan — `autonom` never acts, and neither does this extractor.
 */
export async function extractRuntimeCycleIntent(
  cycleInput: string,
  config: T2CConfig,
  rootInput?: string,
): Promise<ExtractionResult> {
  const cyclePath = path.resolve(cycleInput);
  const root = path.resolve(rootInput ?? process.cwd());
  const body = await readText(cyclePath, config.maxFileBytes);
  const cycle = parseCycle(body, cyclePath);
  const sourcePath = sourcePathFor(root, cyclePath);
  const observedAt = typeof cycle.observed_at === 'string' ? cycle.observed_at : null;
  const host = typeof cycle.host === 'string' ? cycle.host : 'unknown-host';

  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const context = { sourcePath, observedAt, host };

  const results = boundedArray(cycle.results, 'results', warnings);
  for (const result of results) {
    records.push(probeRecord(result, context));
    for (const violation of boundedArray(result.violations, `${label(result)}.violations`, warnings)) {
      records.push(violationRecord(result, violation, context));
    }
  }
  for (const item of boundedArray(cycle.drift, 'drift', warnings)) {
    records.push(driftRecord(item, context));
  }
  for (const proposal of boundedArray(cycle.proposals, 'proposals', warnings)) {
    records.push(proposalRecord(proposal, context));
  }
  return { records, warnings };
}

interface CycleContext {
  sourcePath: string;
  observedAt: string | null;
  host: string;
}

function parseCycle(body: string, cyclePath: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error(`${cyclePath}: not JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${cyclePath}: expected an autonom cycle object`);
  }
  const cycle = parsed as Record<string, unknown>;
  if (cycle.schema !== CYCLE_SCHEMA) {
    throw new Error(`${cyclePath}: expected schema ${CYCLE_SCHEMA}, got ${String(cycle.schema)}`);
  }
  return cycle;
}

/**
 * The cycle document is usually written outside the repository (a state dir, a
 * pipe), so a path relative to the root is only meaningful when it is inside.
 */
function sourcePathFor(root: string, cyclePath: string): string {
  const relative = relativePosix(root, cyclePath);
  return relative.startsWith('../') ? path.posix.basename(cyclePath) : relative;
}

function boundedArray(value: unknown, name: string, warnings: string[]): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    warnings.push(`${name}: expected an array, ignoring`);
    return [];
  }
  const objects = value.filter(
    (item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item),
  );
  if (objects.length !== value.length) warnings.push(`${name}: ignored ${value.length - objects.length} non-object entries`);
  if (objects.length > MAX_PER_SECTION) {
    warnings.push(`${name}: truncated to ${MAX_PER_SECTION} of ${objects.length} entries`);
    return objects.slice(0, MAX_PER_SECTION);
  }
  return objects;
}

function label(result: Record<string, unknown>): string {
  return text(result.id) || 'probe';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function tags(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/**
 * The repository paths a probe declares it watches, which is what lets a
 * runtime fact meet the code and docs that claim to govern it: the linker joins
 * records by target path and symbol. Without them the cycle document is the
 * only address available, and records link to nothing but each other.
 */
function watched(result: Record<string, unknown>, context: CycleContext): string[] {
  const declared = Array.isArray(result.watches) ? result.watches.map(text).filter(Boolean) : [];
  return declared.length ? declared : [context.sourcePath];
}

function probeRecord(result: Record<string, unknown>, context: CycleContext): IntentRecord {
  const id = label(result);
  const failed = result.ok !== true;
  const error = text(result.error);
  const outcome = error ? `unevaluable (${error})` : failed ? 'violating' : 'healthy';
  const excerpt = `probe ${id} on ${context.host}: ${outcome}`;
  // An unevaluable probe is not a failing one: it hides the fact it watched,
  // so it must not read as evidence about the system.
  const lifecycle: LifecycleStatus = error ? 'unknown' : failed ? 'blocked' : 'verified';
  return buildRecord({
    kind: 'runtime_probe_observation',
    action: 'validate',
    object: id,
    subject: context.host,
    target: { paths: watched(result, context), symbols: [id], tickets: [] },
    modality: 'observed',
    polarity: failed || error ? 'negative' : 'positive',
    text: text(result.note) || excerpt,
    lifecycle,
    sourceKind: 'system',
    sourcePath: context.sourcePath,
    symbol: id,
    extractor: EXTRACTOR,
    rawExcerpt: excerpt,
    epistemicClass: 'fact',
    confidence: error ? 0.5 : 0.95,
    basis: ['autonom_probe_result', ...tags(result.tags)],
    observedAt: context.observedAt,
    metadata: {
      host: context.host,
      ask: text(result.ask),
      ok: result.ok === true,
      unevaluable: Boolean(error),
      facts: factsMetadata(result.facts),
      llmUsed: false,
    },
  });
}

function violationRecord(
  result: Record<string, unknown>,
  violation: Record<string, unknown>,
  context: CycleContext,
): IntentRecord {
  const probe = label(result);
  const fact = text(violation.fact) || 'fact';
  const excerpt = `${probe}.${fact}: expected ${JSON.stringify(violation.expected ?? null)}, observed ${JSON.stringify(violation.actual ?? null)}`;
  return buildRecord({
    kind: 'runtime_expectation_violated',
    action: 'fix',
    object: `${probe}.${fact}`,
    subject: context.host,
    target: { paths: watched(result, context), symbols: [probe, fact], tickets: [] },
    modality: 'required',
    polarity: 'negative',
    text: excerpt,
    lifecycle: 'blocked',
    sourceKind: 'system',
    sourcePath: context.sourcePath,
    symbol: `${probe}.${fact}`,
    extractor: EXTRACTOR,
    rawExcerpt: excerpt,
    epistemicClass: 'fact',
    confidence: 0.95,
    basis: ['autonom_expectation_violation', ...tags(result.tags)],
    observedAt: context.observedAt,
    metadata: {
      host: context.host,
      probe,
      fact,
      expected: jsonScalar(violation.expected),
      actual: jsonScalar(violation.actual),
      llmUsed: false,
    },
  });
}

function driftRecord(item: Record<string, unknown>, context: CycleContext): IntentRecord {
  const probe = text(item.probe) || 'probe';
  const fact = text(item.fact) || 'fact';
  const excerpt = `${probe}.${fact}: ${JSON.stringify(item.was ?? null)} -> ${JSON.stringify(item.now ?? null)}`;
  return buildRecord({
    kind: 'runtime_fact_drifted',
    action: 'change',
    object: `${probe}.${fact}`,
    subject: context.host,
    target: { paths: [context.sourcePath], symbols: [probe, fact], tickets: [] },
    modality: 'observed',
    polarity: 'negative',
    text: excerpt,
    lifecycle: 'unknown',
    sourceKind: 'system',
    sourcePath: context.sourcePath,
    symbol: `${probe}.${fact}`,
    extractor: EXTRACTOR,
    rawExcerpt: excerpt,
    epistemicClass: 'fact',
    confidence: 0.9,
    basis: ['autonom_cycle_drift', ...tags(item.tags)],
    observedAt: context.observedAt,
    metadata: {
      host: context.host,
      probe,
      fact,
      was: jsonScalar(item.was),
      now: jsonScalar(item.now),
      llmUsed: false,
    },
  });
}

/**
 * A cycle proposal is derived from the evidence above, never measured, so it
 * enters as `inference` at `proposed`. `acts` is always false in the source
 * document; carrying it forward keeps that promise visible in the graph.
 */
function proposalRecord(proposal: Record<string, unknown>, context: CycleContext): IntentRecord {
  const kind = text(proposal.kind) || 'proposal';
  const probe = text(proposal.probe) || 'cycle';
  const detail = text(proposal.detail);
  const excerpt = `[${kind}] ${probe}: ${detail}`;
  return buildRecord({
    kind: 'runtime_cycle_proposal',
    action: proposalAction(kind),
    object: `${probe}.${kind}`,
    subject: context.host,
    target: { paths: [context.sourcePath], symbols: [probe], tickets: [] },
    modality: 'recommended',
    polarity: 'positive',
    text: text(proposal.suggestion) || excerpt,
    lifecycle: 'proposed',
    sourceKind: 'system',
    sourcePath: context.sourcePath,
    symbol: probe,
    extractor: EXTRACTOR,
    rawExcerpt: excerpt,
    epistemicClass: 'inference',
    confidence: 0.6,
    basis: ['autonom_cycle_proposal', `kind:${kind}`],
    observedAt: context.observedAt,
    metadata: {
      host: context.host,
      probe,
      proposalKind: kind,
      detail,
      acts: proposal.acts === true,
      llmUsed: false,
    },
  });
}

function proposalAction(kind: string): IntentAction {
  if (kind === 'expectation_violated') return 'fix';
  if (kind === 'ratchet_can_tighten') return 'configure';
  if (kind === 'fact_drifted') return 'validate';
  if (kind === 'probe_unevaluable') return 'fix';
  return 'analyze';
}

function factsMetadata(value: unknown): JsonValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const facts: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    facts[key] = jsonScalar(item);
  }
  return facts;
}

function jsonScalar(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}
