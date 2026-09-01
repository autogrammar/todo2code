import { pathAliases, symbolAliases } from '../core/target.js';
import type { IntentRecord } from '../core/types.js';
import { aggregateCapabilityOverlap, isFileAggregate } from './capability-evidence.js';
import { hasResolvedNlAstSymbolPair, type SymbolResolutionIndex } from './symbol-resolution.js';
import { indexKeywords, intersectionSize, jaccard, type RecordKeywords } from './linker-keywords.js';

export interface PairEvidence {
  score: number;
  basis: string[];
  textScore: number;
}

export function indexResolvableBasenames(records: IntentRecord[]): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const record of records) {
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

function pathsIntersect(left: string[], right: string[], resolvable: Set<string>): boolean {
  const expand = (values: string[]): Set<string> => {
    const output = new Set<string>();
    for (const value of values) {
      const aliases = pathAliases(value);
      const full = aliases[0];
      if (full) output.add(full);
      for (const alias of aliases.slice(1)) {
        if (resolvable.has(alias)) output.add(alias);
      }
      if (full && !full.includes('/') && resolvable.has(full)) output.add(full);
    }
    return output;
  };
  const leftSet = expand(left);
  return [...expand(right)].some((value) => leftSet.has(value));
}

function intersects(left: string[], right: string[]): boolean {
  const set = new Set(left);
  return right.some((value) => set.has(value));
}

function intersectsAliases(left: string[], right: string[], aliases: (value: string) => string[]): boolean {
  const set = new Set(left.flatMap(aliases));
  return right.some((value) => aliases(value).some((alias) => set.has(alias)));
}

function isFileAggregateEvidencePair(left: IntentRecord, right: IntentRecord): boolean {
  return left.source.kind !== right.source.kind
    && (isFileAggregate(left) || isFileAggregate(right));
}

function isModuleTopicEvidencePair(left: IntentRecord, right: IntentRecord): boolean {
  return left.source.kind !== right.source.kind
    && (left.statement.kind === 'module_fact' || right.statement.kind === 'module_fact');
}

function scoreTargetEvidence(
  left: IntentRecord,
  right: IntentRecord,
  resolvableBasenames: Set<string>,
  symbolResolutionIndex: SymbolResolutionIndex,
): { score: number; basis: string[] } {
  let score = 0;
  const basis: string[] = [];
  if (intersects(left.statement.target.tickets, right.statement.target.tickets)) {
    score += 0.62;
    basis.push('shared_ticket');
  }
  const resolvedNlAstSymbol = hasResolvedNlAstSymbolPair(left, right, symbolResolutionIndex);
  if ((resolvedNlAstSymbol ?? intersectsAliases(left.statement.target.symbols, right.statement.target.symbols, symbolAliases))) {
    score += 0.48;
    basis.push('shared_symbol');
  }
  if (!pathsIntersect(left.statement.target.paths, right.statement.target.paths, resolvableBasenames)) {
    return { score, basis };
  }
  score += 0.28;
  basis.push('shared_path');
  if (isFileAggregateEvidencePair(left, right)) {
    score += 0.24;
    basis.push('module_coverage');
    const capabilityOverlap = aggregateCapabilityOverlap(left, right);
    if (capabilityOverlap > 0) basis.push(`capability_overlap:${capabilityOverlap}`);
  }
  return { score, basis };
}

export function scorePair(
  left: IntentRecord,
  right: IntentRecord,
  index: Map<string, RecordKeywords>,
  resolvableBasenames: Set<string>,
  symbolResolutionIndex: SymbolResolutionIndex,
): PairEvidence {
  const targetEvidence = scoreTargetEvidence(
    left,
    right,
    resolvableBasenames,
    symbolResolutionIndex,
  );
  let score = targetEvidence.score;
  const basis = [...targetEvidence.basis];
  const leftKeywords = index.get(left.id);
  const rightKeywords = index.get(right.id);
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
    if (sharedTopics >= 3) {
      score += Math.min(0.64, 0.32 + sharedTopics * 0.08);
      basis.push(`module_topic:${sharedTopics}`);
    }
  }
  if (left.source.kind === right.source.kind) score -= 0.08;
  return { score: Math.max(0, score), basis: [...new Set(basis)].sort(), textScore: objectSimilarity };
}
