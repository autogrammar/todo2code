import { topicKeywords } from '../core/text.js';
import type { IntentRecord } from '../core/types.js';

/**
 * Mutation verbs and location nouns describe the edit envelope, not the
 * behaviour the repository is supposed to implement.
 *
 * They are removed only for deciding whether a declaration carries a
 * capability beyond its target path. Behavioural actions such as `validate`,
 * `test` and `configure` deliberately remain: finding a file is not proof that
 * the file validates, tests or configures the requested thing.
 */
const STRUCTURAL_TOPICS = new Set([
  'add', 'build', 'change', 'create', 'delete', 'drop', 'file', 'implement',
  'introduce', 'keep', 'maintain', 'module', 'path', 'preserve', 'refactor',
  'remove', 'restructure', 'update',
  // Normalised Polish edit-shell words observed in TODOs.
  'dodac', 'dodaj', 'plik', 'modul', 'usunac', 'usun', 'utworzyc', 'zmienic',
  'zaktualizowac', 'zaimplementowac', 'zbudowac',
]);

/** Semantic topics stated by a declaration, excluding its own location. */
export function declaredCapabilityTopics(record: IntentRecord): Set<string> {
  const topics = new Set(topicKeywords(`${record.statement.object} ${record.statement.text}`));
  const locationTopics = new Set(topicKeywords(record.statement.target.paths.join(' ')));
  for (const topic of locationTopics) topics.delete(topic);
  for (const topic of STRUCTURAL_TOPICS) topics.delete(topic);
  return topics;
}

/** Topics backed by facts extracted from a file aggregate. */
export function aggregateCapabilityTopics(record: IntentRecord): Set<string> {
  const values = Array.isArray(record.metadata.capabilities)
    ? record.metadata.capabilities.filter((item): item is string => typeof item === 'string')
    : [];
  return new Set(topicKeywords(values.join(' ')));
}

/**
 * Number of requested capability topics explicitly present in an aggregate's
 * extracted capability list. The file path itself is never part of the count.
 */
export function aggregateCapabilityOverlap(left: IntentRecord, right: IntentRecord): number {
  const aggregate = isFileAggregate(left) ? left : isFileAggregate(right) ? right : null;
  const declaration = aggregate === left ? right : aggregate === right ? left : null;
  if (!aggregate || !declaration || aggregate.source.kind === declaration.source.kind) return 0;
  const requested = declaredCapabilityTopics(declaration);
  const implemented = aggregateCapabilityTopics(aggregate);
  let overlap = 0;
  for (const topic of requested) if (implemented.has(topic)) overlap += 1;
  return overlap;
}

/** True when a declaration asks for behaviour beyond creating/naming a file. */
export function hasCapabilityClaim(record: IntentRecord): boolean {
  return declaredCapabilityTopics(record).size > 0;
}

export function isFileAggregate(record: IntentRecord): boolean {
  return record.statement.kind === 'module_fact'
    || record.statement.kind === 'configuration_file_fact';
}
