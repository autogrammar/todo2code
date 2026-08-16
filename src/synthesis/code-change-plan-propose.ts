import { existsSync } from 'node:fs';
import path from 'node:path';
import { createCodeChangePlanHash, createCodeChangePlanId } from '../core/id.js';
import {
  assertCodeChangePlans,
  assertConclusions,
  assertIntentGraph,
} from '../core/schema.js';
import type {
  CodeChangeFile,
  CodeChangeFileAction,
  CodeChangePlan,
  Conclusion,
  Diagnostic,
  IntentRecord,
  IntentTarget,
  TodoPriority,
  TodoProposal,
} from '../core/types.js';
import { normalizeTarget } from '../core/target.js';
import { isUsefulCodeChangePath } from './code-change-path.js';
import {
  deterministicGeneration,
  IMPLEMENTATION_DIAGNOSTIC_CODES,
  uniqueSorted,
} from './code-change-plan-helpers.js';
import type { ProposeCodeChangePlansOptions, ProposeCodeChangePlansResult } from './code-change-plan-types.js';

export function proposeCodeChangePlans(
  options: ProposeCodeChangePlansOptions,
): ProposeCodeChangePlansResult {
  // #lizard forgives
  assertIntentGraph(options.graph);
  assertConclusions([], { graph: options.graph, diagnostics: options.diagnostics });
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('generatedAt must be an ISO date-time');
  const maxPlans = options.maxPlans ?? 50;
  if (!Number.isInteger(maxPlans) || maxPlans < 1 || maxPlans > 500) {
    throw new Error('maxPlans must be an integer between 1 and 500');
  }

  const conclusions = options.conclusions ?? [];
  const proposals = options.proposals ?? [];
  const recordsById = new Map(options.graph.records.map((record) => [record.id, record]));
  const proposalsByDiagnostic = indexProposalsByDiagnostic(proposals);
  const conclusionsByDiagnostic = indexConclusionsByDiagnostic(conclusions);

  const candidates = options.diagnostics.diagnostics
    .filter((diagnostic) => IMPLEMENTATION_DIAGNOSTIC_CODES.has(diagnostic.code))
    .sort((left, right) => implementationDiagnosticRank(left)
      - implementationDiagnosticRank(right) || left.id.localeCompare(right.id));

  const plans: CodeChangePlan[] = [];
  for (const diagnostic of candidates) {
    if (plans.length >= maxPlans) break;
    const relatedRecords = diagnostic.recordIds
      .map((id) => recordsById.get(id))
      .filter((record): record is IntentRecord => Boolean(record));
    if (!relatedRecords.length) continue;

    const matchingProposals = proposalsByDiagnostic.get(diagnostic.id) ?? [];
    const matchingConclusions = conclusionsByDiagnostic.get(diagnostic.id) ?? [];
    const target = collectTarget(relatedRecords, matchingProposals);
    const changes = buildChanges(target, relatedRecords, diagnostic, options.pathExists);
    if (!changes.length) continue;

    const generation = deterministicGeneration(generatedAt, 't2c/code-change-plan');
    const evidence = {
      graphFingerprint: options.graph.fingerprint,
      recordIds: uniqueSorted(relatedRecords.map((record) => record.id)),
      diagnosticIds: [diagnostic.id],
      conclusionIds: uniqueSorted(matchingConclusions.map((item) => item.id)),
      proposalIds: uniqueSorted(matchingProposals.map((item) => item.id)),
    };
    const semantic = {
      title: titleFor(diagnostic, relatedRecords),
      description: descriptionFor(diagnostic, relatedRecords, target),
      priority: priorityFor(diagnostic),
      target,
      acceptanceCriteria: acceptanceCriteriaFor(diagnostic, target),
      changes,
      risk: riskFor(diagnostic, changes),
      rollback: rollbackFor(changes),
      evidence,
    };
    const planHash = createCodeChangePlanHash(semantic);
    const plan: CodeChangePlan = {
      schemaVersion: 't2c.code-change-plan/v1',
      id: createCodeChangePlanId(semantic),
      planHash,
      status: 'proposed',
      createdAt: generatedAt,
      ...semantic,
      confidence: confidenceFor(diagnostic, matchingProposals),
      generation,
    };
    plans.push(plan);
  }

  assertCodeChangePlans(plans, {
    graph: options.graph,
    diagnostics: options.diagnostics,
    conclusions,
    proposals,
  });

  return {
    schemaVersion: 't2c.code-change-plan-set/v1',
    plans,
    generatedAt,
    graphFingerprint: options.graph.fingerprint,
    sourceDiagnosticCount: candidates.length,
    generation: deterministicGeneration(generatedAt, 't2c/code-change-plan-set'),
  };
}

/**
 * Build the repository probe for {@link ProposeCodeChangePlansOptions.pathExists}.
 *
 * A path that escapes the analysed root is reported as existing, so an unusual
 * value degrades to today's conservative `modify` instead of instructing an
 * executor to create a file outside the repository.
 */
export function createRepositoryPathProbe(root: string): (relativePath: string) => boolean {
  const base = path.resolve(root);
  return (relativePath: string): boolean => {
    const absolute = path.resolve(base, relativePath);
    if (absolute !== base && !absolute.startsWith(base + path.sep)) return true;
    return existsSync(absolute);
  };
}

function implementationDiagnosticRank(diagnostic: Diagnostic): number {
  return diagnostic.code === 'PLANNED_NOT_IMPLEMENTED' ? 0 : 1;
}

function indexProposalsByDiagnostic(proposals: TodoProposal[]): Map<string, TodoProposal[]> {
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

function indexConclusionsByDiagnostic(conclusions: Conclusion[]): Map<string, Conclusion[]> {
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

function collectTarget(records: IntentRecord[], proposals: TodoProposal[]): IntentTarget {
  const paths = new Set<string>();
  const symbols = new Set<string>();
  const tickets = new Set<string>();
  const versions = new Set<string>();
  for (const record of records) {
    for (const path of record.statement.target.paths) paths.add(path);
    for (const symbol of record.statement.target.symbols) symbols.add(symbol);
    for (const ticket of record.statement.target.tickets) tickets.add(ticket);
    for (const version of record.statement.target.versions) versions.add(version);
  }
  for (const proposal of proposals) {
    for (const path of proposal.target.paths) paths.add(path);
    for (const symbol of proposal.target.symbols) symbols.add(symbol);
    for (const ticket of proposal.target.tickets) tickets.add(ticket);
    for (const version of proposal.target.versions) versions.add(version);
  }
  return normalizeTarget({
    paths: [...paths].filter(isUsefulCodeChangePath),
    symbols: [...symbols],
    tickets: [...tickets],
    versions: [...versions],
  });
}

function buildChanges(
  target: IntentTarget,
  records: IntentRecord[],
  diagnostic: Diagnostic,
  pathExistsInRepository?: (relativePath: string) => boolean,
): CodeChangeFile[] {
  const symbols = uniqueSorted(target.symbols);
  const sourceIntents = uniqueSorted(records.map((record) => record.statement.text));
  const rationale = sourceIntents.length
    ? `Implement the source intent: ${sourceIntents.join(' | ')}`
    : diagnostic.detail || `Address ${diagnostic.code}.`;

  if (target.paths.length) {
    const changes: CodeChangeFile[] = [];
    for (const declared of uniqueSorted(target.paths)) {
      const normalized = declared.replace(/\\/g, '/');
      const exists = pathExistsInRepository?.(normalized);
      if (exists === false && !normalized.includes('/')) continue;
      const action: CodeChangeFileAction = exists === false ? 'create' : 'modify';
      changes.push({ path: normalized, action, symbols, rationale });
    }
    return changes;
  }

  return [];
}

function titleFor(diagnostic: Diagnostic, records: IntentRecord[]): string {
  const record = records[0];
  const object = record?.statement.object?.trim();
  if (object && startsWithImperative(object) && record?.statement.text.trim()) {
    return record.statement.text.trim().replace(/[.!?]+$/, '');
  }
  if (object) return `Implement ${object}`;
  return diagnostic.title.trim() || `Resolve ${diagnostic.code}`;
}

function startsWithImperative(value: string): boolean {
  return /^(?:add|build|change|configure|create|delete|document|fix|implement|preserve|refactor|remove|test|update|validate|verify)\b/i.test(value)
    || /^(?:dodać|dodac|naprawić|naprawic|przetestować|przetestowac|usunąć|usunac|utworzyć|utworzyc|wdrożyć|wdrozyc|zmienić|zmienic|zweryfikować|zweryfikowac)\b/i.test(value);
}

function descriptionFor(
  diagnostic: Diagnostic,
  records: IntentRecord[],
  target: IntentTarget,
): string {
  const parts = [
    diagnostic.detail.trim(),
    records[0] ? `Source intent: ${records[0].statement.text.trim()}` : '',
    target.paths.length ? `Paths: ${target.paths.join(', ')}.` : '',
    target.symbols.length ? `Symbols: ${target.symbols.join(', ')}.` : '',
    target.tickets.length ? `Tickets: ${target.tickets.join(', ')}.` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

function acceptanceCriteriaFor(diagnostic: Diagnostic, target: IntentTarget): string[] {
  const criteria = [
    `Re-run todo2code link+diagnose and clear diagnostic ${diagnostic.id} (${diagnostic.code}).`,
    'Do not introduce new blocking diagnostics.',
  ];
  if (target.paths.length) {
    criteria.push(`Touch only the declared paths: ${uniqueSorted(target.paths).join(', ')}.`);
  }
  if (target.symbols.length) {
    criteria.push(`Provide AST evidence for symbols: ${uniqueSorted(target.symbols).join(', ')}.`);
  }
  return uniqueSorted(criteria);
}

function priorityFor(diagnostic: Diagnostic): TodoPriority {
  if (diagnostic.severity === 'blocking') return 'P0';
  if (diagnostic.severity === 'review_required') return 'P1';
  if (diagnostic.severity === 'warning') return 'P2';
  return 'P3';
}

function confidenceFor(diagnostic: Diagnostic, proposals: TodoProposal[]): number {
  if (proposals.length) {
    return Math.min(0.92, Math.max(...proposals.map((item) => item.confidence)));
  }
  if (diagnostic.severity === 'blocking') return 0.88;
  if (diagnostic.severity === 'review_required') return 0.8;
  return 0.72;
}

function riskFor(diagnostic: Diagnostic, changes: CodeChangeFile[]): CodeChangePlan['risk'] {
  const level = diagnostic.severity === 'blocking' ? 'high'
    : diagnostic.severity === 'review_required' ? 'medium'
      : 'low';
  const reasons = [
    `Derived from ${diagnostic.severity} diagnostic ${diagnostic.id}.`,
    `Touches ${changes.length} declared ${changes.length === 1 ? 'path' : 'paths'}.`,
  ];
  return { level, reasons: uniqueSorted(reasons) };
}

function rollbackFor(changes: CodeChangeFile[]): string {
  return `Revert the proposed changes to ${uniqueSorted(changes.map((item) => item.path)).join(', ')} and re-run todo2code diagnostics.`;
}
