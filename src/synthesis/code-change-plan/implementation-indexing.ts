import type { Conclusion, TodoProposal } from '../../core/types.js';

export function indexProposalsByDiagnostic(proposals: TodoProposal[]): Map<string, TodoProposal[]> {
  const index = new Map<string, TodoProposal[]>();
  for (const proposal of proposals) {
    for (const diagnosticId of proposal.diagnosticIds) {
      const list = index.get(diagnosticId) ?? [];
      list.push(proposal);
      index.set(diagnosticId, list);
    }
  }
  return index;
}

export function indexConclusionsByDiagnostic(conclusions: Conclusion[]): Map<string, Conclusion[]> {
  const index = new Map<string, Conclusion[]>();
  for (const conclusion of conclusions) {
    for (const diagnosticId of conclusion.diagnosticIds) {
      const list = index.get(diagnosticId) ?? [];
      list.push(conclusion);
      index.set(diagnosticId, list);
    }
  }
  return index;
}
