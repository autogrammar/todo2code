import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { readText, relativePosix } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type {
  ExtractionResult,
  IntentRecord,
  LifecycleStatus,
  Polarity,
} from '../core/types.js';

const LEDGER_SCHEMA = 'subactor.autonom-intent/v1';
const EXTRACTOR = 't2c/autonom-runtime-intent@1';
const MAX_PER_SECTION = 500;

/**
 * An autonomy intent/grant ledger -> Intent DSL.
 *
 * The autonomy runtime (llm-account-hub) tracks *declared intents* and the
 * *access grants* that authorize them; this project tracks declared intent in
 * git, code, docs and TODO. Neither half sees the other, so a live intent (what
 * the autonomy is doing right now, on which resource, under which grant) never
 * reached the intent graph and could not be linked to the code and tickets that
 * govern it.
 *
 * The ledger is evidence, not a plan: every record enters as `fact` describing
 * observed runtime state. An intent links to code through its `watches` paths
 * and to work through its `ticket`; a grant links through its `resource` symbol
 * and `ticket`. The ledger carries only references (vault paths, lease ids),
 * never secret values, so nothing sensitive enters the graph.
 */
export async function extractRuntimeIntentLedger(
  ledgerInput: string,
  config: T2CConfig,
  rootInput?: string,
): Promise<ExtractionResult> {
  const ledgerPath = path.resolve(ledgerInput);
  const root = path.resolve(rootInput ?? process.cwd());
  const body = await readText(ledgerPath, config.maxFileBytes);
  const ledger = parseLedger(body, ledgerPath);
  const sourcePath = sourcePathFor(root, ledgerPath);
  const observedAt = typeof ledger.observed_at === 'string' ? ledger.observed_at : null;
  const host = typeof ledger.host === 'string' ? ledger.host : 'unknown-host';

  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const context = { sourcePath, observedAt, host };

  for (const intent of boundedArray(ledger.intents, 'intents', warnings)) {
    records.push(intentRecord(intent, context));
  }
  for (const grant of boundedArray(ledger.grants, 'grants', warnings)) {
    records.push(grantRecord(grant, context));
  }
  return { records, warnings };
}

interface LedgerContext {
  sourcePath: string;
  observedAt: string | null;
  host: string;
}

function parseLedger(body: string, ledgerPath: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error(`${ledgerPath}: not JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${ledgerPath}: expected an autonom intent ledger object`);
  }
  const ledger = parsed as Record<string, unknown>;
  if (ledger.schema !== LEDGER_SCHEMA) {
    throw new Error(`${ledgerPath}: expected schema ${LEDGER_SCHEMA}, got ${String(ledger.schema)}`);
  }
  return ledger;
}

/**
 * The ledger is usually written outside the repository (a state dir, an HTTP
 * export), so a path relative to the root is only meaningful when it is inside.
 */
function sourcePathFor(root: string, ledgerPath: string): string {
  const relative = relativePosix(root, ledgerPath);
  return relative.startsWith('../') ? path.posix.basename(ledgerPath) : relative;
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

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/**
 * The repository paths an intent declares it watches, which is what lets a live
 * intent meet the code and docs that claim to govern it: the linker joins
 * records by target path and symbol. Without them the ledger is the only
 * address available, and records link to nothing but each other.
 */
function watched(intent: Record<string, unknown>, context: LedgerContext): string[] {
  const declared = stringList(intent.watches);
  return declared.length ? declared : [context.sourcePath];
}

function intentLifecycle(state: string): LifecycleStatus {
  if (state === 'paused') return 'blocked';
  if (state === 'completed') return 'completed';
  if (state === 'started') return 'in_progress';
  return 'unknown';
}

function intentRecord(intent: Record<string, unknown>, context: LedgerContext): IntentRecord {
  const id = text(intent.intent_id) || 'intent';
  const state = text(intent.state) || 'unknown';
  const ticket = text(intent.ticket);
  const resource = text(intent.resource) || context.host;
  const polarity: Polarity = state === 'paused' ? 'negative' : 'positive';
  const excerpt = `intent ${id} on ${resource}: ${state}`;
  return buildRecord({
    kind: 'autonomy_intent',
    action: 'declare',
    object: id,
    subject: context.host,
    target: {
      paths: watched(intent, context),
      symbols: [id],
      tickets: ticket ? [ticket] : [],
    },
    modality: 'observed',
    polarity,
    text: excerpt,
    lifecycle: intentLifecycle(state),
    sourceKind: 'system',
    sourcePath: context.sourcePath,
    symbol: id,
    extractor: EXTRACTOR,
    rawExcerpt: excerpt,
    epistemicClass: 'fact',
    confidence: 0.95,
    basis: ['autonom_intent_state', `state:${state}`],
    observedAt: context.observedAt,
    metadata: {
      host: context.host,
      state,
      resource,
      grantId: text(intent.grant_id),
      planRef: text(intent.plan_ref),
      result: text(intent.result),
      llmUsed: false,
    },
  });
}

function grantLifecycle(effectiveState: string): LifecycleStatus {
  // An active grant is verified authorization; a revoked or expired one is a
  // closed lifecycle, not a blocking finding.
  return effectiveState === 'issued' ? 'verified' : 'completed';
}

function grantRecord(grant: Record<string, unknown>, context: LedgerContext): IntentRecord {
  const id = text(grant.grant_id) || 'grant';
  const state = text(grant.effective_state) || text(grant.state) || 'unknown';
  const resource = text(grant.resource) || context.host;
  const ticket = text(grant.ticket);
  const subject = text(grant.subject) || context.host;
  const scope = stringList(grant.scope);
  const polarity: Polarity = state === 'issued' ? 'positive' : 'negative';
  const excerpt = `grant ${id} -> ${subject} on ${resource} [${scope.join(',')}]: ${state}`;
  return buildRecord({
    kind: 'autonomy_access_grant',
    action: 'configure',
    object: id,
    subject,
    target: {
      paths: [context.sourcePath],
      symbols: [id, resource],
      tickets: ticket ? [ticket] : [],
    },
    modality: 'observed',
    polarity,
    text: excerpt,
    lifecycle: grantLifecycle(state),
    sourceKind: 'system',
    sourcePath: context.sourcePath,
    symbol: id,
    extractor: EXTRACTOR,
    rawExcerpt: excerpt,
    epistemicClass: 'fact',
    confidence: 0.95,
    basis: ['autonom_access_grant', `state:${state}`, ...scope.map((item) => `scope:${item}`)],
    observedAt: context.observedAt,
    metadata: {
      host: context.host,
      subject,
      resource,
      scope: scope.join(','),
      state,
      literalState: text(grant.state),
      expiresAt: text(grant.expires_at),
      vaultPath: text(grant.vault_path),
      revokedReason: text(grant.revoked_reason),
      llmUsed: false,
    },
  });
}
