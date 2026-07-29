import { assertTodoProposals, type TodoProposalValidationContext } from '../core/schema.js';
import type { IntentRecord, TodoPriority, TodoProposal } from '../core/types.js';

export interface TodoProposalDuplicate {
  proposalId: string;
  existingRecordIds: string[];
  basis: string[];
}

export interface TodoProposalValidationResult {
  orderedProposalIds: string[];
  newProposalIds: string[];
  duplicateProposalIds: string[];
  duplicates: TodoProposalDuplicate[];
}

export function validateAndClassifyTodoProposals(
  proposals: TodoProposal[],
  context: TodoProposalValidationContext,
): TodoProposalValidationResult {
  assertTodoProposals(proposals, context);
  const existing = context.graph.records.filter((record) => record.source.kind === 'todo');
  const duplicates = proposals
    .map((proposal) => duplicateEvidence(proposal, existing))
    .filter((value): value is TodoProposalDuplicate => Boolean(value))
    .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  const orderedProposalIds = dependencyFirstPriorityOrder(proposals);
  const duplicateProposalIds = duplicates.map((duplicate) => duplicate.proposalId);
  const duplicateIds = new Set(duplicateProposalIds);
  return {
    orderedProposalIds,
    newProposalIds: orderedProposalIds.filter((id) => !duplicateIds.has(id)),
    duplicateProposalIds,
    duplicates,
  };
}

function duplicateEvidence(proposal: TodoProposal, records: IntentRecord[]): TodoProposalDuplicate | null {
  const matches: Array<{ id: string; basis: string[] }> = [];
  const proposalWords = words(`${proposal.title} ${proposal.description}`);
  for (const record of records) {
    const basis: string[] = [];
    const target = record.statement.target;
    const sharedTicket = intersects(proposal.target.tickets, target.tickets);
    const sharedSymbol = intersects(proposal.target.symbols, target.symbols);
    const sharedPath = intersects(proposal.target.paths, target.paths);
    const similarity = jaccard(proposalWords, words(`${record.statement.object} ${record.statement.text}`));
    // A ticket commonly contains several distinct tasks, so the ticket alone
    // is never enough to suppress a proposal.
    if (sharedTicket && similarity >= 0.25) basis.push('shared_ticket_and_text');
    if (sharedSymbol && similarity >= 0.2) basis.push('shared_symbol_and_text');
    if (sharedPath && similarity >= 0.5) basis.push('shared_path_and_text');
    if (similarity >= 0.72) basis.push(`text_similarity:${similarity.toFixed(3)}`);
    if (basis.length) matches.push({ id: record.id, basis });
  }
  if (!matches.length) return null;
  return {
    proposalId: proposal.id,
    existingRecordIds: matches.map((match) => match.id).sort(),
    basis: [...new Set(matches.flatMap((match) => match.basis))].sort(),
  };
}

function dependencyFirstPriorityOrder(proposals: TodoProposal[]): string[] {
  const priority: Record<TodoPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const remainingDependencies = new Map(proposals.map((proposal) => [proposal.id, proposal.dependencies.length]));
  const dependents = new Map<string, string[]>();
  for (const proposal of proposals) {
    for (const dependency of proposal.dependencies) {
      const values = dependents.get(dependency);
      if (values) values.push(proposal.id);
      else dependents.set(dependency, [proposal.id]);
    }
  }
  const compare = (leftId: string, rightId: string): number => {
    const left = byId.get(leftId)!;
    const right = byId.get(rightId)!;
    return priority[left.priority] - priority[right.priority] || left.id.localeCompare(right.id);
  };
  const ready = proposals.filter((proposal) => proposal.dependencies.length === 0).map((proposal) => proposal.id).sort(compare);
  const ordered: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    ordered.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = (remainingDependencies.get(dependent) ?? 0) - 1;
      remainingDependencies.set(dependent, remaining);
      if (remaining === 0) {
        ready.push(dependent);
        ready.sort(compare);
      }
    }
  }
  if (ordered.length !== proposals.length) throw new Error('TODO proposal dependency graph contains a cycle');
  return ordered;
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) ?? []);
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const value of left) if (right.has(value)) common += 1;
  return common / (left.size + right.size - common);
}

function intersects(left: string[], right: string[]): boolean {
  const values = new Set(left.map((value) => value.toLowerCase()));
  return right.some((value) => values.has(value.toLowerCase()));
}
