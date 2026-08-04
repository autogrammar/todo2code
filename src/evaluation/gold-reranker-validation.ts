import type { GoldRerankerDecisionFixture } from './gold-types.js';

export function assertRerankerDecision(
  caseId: string,
  decision: GoldRerankerDecisionFixture,
  seenModules: Set<string>,
  recordLabels: Set<string>,
): void {
  if (!isKnownNonDeclarationModule(decision.module, recordLabels)) {
    throw new Error(`Gold reranker case ${caseId} references unknown module ${decision.module}`);
  }
  if (seenModules.has(decision.module)) {
    throw new Error(`Gold reranker case ${caseId} repeats module ${decision.module}`);
  }
  seenModules.add(decision.module);
  if (!isValidScoreTuple(decision.score, decision.confidence)) {
    throw new Error(`Gold reranker case ${caseId} has an invalid score or confidence`);
  }
  if (!hasGroundedDecisionText(decision.rationale, decision.declarationQuote, decision.moduleQuote)) {
    throw new Error(`Gold reranker case ${caseId} has blank grounded decision content`);
  }
}

function isKnownNonDeclarationModule(module: string, recordLabels: Set<string>): boolean {
  if (!recordLabels.has(module) || module === 'declaration') {
    return false;
  }
  return true;
}

function isValidScoreTuple(score: number, confidence: number): boolean {
  if (!Number.isFinite(score) || score < -1 || score > 1) return false;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return false;
  return true;
}

function hasGroundedDecisionText(rationale: string, declarationQuote: string, moduleQuote: string): boolean {
  return Boolean(rationale.trim()) && Boolean(declarationQuote.trim()) && Boolean(moduleQuote.trim());
}
