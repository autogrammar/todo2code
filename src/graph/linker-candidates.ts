import type { IntentRecord } from '../core/types.js';
import { keywords, topicKeywords } from '../core/text.js';
import { pathAliases, symbolAliases } from '../core/target.js';
import { isFileAggregate } from './capability-evidence.js';

export interface RecordKeywords {
  object: Set<string>;
  text: Set<string>;
  topics: Set<string>;
}

export function indexKeywords(records: IntentRecord[]): Map<string, RecordKeywords> {
  return new Map(records.map((record) => [record.id, {
    object: new Set(keywords(record.statement.object)),
    text: new Set(keywords(record.statement.text)),
    topics: new Set(topicKeywords(`${record.statement.object} ${record.statement.text}`)),
  }]));
}

export function collectCandidatePairs(
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

function isSuppressedConfigurationPair(
  bucketKey: string,
  leftId: string,
  rightId: string,
  configurationIds: Set<string>,
): boolean {
  if (bucketKey.startsWith('ticket:')) return false;
  return configurationIds.has(leftId) && configurationIds.has(rightId);
}
