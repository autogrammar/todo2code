import { createRelationId, graphFingerprint } from '../core/id.js';
import { assertIntentRecords } from '../core/schema.js';
import type { IntentGraph, IntentRecord, IntentRelation } from '../core/types.js';
import { buildSymbolResolutionIndex } from './symbol-resolution.js';
import { collectCandidatePairs } from './linker-candidates.js';
import { determineRelation } from './linker-relations.js';
import { indexResolvableBasenames, scorePair } from './linker-scoring.js';
import { indexKeywords } from './linker-keywords.js';

export function linkIntentRecords(inputRecords: IntentRecord[], generatedAt = new Date().toISOString()): IntentGraph {
  assertIntentRecords(inputRecords);
  const records = deduplicateRecords(inputRecords).sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(records.map((record) => [record.id, record]));
  const keywordIndex = indexKeywords(records);
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

function countBy(records: IntentRecord[], selector: (record: IntentRecord) => string): Record<string, number> {
  const output: Record<string, number> = {};
  for (const record of records) {
    const key = selector(record);
    output[key] = (output[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}
