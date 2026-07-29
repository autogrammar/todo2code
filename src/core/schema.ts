import type { IntentGraph, IntentRecord } from './types.js';

export function assertIntentRecord(value: unknown): asserts value is IntentRecord {
  if (!value || typeof value !== 'object') throw new Error('Intent record must be an object');
  const record = value as Partial<IntentRecord>;
  if (record.schemaVersion !== 't2c.intent/v1') throw new Error('Unsupported intent schemaVersion');
  if (typeof record.id !== 'string' || !record.id) throw new Error('Intent record id is required');
  if (!record.statement || typeof record.statement.object !== 'string') throw new Error(`Intent ${record.id}: statement.object is required`);
  if (!record.source || typeof record.source.extractor !== 'string') throw new Error(`Intent ${record.id}: source.extractor is required`);
  const confidence = record.epistemic?.confidence;
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error(`Intent ${record.id}: confidence must be between 0 and 1`);
  }
}

export function assertIntentGraph(value: unknown): asserts value is IntentGraph {
  if (!value || typeof value !== 'object') throw new Error('Intent graph must be an object');
  const graph = value as Partial<IntentGraph>;
  if (graph.schemaVersion !== 't2c.graph/v1') throw new Error('Unsupported graph schemaVersion');
  if (!Array.isArray(graph.records) || !Array.isArray(graph.relations)) throw new Error('Graph records and relations are required');
  for (const record of graph.records) assertIntentRecord(record);
  const ids = new Set(graph.records.map((record) => record.id));
  for (const relation of graph.relations) {
    if (!ids.has(relation.from) || !ids.has(relation.to)) {
      throw new Error(`Relation ${relation.id} references unknown records`);
    }
  }
}
