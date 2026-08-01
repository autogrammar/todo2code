import { buildRecord } from '../../core/record.js';
import type { IntentRecord } from '../../core/types.js';
import type { AdapterFact } from './types.js';

export function adapterRecords(
  facts: AdapterFact[],
  extractor: string,
  basis: string,
  language: string,
): IntentRecord[] {
  const detailRecords = facts.map((fact) => buildRecord({
    kind: fact.kind,
    action: fact.action,
    subject: fact.subject,
    object: fact.object,
    target: { paths: [fact.path], symbols: fact.symbol ? [fact.symbol] : [] },
    modality: 'observed',
    text: `${fact.action} ${fact.object}`,
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: fact.path,
    sourceLines: { start: fact.lineStart, end: fact.lineEnd },
    symbol: fact.symbol,
    extractor,
    rawExcerpt: fact.excerpt,
    epistemicClass: 'fact',
    confidence: 1,
    basis: [basis],
    metadata: { language, llmUsed: false, ...fact.metadata },
  }));
  return [...moduleRecords(facts, extractor, basis, language), ...detailRecords];
}

function moduleRecords(
  facts: AdapterFact[],
  extractor: string,
  basis: string,
  language: string,
): IntentRecord[] {
  const byPath = new Map<string, AdapterFact[]>();
  for (const fact of facts) {
    const bucket = byPath.get(fact.path) ?? [];
    bucket.push(fact);
    byPath.set(fact.path, bucket);
  }
  return [...byPath.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([filePath, fileFacts]) => {
    const start = Math.min(...fileFacts.map((fact) => fact.lineStart));
    const end = Math.max(...fileFacts.map((fact) => fact.lineEnd));
    const capabilities = boundedCapabilities(fileFacts
      .filter((fact) => fact.action === 'declare' || fact.action === 'depend_on')
      // A constant detail describes why the assignment is evidence (for
      // example `named constant 50`), but repeating that generic phrase in
      // every module aggregate would link unrelated files that happen to use
      // the same value. Aggregates advertise the actual identifier instead.
      .map((fact) => typeof fact.metadata.constantName === 'string'
        ? fact.metadata.constantName
        : fact.object));
    return buildRecord({
      kind: 'module_fact',
      action: 'declare',
      object: filePath,
      target: { paths: [filePath], symbols: [] },
      modality: 'observed',
      text: moduleTopicText(filePath, capabilities),
      lifecycle: 'implemented',
      sourceKind: 'ast',
      sourcePath: filePath,
      sourceLines: { start, end },
      extractor,
      rawExcerpt: `${language} module ${filePath}`,
      epistemicClass: 'fact',
      confidence: 1,
      basis: [basis],
      metadata: {
        language,
        llmUsed: false,
        aggregate: 'module',
        factGranularity: 'file',
        factCount: fileFacts.length,
        capabilities,
      },
    });
  });
}

export function boundedCapabilities(values: Iterable<string>): string[] {
  return [...new Set(values)]
    .filter((value) => value.trim())
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 24);
}

export function moduleTopicText(filePath: string, capabilities: string[]): string {
  return capabilities.length
    ? `module ${filePath} capabilities ${capabilities.join(' ')}`
    : `module ${filePath}`;
}
