import { createRelationId, graphFingerprint } from '../core/id.js';
import { assertIntentRecords } from '../core/schema.js';
import { keywords } from '../core/text.js';
import { pathAliases, symbolAliases } from '../core/target.js';
import type { IntentGraph, IntentRecord, IntentRelation, RelationType, SourceKind } from '../core/types.js';

interface PairEvidence {
  score: number;
  basis: string[];
  /** Best of object/text similarity, reused by `determineRelation`. */
  textScore: number;
}

/**
 * Tokenising `statement.object` and `statement.text` is the linker's hot path:
 * scoring recomputed both for every candidate pair, so a repository producing
 * ~177k pairs performed ~1.4M tokenisations. Keyword sets are computed once per
 * record instead and compared with a plain Jaccard index.
 */
interface RecordKeywords {
  object: Set<string>;
  text: Set<string>;
}

interface DirectedRelation {
  from: IntentRecord;
  to: IntentRecord;
  type: RelationType;
}

interface SourceRelationRule {
  anchor: SourceKind;
  others: ReadonlySet<SourceKind>;
  type: RelationType;
  anchorPosition: 'from' | 'to';
}

const SOURCE_RELATION_RULES: SourceRelationRule[] = [
  { anchor: 'git', others: new Set(['todo', 'nl', 'document']), type: 'implements', anchorPosition: 'from' },
  {
    anchor: 'ast',
    others: new Set<SourceKind>(['nl', 'git', 'todo', 'changelog', 'document', 'agent_log', 'test', 'system']),
    type: 'evidenced_by',
    anchorPosition: 'to',
  },
  { anchor: 'changelog', others: new Set(['git', 'ast']), type: 'releases', anchorPosition: 'from' },
  { anchor: 'todo', others: new Set(['nl', 'document']), type: 'plans', anchorPosition: 'from' },
  { anchor: 'document', others: new Set(['nl']), type: 'documents', anchorPosition: 'from' },
];

function indexKeywords(records: IntentRecord[]): Map<string, RecordKeywords> {
  return new Map(records.map((record) => [record.id, {
    object: new Set(keywords(record.statement.object)),
    text: new Set(keywords(record.statement.text)),
  }]));
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
  const keywordIndex = indexKeywords(records);
  const candidatePairs = collectCandidatePairs(records, keywordIndex);
  const relations: IntentRelation[] = [];

  for (const [leftId, rightId] of candidatePairs) {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) continue;
    const evidence = scorePair(left, right, keywordIndex);
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
 * Builds the candidate pairs the scorer has to inspect.
 *
 * Pairs are returned as tuples rather than `"left|right"` keys so the scoring
 * loop does not re-split a string per pair; the map key exists only to
 * deduplicate, and the result is sorted by it to keep output deterministic.
 */
function collectCandidatePairs(
  records: IntentRecord[],
  keywordIndex: Map<string, RecordKeywords>,
): Array<[string, string]> {
  const buckets = new Map<string, string[]>();
  const astIds = new Set<string>();
  for (const record of records) {
    if (record.source.kind === 'ast') astIds.add(record.id);
    indexTargetBuckets(buckets, record);
    indexKeywordBuckets(buckets, record.id, keywordIndex.get(record.id)?.object);
  }
  return pairsFromBuckets(buckets, astIds);
}

function indexTargetBuckets(buckets: Map<string, string[]>, record: IntentRecord): void {
  for (const ticket of record.statement.target.tickets) {
    addToBucket(buckets, `ticket:${ticket.toLowerCase()}`, record.id);
  }
  indexAliases(buckets, 'symbol', record.id, record.statement.target.symbols, symbolAliases);
  indexAliases(buckets, 'path', record.id, record.statement.target.paths, pathAliases);
}

function indexAliases(
  buckets: Map<string, string[]>,
  prefix: string,
  recordId: string,
  values: string[],
  aliases: (value: string) => string[],
): void {
  for (const value of values) {
    for (const alias of aliases(value)) addToBucket(buckets, `${prefix}:${alias}`, recordId);
  }
}

function indexKeywordBuckets(
  buckets: Map<string, string[]>,
  recordId: string,
  objectKeywords: Set<string> | undefined,
): void {
  // A Set preserves the sorted insertion order of `keywords()`, so slicing the
  // materialized values keeps the same five-token candidate limit.
  for (const token of [...(objectKeywords ?? [])].slice(0, 5)) {
    addToBucket(buckets, `token:${token}`, recordId);
  }
}

function addToBucket(buckets: Map<string, string[]>, key: string, recordId: string): void {
  const values = buckets.get(key);
  if (values) values.push(recordId);
  else buckets.set(key, [recordId]);
}

function pairsFromBuckets(
  buckets: Map<string, string[]>,
  astIds: Set<string>,
): Array<[string, string]> {
  const output = new Map<string, [string, string]>();
  for (const [bucketKey, ids] of buckets) {
    const limited = [...new Set(ids)].sort().slice(0, 300);
    for (let left = 0; left < limited.length; left += 1) {
      for (let right = left + 1; right < limited.length; right += 1) {
        const leftId = limited[left];
        const rightId = limited[right];
        if (!leftId || !rightId) continue;
        // A shared file is weak evidence between two AST facts: every symbol
        // declared in a module shares that module's path, so this bucket alone
        // produced ~80% of all candidate pairs and filled the graph with
        // `related_to` noise between unrelated functions. Such a pair still
        // enters the graph when the symbol or keyword bucket also connects it.
        if (isSuppressedAstPathPair(bucketKey, leftId, rightId, astIds)) continue;
        output.set(`${leftId}|${rightId}`, [leftId, rightId]);
      }
    }
  }

  return [...output.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, pair]) => pair);
}

function isSuppressedAstPathPair(
  bucketKey: string,
  leftId: string,
  rightId: string,
  astIds: Set<string>,
): boolean {
  return bucketKey.startsWith('path:') && astIds.has(leftId) && astIds.has(rightId);
}

function scorePair(left: IntentRecord, right: IntentRecord, index: Map<string, RecordKeywords>): PairEvidence {
  let score = 0;
  const basis: string[] = [];
  const leftKeywords = index.get(left.id);
  const rightKeywords = index.get(right.id);
  if (intersects(left.statement.target.tickets, right.statement.target.tickets)) {
    score += 0.62;
    basis.push('shared_ticket');
  }
  if (intersectsAliases(left.statement.target.symbols, right.statement.target.symbols, symbolAliases)) {
    score += 0.48;
    basis.push('shared_symbol');
  }
  if (intersectsAliases(left.statement.target.paths, right.statement.target.paths, pathAliases)) {
    score += 0.28;
    basis.push('shared_path');
  }
  if (left.statement.action === right.statement.action && left.statement.action !== 'unknown') {
    score += 0.13;
    basis.push('same_action');
  }
  const objectSimilarity = leftKeywords && rightKeywords
    ? Math.max(
      jaccard(leftKeywords.object, rightKeywords.object),
      jaccard(leftKeywords.text, rightKeywords.text),
    )
    : 0;
  if (objectSimilarity >= 0.2) {
    score += objectSimilarity * 0.48;
    basis.push(`text_similarity:${objectSimilarity.toFixed(3)}`);
  }
  if (left.source.kind === right.source.kind) score -= 0.08;
  return { score: Math.max(0, score), basis: [...new Set(basis)].sort(), textScore: objectSimilarity };
}

function determineRelation(left: IntentRecord, right: IntentRecord, evidence: PairEvidence): DirectedRelation {
  // `scorePair` already computed this over the same two strings.
  const textScore = evidence.textScore;
  if (left.statement.polarity !== right.statement.polarity && textScore >= 0.45) {
    return { from: left, to: right, type: 'contradicts' };
  }
  if (left.source.kind === right.source.kind && textScore >= 0.82) {
    return { from: left, to: right, type: 'duplicates' };
  }
  const sourceRelation = relationForSourceKinds(left, right);
  if (sourceRelation) return sourceRelation;
  if (evidence.score >= 0.8) return { from: left, to: right, type: 'same_as' };
  return { from: left, to: right, type: 'related_to' };
}

function relationForSourceKinds(left: IntentRecord, right: IntentRecord): DirectedRelation | null {
  for (const rule of SOURCE_RELATION_RULES) {
    const relation = matchSourceRule(left, right, rule);
    if (relation) return relation;
  }
  return null;
}

function matchSourceRule(
  left: IntentRecord,
  right: IntentRecord,
  rule: SourceRelationRule,
): DirectedRelation | null {
  if (left.source.kind === rule.anchor && rule.others.has(right.source.kind)) {
    return orientRelation(left, right, rule);
  }
  if (right.source.kind === rule.anchor && rule.others.has(left.source.kind)) {
    return orientRelation(right, left, rule);
  }
  return null;
}

function orientRelation(
  anchor: IntentRecord,
  other: IntentRecord,
  rule: SourceRelationRule,
): DirectedRelation {
  return rule.anchorPosition === 'from'
    ? { from: anchor, to: other, type: rule.type }
    : { from: other, to: anchor, type: rule.type };
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
