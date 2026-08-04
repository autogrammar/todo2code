import { normalizeTarget } from '../../core/target.js';
import { isUsefulCodeChangePath } from '../code-change-path.js';
import type { IntentRecord, IntentTarget, TodoProposal } from '../../core/types.js';

export function collectTarget(records: IntentRecord[], proposals: TodoProposal[]): IntentTarget {
  const target = collectTargetComponents(records, proposals);
  return finalizeTarget(target);
}

function collectTargetComponents(
  records: IntentRecord[],
  proposals: TodoProposal[],
): {
  paths: Set<string>;
  symbols: Set<string>;
  tickets: Set<string>;
  versions: Set<string>;
} {
  const paths = new Set<string>();
  const symbols = new Set<string>();
  const tickets = new Set<string>();
  const versions = new Set<string>();
  for (const source of records) {
    addTargetEntries(source.statement.target, paths, symbols, tickets, versions);
  }
  for (const proposal of proposals) {
    addTargetEntries(proposal.target, paths, symbols, tickets, versions);
  }
  return { paths, symbols, tickets, versions };
}

function addTargetEntries(
  target: IntentTarget,
  paths: Set<string>,
  symbols: Set<string>,
  tickets: Set<string>,
  versions: Set<string>,
): void {
  for (const value of target.paths) paths.add(value);
  for (const value of target.symbols) symbols.add(value);
  for (const value of target.tickets) tickets.add(value);
  for (const value of target.versions) versions.add(value);
}

function finalizeTarget(target: {
  paths: Set<string>;
  symbols: Set<string>;
  tickets: Set<string>;
  versions: Set<string>;
}): IntentTarget {
  const paths = [...target.paths].filter(isUsefulCodeChangePath);
  const symbols = [...target.symbols];
  const tickets = [...target.tickets];
  const versions = [...target.versions];
  return normalizeTarget({
    paths,
    symbols,
    tickets,
    versions,
  });
}
