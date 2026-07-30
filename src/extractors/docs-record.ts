import { buildRecord } from '../core/record.js';
import {
  classifyActionHeuristically,
  detectModality,
  extractPaths,
  extractSymbols,
  extractTickets,
  extractVersions,
  keywords,
} from '../core/text.js';
import type {
  IntentAction,
  IntentRecord,
  LifecycleStatus,
  LlmResponseMetadata,
  Modality,
} from '../core/types.js';
import { T2C_VERSION } from '../version.js';
import type { DocumentChunk, RawDocumentRecord } from './docs-types.js';

const OBJECT_PLACEHOLDERS = new Set([
  'unknown', 'unspecified', 'none', 'null', 'n/a', 'na', '-', 'brak', 'nieznany', 'nieokreślony',
]);

export function toDocumentIntentRecord(
  raw: RawDocumentRecord,
  chunk: DocumentChunk,
  model: string,
  response: LlmResponseMetadata,
): IntentRecord {
  const extraBasis: string[] = [];
  const statementText = raw.text || raw.object || '';
  const { object, missingFields } = resolveObject(raw);
  const { start, end } = anchorToSource(raw, chunk, `${object} ${statementText}`, extraBasis);
  const target = resolveTarget(raw, statementText, extraBasis);
  const action = resolveAction(raw, statementText, extraBasis);
  const modality = resolveModality(raw, statementText, extraBasis);
  if (action === 'unknown') missingFields.push('action');

  return buildRecord({
    kind: raw.kind || 'documented_intent',
    actor: raw.actor ?? null,
    action,
    subject: raw.subject ?? null,
    object,
    target,
    modality,
    polarity: raw.polarity === 'negative' ? 'negative' : 'positive',
    text: statementText || object,
    lifecycle: allowedLifecycle(raw.lifecycle) ? raw.lifecycle : 'proposed',
    sourceKind: 'document',
    sourcePath: chunk.path,
    sourceLines: { start, end },
    extractor: 't2c/document-openrouter@1',
    rawExcerpt: linesFromChunk(chunk, start, end),
    epistemicClass: 'llm_inference',
    confidence: Math.min(0.85, Math.max(0.05, Number(raw.confidence) || 0.5)),
    basis: [...new Set(['openrouter_structured_extraction', ...(raw.basis ?? []), ...extraBasis])],
    generation: {
      requested: 'llm', used: 'llm', provider: response.provider ?? 'openrouter',
      model: response.model ?? model, responseId: response.responseId,
    },
    metadata: {
      missingFields,
      model,
      llmUsed: true,
      runtimeVersion: T2C_VERSION,
      chunkStartLine: chunk.startLine,
      chunkEndLine: chunk.endLine,
      response,
    },
  });
}

function isPlaceholder(value: string | null | undefined): boolean {
  return !value?.trim() || OBJECT_PLACEHOLDERS.has(value.trim().toLowerCase());
}

function resolveObject(raw: RawDocumentRecord): { object: string; missingFields: string[] } {
  if (!isPlaceholder(raw.object)) return { object: raw.object.trim(), missingFields: [] };
  const fallback = raw.text?.trim();
  return {
    object: isPlaceholder(fallback) ? 'unspecified' : (fallback as string),
    missingFields: ['object'],
  };
}

/**
 * Re-anchors a record to the line that actually carries its statement.
 * The model's line wins ties and is replaced only by demonstrably stronger
 * vocabulary overlap elsewhere in the chunk.
 */
function anchorToSource(
  raw: RawDocumentRecord,
  chunk: DocumentChunk,
  statement: string,
  basis: string[],
): { start: number; end: number } {
  const claimedStart = clampLine(raw.sourceLines?.start ?? chunk.startLine, chunk.startLine, chunk.endLine);
  const claimedEnd = clampLine(raw.sourceLines?.end ?? claimedStart, claimedStart, chunk.endLine);
  const wanted = new Set(keywords(statement));
  if (wanted.size === 0) return { start: claimedStart, end: claimedEnd };

  const lines = chunk.content.split(/\r?\n/);
  const scores = lines.map((line) => keywordOverlap(wanted, line));
  const claimedScore = Math.max(...scores.slice(
    claimedStart - chunk.startLine,
    claimedEnd - chunk.startLine + 1,
  ));
  const bestScore = Math.max(...scores);
  const bestIndex = scores.indexOf(bestScore);

  if (bestIndex < 0 || bestScore <= claimedScore) return { start: claimedStart, end: claimedEnd };
  basis.push('runtime_line_reanchor');
  const anchored = chunk.startLine + bestIndex;
  return { start: anchored, end: anchored };
}

function keywordOverlap(wanted: Set<string>, line: string): number {
  const present = new Set(keywords(line));
  let shared = 0;
  for (const word of wanted) {
    if (present.has(word)) shared += 1;
  }
  return shared;
}

function resolveTarget(
  raw: RawDocumentRecord,
  statement: string,
  basis: string[],
): { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] } {
  const target = {
    paths: raw.target?.paths ?? [],
    symbols: raw.target?.symbols ?? [],
    tickets: raw.target?.tickets ?? [],
    versions: raw.target?.versions ?? [],
  };
  if (hasTarget(target) || !statement.trim()) return target;

  const derived = {
    paths: extractPaths(statement),
    symbols: extractSymbols(statement),
    tickets: extractTickets(statement),
    versions: extractVersions(statement),
  };
  if (!hasTarget(derived)) return target;
  basis.push('runtime_target_backfill');
  return derived;
}

function hasTarget(target: RawDocumentRecord['target']): boolean {
  return Boolean(target.paths.length || target.symbols.length || target.tickets.length || target.versions.length);
}

function resolveAction(raw: RawDocumentRecord, statement: string, basis: string[]): IntentAction {
  if (allowedAction(raw.action) && raw.action !== 'unknown') return raw.action;
  if (!statement.trim()) return 'unknown';
  const derived = classifyActionHeuristically(statement);
  if (derived !== 'unknown') basis.push('runtime_action_backfill');
  return derived;
}

function resolveModality(raw: RawDocumentRecord, statement: string, basis: string[]): Modality {
  if (allowedModality(raw.modality) && raw.modality !== 'unknown') return raw.modality;
  if (!statement.trim()) return 'unknown';
  const derived = detectModality(statement);
  if (derived !== 'unknown') basis.push('runtime_modality_backfill');
  return derived;
}

function linesFromChunk(chunk: DocumentChunk, start: number, end: number): string {
  const lines = chunk.content.split(/\r?\n/);
  const relativeStart = Math.max(0, start - chunk.startLine);
  const relativeEnd = Math.min(lines.length, end - chunk.startLine + 1);
  return lines.slice(relativeStart, relativeEnd).join('\n').slice(0, 2000);
}

function clampLine(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function allowedAction(value: string): value is IntentAction {
  return ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate', 'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown'].includes(value);
}

function allowedModality(value: string): value is Modality {
  return ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'].includes(value);
}

function allowedLifecycle(value: string): value is LifecycleStatus {
  return ['proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown'].includes(value);
}
