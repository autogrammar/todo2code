import { createRelationId, graphFingerprint } from '../core/id.js';
import { assertIntentRecords } from '../core/schema.js';
import { pathAliases, symbolAliases } from '../core/target.js';
import type { IntentGraph, IntentRecord, IntentRelation } from '../core/types.js';
import { buildSymbolResolutionIndex, hasResolvedNlAstSymbolPair, type SymbolResolutionIndex } from './symbol-resolution.js';
import { aggregateCapabilityOverlap, isFileAggregate } from './capability-evidence.js';
import {
  collectCandidatePairs,
  indexKeywords as buildKeywordIndex,
  type RecordKeywords,
} from './linker-candidates.js';
import { determineRelation } from './linker-relations.js';

interface PairEvidence {
  score: number;
  basis: string[];
  /** Best of object/text similarity, reused by `determineRelation`. */
  textScore: number;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  // Iterate the smaller set: membership tests dominate this loop.
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let intersection = 0;
  for (const item of small) {
    if (large.has(item)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

export function linkIntentRecords(inputRecords: IntentRecord[], generatedAt = new Date().toISOString()): IntentGraph {
  assertIntentRecords(inputRecords);
  const records = deduplicateRecords(inputRecords).sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(records.map((record) => [record.id, record]));
  const keywordIndex = buildKeywordIndex(records);
  const symbolResolutionIndex = buildSymbolResolutionIndex(records);
  const candidatePairs = collectCandidatePairs(records, keywordIndex);
  const resolvableBasenames = indexResolvableBasenames(records);
  const relations: IntentRelation[] = [];

  for (const [leftId, rightId] of candidatePairs) {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) continue;
    const evidence = scorePair(left, right, keywordIndex, resolvableBasenames, symbolResolutionIndex);
    if (evidence.score < 0.42) continue;
    const directed = determineRelation(left, right, evidence);
    const relationWithoutId = {
      from: directed.from.id,
      to: directed.to.id,
      type: directed.type,
      confidence: Math.round(Math.min(0.99, evidence.score) * 1000) / 1000,
      basis: evidence.basis,
    };
    relations.push({ id: createRelationId(relationWithoutId), ...relationWithoutId });
  }

  const uniqueRelations = [...new Map(relations.map((relation) => [relation.id, relation])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: 't2c.graph/v1',
    generatedAt,
    fingerprint: graphFingerprint(records, uniqueRelations),
    records,
    relations: uniqueRelations,
    stats: {
      bySource: countBy(records, (record) => record.source.kind),
      byAction: countBy(records, (record) => record.statement.action),
      byStatus: countBy(records, (record) => record.lifecycle.status),
    },
  };
}

function deduplicateRecords(records: IntentRecord[]): IntentRecord[] {
  const byId = new Map<string, IntentRecord>();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (!existing || record.epistemic.confidence > existing.epistemic.confidence) byId.set(record.id, record);
  }
  return [...byId.values()];
}

/**
 * Basenames that identify exactly one file in this repository.
 *
 * Documentation routinely names a source file without its directory —
 * "the `markdown.ts` converter". `pathAliases` already emits the basename, but
 * unconditionally: on this repository `validation.ts`, `types.ts` and `git.ts`
 * each name two or three different files, so a bare mention silently matched
 * all of them. Only a basename owned by a single full path can stand in for it;
 * the rest keep requiring the directory.
 */
function indexResolvableBasenames(records: IntentRecord[]): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const record of records) {
    // Module facts are observations of files that actually exist. A full path
    // mentioned by a plan or document may be hypothetical and must not make a
    // real repository basename appear ambiguous.
    if (record.source.kind !== 'ast' || record.statement.kind !== 'module_fact') continue;
    for (const value of record.statement.target.paths) {
      const normalized = value.trim().toLowerCase().replace(/\\/g, '/');
      if (!normalized.includes('/')) continue;
      const basename = normalized.split('/').at(-1);
      if (!basename) continue;
      const paths = owners.get(basename) ?? new Set<string>();
      paths.add(normalized);
      owners.set(basename, paths);
    }
  }
  return new Set([...owners.entries()].filter(([, paths]) => paths.size === 1).map(([basename]) => basename));
}

/**
 * Path overlap that only trusts a bare basename when the repository resolves it
 * unambiguously. Full paths always compare directly.
 */
function pathsIntersect(left: string[], right: string[], resolvable: Set<string>): boolean {
  const expand = (values: string[]): Set<string> => {
    const output = new Set<string>();
    for (const value of values) {
      const aliases = pathAliases(value);
      const full = aliases[0];
      if (full) output.add(full);
      // A basename alias is evidence only when it names one file repo-wide.
      for (const alias of aliases.slice(1)) {
        if (resolvable.has(alias)) output.add(alias);
      }
      // A bare mention resolves through the same gate.
      if (full && !full.includes('/') && resolvable.has(full)) output.add(full);
    }
    return output;
  };
  const leftSet = expand(left);
  return [...expand(right)].some((value) => leftSet.has(value));
}

function scorePair(
  left: IntentRecord,
  right: IntentRecord,
  index: Map<string, RecordKeywords>,
  resolvableBasenames: Set<string>,
  symbolResolutionIndex: SymbolResolutionIndex,
): PairEvidence {
  let score = 0;
  const basis: string[] = [];
  const leftKeywords = index.get(left.id);
  const rightKeywords = index.get(right.id);
  score += scoreSharedTickets(left, right, basis);
  score += scoreSharedSymbol(left, right, symbolResolutionIndex, basis);
  score += scoreSharedPath(left, right, resolvableBasenames, basis);
  score += scoreSameAction(left, right, basis);
  const objectSimilarity = scoreObjectSimilarity(leftKeywords, rightKeywords, basis);
  score += objectSimilarity * 0.48;
  score += scoreSharedTopics(left, right, leftKeywords, rightKeywords, basis);
  score += scoreSourceKindPenalty(left, right);
  return {
    score: Math.max(0, score),
    basis: [...new Set(basis)].sort(),
    textScore: objectSimilarity,
  };
}

function scoreSharedTickets(left: IntentRecord, right: IntentRecord, basis: string[]): number {
  if (!intersects(left.statement.target.tickets, right.statement.target.tickets)) return 0;
  basis.push('shared_ticket');
  return 0.62;
}

function scoreSharedSymbol(
  left: IntentRecord,
  right: IntentRecord,
  symbolResolutionIndex: SymbolResolutionIndex,
  basis: string[],
): number {
  const hasResolvedSymbol = hasResolvedNlAstSymbolPair(left, right, symbolResolutionIndex);
  const hasSharedAlias = intersectsAliases(left.statement.target.symbols, right.statement.target.symbols, symbolAliases);
  if (!(hasResolvedSymbol ?? hasSharedAlias)) return 0;
  basis.push('shared_symbol');
  return 0.48;
}

function scoreSharedPath(
  left: IntentRecord,
  right: IntentRecord,
  resolvableBasenames: Set<string>,
  basis: string[],
): number {
  if (!pathsIntersect(left.statement.target.paths, right.statement.target.paths, resolvableBasenames)) return 0;
  let points = 0.28;
  basis.push('shared_path');
  if (!isFileAggregateEvidencePair(left, right)) return points;
  points += 0.24;
  basis.push('module_coverage');
  const capabilityOverlap = aggregateCapabilityOverlap(left, right);
  if (capabilityOverlap > 0) basis.push(`capability_overlap:${capabilityOverlap}`);
  return points;
}

function scoreSameAction(left: IntentRecord, right: IntentRecord, basis: string[]): number {
  if (!(left.statement.action === right.statement.action && left.statement.action !== 'unknown')) return 0;
  basis.push('same_action');
  return 0.13;
}

function scoreObjectSimilarity(
  leftKeywords: RecordKeywords | undefined,
  rightKeywords: RecordKeywords | undefined,
  basis: string[],
): number {
  const objectSimilarity = leftKeywords && rightKeywords
    ? Math.max(
      jaccard(leftKeywords.object, rightKeywords.object),
      jaccard(leftKeywords.text, rightKeywords.text),
    )
    : 0;
  if (objectSimilarity >= 0.2) {
    basis.push(`text_similarity:${objectSimilarity.toFixed(3)}`);
    return objectSimilarity;
  }
  return 0;
}

function scoreSharedTopics(
  left: IntentRecord,
  right: IntentRecord,
  leftKeywords: RecordKeywords | undefined,
  rightKeywords: RecordKeywords | undefined,
  basis: string[],
): number {
  if (!isModuleTopicEvidencePair(left, right) || !leftKeywords || !rightKeywords) return 0;
  const sharedTopics = intersectionSize(leftKeywords.topics, rightKeywords.topics);
  // Two generic words still connected one declaration to dozens of modules
  // in the measured repository. Three independently normalised topics keeps
  // prose-only matching useful while retaining a precision-oriented floor.
  if (sharedTopics < 3) return 0;
  basis.push(`module_topic:${sharedTopics}`);
  return Math.min(0.64, 0.32 + sharedTopics * 0.08);
}

function scoreSourceKindPenalty(left: IntentRecord, right: IntentRecord): number {
  return left.source.kind === right.source.kind ? -0.08 : 0;
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let size = 0;
  for (const value of small) if (large.has(value)) size += 1;
  return size;
}

/**
 * A record standing for a whole file rather than one symbol or key.
 *
 * `module_fact` covers source modules; `configuration_file_fact` covers
 * configuration files. Both exist so a declaration can bind to a file instead
 * of to every declaration inside it.
 */
function isFileAggregateEvidencePair(left: IntentRecord, right: IntentRecord): boolean {
  return left.source.kind !== right.source.kind
    && (isFileAggregate(left) || isFileAggregate(right));
}

/** Capability-topic matching is intentionally narrower than exact file evidence. */
function isModuleTopicEvidencePair(left: IntentRecord, right: IntentRecord): boolean {
  return left.source.kind !== right.source.kind
    && (left.statement.kind === 'module_fact' || right.statement.kind === 'module_fact');
}

function intersects(left: string[], right: string[]): boolean {
  const set = new Set(left);
  return right.some((value) => set.has(value));
}

function intersectsAliases(left: string[], right: string[], aliases: (value: string) => string[]): boolean {
  const set = new Set(left.flatMap(aliases));
  return right.some((value) => aliases(value).some((alias) => set.has(alias)));
}

function countBy(records: IntentRecord[], selector: (record: IntentRecord) => string): Record<string, number> {
  const output: Record<string, number> = {};
  for (const record of records) {
    const key = selector(record);
    output[key] = (output[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}
