import { createRelationId, graphFingerprint } from '../core/id.js';
import { assertIntentRecords } from '../core/schema.js';
import { keywords, topicKeywords } from '../core/text.js';
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
  topics: Set<string>;
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
    topics: new Set(topicKeywords(`${record.statement.object} ${record.statement.text}`)),
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
  const resolvableBasenames = indexResolvableBasenames(records);
  const relations: IntentRelation[] = [];

  for (const [leftId, rightId] of candidatePairs) {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) continue;
    const evidence = scorePair(left, right, keywordIndex, resolvableBasenames);
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
  const moduleAstIds = new Set<string>();
  const declarationAstIds = new Set<string>();
  const configurationIds = new Set<string>();
  for (const record of records) {
    if (record.source.kind === 'ast') {
      astIds.add(record.id);
      if (isFileAggregate(record)) moduleAstIds.add(record.id);
      if (record.statement.action === 'declare' && record.statement.target.symbols.length > 0) {
        declarationAstIds.add(record.id);
      }
    }
    if (record.source.kind === 'system') configurationIds.add(record.id);
    indexTargetBuckets(buckets, record);
    indexKeywordBuckets(buckets, record.id, keywordIndex.get(record.id)?.object);
    if (isModuleTopicSource(record)) {
      indexTopicBuckets(buckets, record.id, keywordIndex.get(record.id)?.topics);
    }
  }
  return pairsFromBuckets(buckets, astIds, moduleAstIds, declarationAstIds, configurationIds);
}

function isModuleTopicSource(record: IntentRecord): boolean {
  return record.statement.kind === 'module_fact'
    || record.source.kind === 'nl'
    || record.source.kind === 'todo'
    || record.source.kind === 'document';
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

function indexTopicBuckets(
  buckets: Map<string, string[]>,
  recordId: string,
  topics: Set<string> | undefined,
): void {
  for (const topic of [...(topics ?? [])].slice(0, 12)) {
    addToBucket(buckets, `topic:${topic}`, recordId);
  }
}

function addToBucket(buckets: Map<string, string[]>, key: string, recordId: string): void {
  const values = buckets.get(key);
  if (values) values.push(recordId);
  else buckets.set(key, [recordId]);
}

/**
 * Two configuration declarations sharing a key name are not evidence.
 *
 * Config records are uniform by construction: every one carries action
 * `configure` and a fragment of text such as `params:` or `version: 1`, so
 * `same_action` plus text similarity clears the threshold for almost any pair.
 * On an infrastructure repository 1 263 configuration records produced 28 896
 * mutual relations — 72% of the entire graph — restating only that YAML files
 * reuse key names. A shared ticket still connects them, because that names one
 * piece of work rather than a shared vocabulary.
 */
function isSuppressedConfigurationPair(
  bucketKey: string,
  leftId: string,
  rightId: string,
  configurationIds: Set<string>,
): boolean {
  if (bucketKey.startsWith('ticket:')) return false;
  return configurationIds.has(leftId) && configurationIds.has(rightId);
}

function pairsFromBuckets(
  buckets: Map<string, string[]>,
  astIds: Set<string>,
  moduleAstIds: Set<string>,
  declarationAstIds: Set<string>,
  configurationIds: Set<string>,
): Array<[string, string]> {
  const output = new Map<string, [string, string]>();
  for (const [bucketKey, ids] of buckets) {
    const limited = [...new Set(ids)].sort().slice(0, 300);
    for (let left = 0; left < limited.length; left += 1) {
      for (let right = left + 1; right < limited.length; right += 1) {
        const leftId = limited[left];
        const rightId = limited[right];
        if (!leftId || !rightId) continue;
        if (isSuppressedAstPair(bucketKey, leftId, rightId, astIds, moduleAstIds, declarationAstIds)) continue;
        if (isSuppressedConfigurationPair(bucketKey, leftId, rightId, configurationIds)) continue;
        output.set(`${leftId}|${rightId}`, [leftId, rightId]);
      }
    }
  }

  return [...output.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, pair]) => pair);
}

function isSuppressedAstPair(
  bucketKey: string,
  leftId: string,
  rightId: string,
  astIds: Set<string>,
  moduleAstIds: Set<string>,
  declarationAstIds: Set<string>,
): boolean {
  const leftAst = astIds.has(leftId);
  const rightAst = astIds.has(rightId);
  // AST details may relate only through an explicit shared symbol. Shared file
  // and generic keyword buckets otherwise create a quadratic graph of calls
  // within one module without adding plan/code evidence.
  if (leftAst && rightAst) {
    return !bucketKey.startsWith('symbol:')
      || !declarationAstIds.has(leftId)
      || !declarationAstIds.has(rightId);
  }
  if (!bucketKey.startsWith('path:')) return false;
  // A file-level declaration links to one module aggregate, not every call and
  // symbol extracted from that file. Exact symbol and semantic token matches
  // remain available through their stronger buckets.
  const astId = leftAst ? leftId : rightAst ? rightId : null;
  return astId !== null && !moduleAstIds.has(astId);
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
): PairEvidence {
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
  if (pathsIntersect(left.statement.target.paths, right.statement.target.paths, resolvableBasenames)) {
    score += 0.28;
    basis.push('shared_path');
    if (isFileAggregateEvidencePair(left, right)) {
      score += 0.24;
      basis.push('module_coverage');
    }
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
  if (isModuleTopicEvidencePair(left, right) && leftKeywords && rightKeywords) {
    const sharedTopics = intersectionSize(leftKeywords.topics, rightKeywords.topics);
    // Two generic words still connected one declaration to dozens of modules
    // in the measured repository. Three independently normalised topics keeps
    // prose-only matching useful while retaining a precision-oriented floor.
    if (sharedTopics >= 3) {
      score += Math.min(0.64, 0.32 + sharedTopics * 0.08);
      basis.push(`module_topic:${sharedTopics}`);
    }
  }
  if (left.source.kind === right.source.kind) score -= 0.08;
  return { score: Math.max(0, score), basis: [...new Set(basis)].sort(), textScore: objectSimilarity };
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
function isFileAggregate(record: IntentRecord): boolean {
  return record.statement.kind === 'module_fact'
    || record.statement.kind === 'configuration_file_fact';
}

function isFileAggregateEvidencePair(left: IntentRecord, right: IntentRecord): boolean {
  return left.source.kind !== right.source.kind
    && (isFileAggregate(left) || isFileAggregate(right));
}

/** Capability-topic matching is intentionally narrower than exact file evidence. */
function isModuleTopicEvidencePair(left: IntentRecord, right: IntentRecord): boolean {
  return left.source.kind !== right.source.kind
    && (left.statement.kind === 'module_fact' || right.statement.kind === 'module_fact');
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
