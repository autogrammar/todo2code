import { normalizePath, symbolAliases } from '../core/target.js';
import type { IntentRecord } from '../core/types.js';

export interface AstSymbolCandidate {
  recordId: string;
  path: string;
  symbol: string;
}

export interface NlSymbolResolution {
  symbol: string;
  status: 'resolved' | 'ambiguous' | 'conflicting' | 'unresolved';
  candidates: AstSymbolCandidate[];
  paths: string[];
}

export interface SymbolResolutionIndex {
  byNlRecord: Map<string, NlSymbolResolution[]>;
}

/** Resolves explicit NL symbols only against observed AST declarations. */
export function buildSymbolResolutionIndex(records: IntentRecord[]): SymbolResolutionIndex {
  const byAlias = collectAstCandidates(records);
  sortCandidates(byAlias);
  return { byNlRecord: collectNlResolutions(records, byAlias) };
}

function collectAstCandidates(records: IntentRecord[]): Map<string, AstSymbolCandidate[]> {
  const byAlias = new Map<string, AstSymbolCandidate[]>();
  for (const record of records) {
    if (!isAstDeclaration(record) || !record.source.path) continue;
    for (const symbol of uniqueSymbols(record)) {
      const candidate = buildAstCandidate(record, symbol);
      for (const alias of symbolAliases(symbol)) {
        const values = byAlias.get(alias) ?? [];
        if (!values.some((value) => value.recordId === candidate.recordId)) values.push(candidate);
        byAlias.set(alias, values);
      }
    }
  }
  return byAlias;
}

function buildAstCandidate(record: IntentRecord, symbol: string): AstSymbolCandidate {
  return {
    recordId: record.id,
    path: normalizePath(record.source.path ?? ''),
    symbol,
  };
}

function uniqueSymbols(record: IntentRecord): string[] {
  return [...new Set([
    ...record.statement.target.symbols,
    ...(record.source.symbol ? [record.source.symbol] : []),
  ])];
}

function sortCandidates(byAlias: Map<string, AstSymbolCandidate[]>): void {
  for (const values of byAlias.values()) {
    values.sort((left, right) => left.path.localeCompare(right.path)
      || left.symbol.localeCompare(right.symbol)
      || left.recordId.localeCompare(right.recordId));
  }
}

function collectNlResolutions(
  records: IntentRecord[],
  byAlias: Map<string, AstSymbolCandidate[]>,
): Map<string, NlSymbolResolution[]> {
  const byNlRecord = new Map<string, NlSymbolResolution[]>();
  for (const record of records) {
    if (record.source.kind !== 'nl' || record.statement.target.symbols.length === 0) continue;
    byNlRecord.set(record.id, record.statement.target.symbols.map((symbol) => resolveSymbol(
      symbol,
      record.statement.target.paths,
      byAlias,
    )));
  }
  return byNlRecord;
}

/**
 * A shared NL↔AST symbol is evidence only when repository declarations resolve
 * it to one path (or an explicit NL path selects one of several owners).
 */
export function hasResolvedNlAstSymbolPair(
  left: IntentRecord,
  right: IntentRecord,
  index: SymbolResolutionIndex,
): boolean | null {
  const nl = left.source.kind === 'nl' ? left : right.source.kind === 'nl' ? right : null;
  const ast = left.source.kind === 'ast' ? left : right.source.kind === 'ast' ? right : null;
  if (!nl || !ast) return null;
  if (!isAstDeclaration(ast)) return false;
  return (index.byNlRecord.get(nl.id) ?? []).some((resolution) =>
    resolution.status === 'resolved'
    && resolution.candidates.some((candidate) => candidate.recordId === ast.id));
}

function resolveSymbol(
  symbol: string,
  requestedPaths: string[],
  byAlias: Map<string, AstSymbolCandidate[]>,
): NlSymbolResolution {
  let candidates: AstSymbolCandidate[] = [];
  // Aliases are ordered from the exact qualified symbol to its leaf. The first
  // repository match is therefore the strongest available interpretation.
  for (const alias of symbolAliases(symbol)) {
    const matched = byAlias.get(alias);
    if (matched?.length) {
      candidates = matched;
      break;
    }
  }
  if (candidates.length === 0) return { symbol, status: 'unresolved', candidates: [], paths: [] };

  if (requestedPaths.length > 0) {
    const selected = candidates.filter((candidate) => requestedPaths.some((value) => pathSelects(value, candidate.path)));
    if (selected.length === 0) {
      return { symbol, status: 'conflicting', candidates, paths: uniquePaths(candidates) };
    }
    candidates = selected;
  }

  const paths = uniquePaths(candidates);
  return { symbol, status: paths.length === 1 ? 'resolved' : 'ambiguous', candidates, paths };
}

function pathSelects(requested: string, candidate: string): boolean {
  const normalized = normalizePath(requested).toLowerCase();
  const candidatePath = normalizePath(candidate).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('/')) return normalized === candidatePath;
  return candidatePath.split('/').at(-1) === normalized;
}

function uniquePaths(candidates: AstSymbolCandidate[]): string[] {
  return [...new Set(candidates.map((candidate) => candidate.path))].sort();
}

function isAstDeclaration(record: IntentRecord): boolean {
  return record.source.kind === 'ast'
    && record.statement.action === 'declare'
    && record.statement.target.symbols.length > 0;
}
