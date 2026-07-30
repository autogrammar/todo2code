import { createCodeChangePlanHash, createCodeChangePlanId, sha256, stableStringify } from '../core/id.js';
import {
  assertCodeChangeAcceptance,
  assertCodeChangePlanForAcceptance,
  assertCodeChangePlans,
  assertCodeChangePlansForReview,
  assertConclusions,
  assertGroundedGenerationMetadata,
  assertIntentGraph,
} from '../core/schema.js';
import type {
  CodeChangeAcceptance,
  CodeChangeFile,
  CodeChangePlan,
  CodeChangeReviewPatch,
  Conclusion,
  Diagnostic,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentRecord,
  IntentTarget,
  TodoPriority,
  TodoProposal,
} from '../core/types.js';
import { normalizeTarget } from '../core/target.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { T2C_VERSION } from '../version.js';

const IMPLEMENTATION_DIAGNOSTIC_CODES = new Set([
  'PLANNED_NOT_IMPLEMENTED',
  'CHANGELOG_WITHOUT_IMPLEMENTATION',
]);

export interface ProposeCodeChangePlansOptions {
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
  conclusions?: Conclusion[];
  proposals?: TodoProposal[];
  generatedAt?: string;
  /** Limit how many plans are materialised from open diagnostics. Default 50. */
  maxPlans?: number;
}

export interface ProposeCodeChangePlansResult {
  schemaVersion: 't2c.code-change-plan-set/v1';
  plans: CodeChangePlan[];
  generatedAt: string;
  graphFingerprint: string;
  sourceDiagnosticCount: number;
  generation: GroundedGenerationMetadata;
}

export interface EvaluateCodeChangeAcceptanceOptions {
  plan: CodeChangePlan;
  /** Graph and diagnostics that the plan was grounded on. */
  before: { graph: IntentGraph; diagnostics: DiagnosticReport };
  /** Graph after an attempted implementation (re-extracted and re-linked). */
  afterGraph: IntentGraph;
  /** Optional precomputed after diagnostics; derived when omitted. */
  afterDiagnostics?: DiagnosticReport;
  evaluatedAt?: string;
}

/**
 * Build grounded code-change plans from open implementation diagnostics.
 *
 * One plan is produced per diagnostic that can name at least one target path
 * (from the diagnostic's records or a matching TODO proposal). The runtime
 * never invents file paths and never marks work complete.
 */
export function proposeCodeChangePlans(options: ProposeCodeChangePlansOptions): ProposeCodeChangePlansResult {
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
    .sort((left, right) => left.id.localeCompare(right.id));

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
    const changes = buildChanges(target, relatedRecords, diagnostic);
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
 * Re-diagnose an after graph and decide whether the plan's targeted
 * diagnostics cleared without introducing new blocking findings.
 *
 * Diagnostic IDs are content-bound, so a still-open finding on the same
 * records keeps the same ID. Cleared findings simply disappear.
 */
export function evaluateCodeChangeAcceptance(
  options: EvaluateCodeChangeAcceptanceOptions,
): CodeChangeAcceptance {
  assertIntentGraph(options.before.graph);
  assertIntentGraph(options.afterGraph);
  assertConclusions([], options.before);
  assertCodeChangePlanForAcceptance(options.plan, options.before);

  const afterDiagnostics = options.afterDiagnostics ?? diagnoseGraph(
    options.afterGraph,
    options.evaluatedAt ?? new Date().toISOString(),
  );
  assertConclusions([], { graph: options.afterGraph, diagnostics: afterDiagnostics });

  const beforeIds = new Set(options.before.diagnostics.diagnostics.map((item) => item.id));
  const afterById = new Map(afterDiagnostics.diagnostics.map((item) => [item.id, item]));
  const afterIds = [...afterById.keys()].sort();
  const targeted = options.plan.evidence.diagnosticIds;
  const clearedDiagnosticIds = targeted.filter((id) => !afterById.has(id)).sort();
  const remainingDiagnosticIds = targeted.filter((id) => afterById.has(id)).sort();
  const newBlockingDiagnosticIds = afterDiagnostics.diagnostics
    .filter((item) => item.severity === 'blocking' && !beforeIds.has(item.id))
    .map((item) => item.id)
    .sort();

  const reasons: string[] = [];
  if (remainingDiagnosticIds.length) {
    reasons.push(
      `Targeted diagnostics still open: ${remainingDiagnosticIds.join(', ')}.`,
    );
  } else {
    reasons.push('All targeted diagnostics cleared after re-analysis.');
  }
  if (newBlockingDiagnosticIds.length) {
    reasons.push(
      `New blocking diagnostics appeared: ${newBlockingDiagnosticIds.join(', ')}.`,
    );
  } else {
    reasons.push('No new blocking diagnostics appeared.');
  }

  const accepted = remainingDiagnosticIds.length === 0 && newBlockingDiagnosticIds.length === 0;
  if (accepted) {
    reasons.push('Acceptance gate passed; human approval is still required before DONE.');
  } else {
    reasons.push('Acceptance gate failed.');
  }

  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const acceptance: CodeChangeAcceptance = {
    schemaVersion: 't2c.code-change-acceptance/v1',
    planId: options.plan.id,
    planHash: options.plan.planHash,
    beforeGraphFingerprint: options.before.graph.fingerprint,
    afterGraphFingerprint: options.afterGraph.fingerprint,
    beforeDiagnosticIds: [...beforeIds].sort(),
    afterDiagnosticIds: afterIds,
    clearedDiagnosticIds,
    remainingDiagnosticIds,
    newBlockingDiagnosticIds,
    accepted,
    reasons: uniqueSorted(reasons),
    evaluatedAt,
    generation: deterministicGeneration(evaluatedAt, 't2c/code-change-acceptance'),
  };
  assertCodeChangeAcceptance(acceptance, {
    plan: options.plan,
    before: options.before,
    after: { graph: options.afterGraph, diagnostics: afterDiagnostics },
  });
  return acceptance;
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
    paths: [...paths].filter(isPlannablePath),
    symbols: [...symbols],
    tickets: [...tickets],
    versions: [...versions],
  });
}

/**
 * A plan may only name a file inside the analysed repository.
 *
 * Extraction is the first line of defence, but records also arrive from
 * hand-written TODO items and from the LLM. One unusable value must degrade to
 * "this plan names fewer paths", never to a crashed pipeline: on an external
 * platform repository an absolute host path aborted the whole run at the
 * contract boundary, after every earlier stage had already succeeded.
 */
function isPlannablePath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, '/');
  return Boolean(normalized) && !normalized.startsWith('/') && !normalized.split('/').includes('..');
}

function buildChanges(
  target: IntentTarget,
  records: IntentRecord[],
  diagnostic: Diagnostic,
): CodeChangeFile[] {
  const symbols = uniqueSorted(target.symbols);
  const rationale = diagnostic.suggestedAction?.trim()
    || diagnostic.detail
    || `Address ${diagnostic.code} for ${records.map((record) => record.statement.object).join(', ')}.`;

  if (target.paths.length) {
    return uniqueSorted(target.paths).map((path) => ({
      path: path.replace(/\\/g, '/'),
      action: 'modify' as const,
      symbols,
      rationale,
    }));
  }

  // Without a path the plan cannot safely name a source file. Skip rather than invent.
  return [];
}

function titleFor(diagnostic: Diagnostic, records: IntentRecord[]): string {
  const object = records[0]?.statement.object?.trim();
  if (object) return `Implement ${object}`;
  return diagnostic.title.trim() || `Resolve ${diagnostic.code}`;
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

function deterministicGeneration(generatedAt: string, generator: string): GroundedGenerationMetadata {
  return {
    generator,
    generatorVersion: '1',
    runtimeVersion: T2C_VERSION,
    generatedAt,
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    model: null,
    provider: null,
    responseId: null,
    configurationFingerprint: sha256(stableStringify({
      generator,
      generatorVersion: '1',
      codes: [...IMPLEMENTATION_DIAGNOSTIC_CODES].sort(),
    })),
    reason: null,
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort();
}

export interface CreateCodeChangeReviewOptions {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  createdAt?: string;
}

export interface CreatedCodeChangeReview {
  markdown: string;
  artifact: CodeChangeReviewPatch;
}

/**
 * Render a stable, reviewable Markdown brief for grounded code-change plans.
 *
 * This is not a source patch and is never applied to the tree. It exists so
 * humans and agents share one hash-bound artifact that lists exact paths,
 * acceptance criteria, evidence IDs, risk and rollback instructions.
 */
export function createCodeChangeReviewPatch(
  options: CreateCodeChangeReviewOptions,
): CreatedCodeChangeReview {
  if (typeof options.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(options.graphFingerprint)) {
    throw new Error('graphFingerprint must be a SHA-256 hex digest');
  }
  assertCodeChangePlansForReview(options.plans, options.graphFingerprint);
  const plans = [...options.plans].sort((left, right) =>
    priorityRank(left.priority) - priorityRank(right.priority) || left.id.localeCompare(right.id));
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('createdAt must be an ISO date-time');
  const markdown = renderCodeChangeReviewMarkdown(plans, options.graphFingerprint);
  const artifact: CodeChangeReviewPatch = {
    schemaVersion: 't2c.code-change-review/v1',
    createdAt,
    graphFingerprint: options.graphFingerprint,
    planIds: plans.map((plan) => plan.id),
    planHashes: plans.map((plan) => plan.planHash),
    renderedPatchHash: sha256(markdown),
    generation: deterministicGeneration(createdAt, 't2c/code-change-review'),
  };
  assertCodeChangeReviewPatch(artifact);
  return { markdown, artifact };
}

export function renderCodeChangeReviewMarkdown(
  plans: CodeChangePlan[],
  graphFingerprint: string,
): string {
  const lines = [
    '<!-- t2c.code-change-review/v1 -->',
    '# todo2code proposed code changes',
    '',
    'This document is a grounded **review brief**, not an auto-applied source patch.',
    'Implement the listed paths in a normal branch, re-run the pipeline, then',
    '`t2c evaluate-code-change`. Acceptance still requires human/CI approval before DONE.',
    '',
    `Graph fingerprint: \`${graphFingerprint}\``,
    '',
  ];
  if (!plans.length) {
    lines.push('_No grounded code-change plans. Open diagnostics either cleared or lack repository paths._', '');
    return lines.join('\n');
  }
  let currentPriority: CodeChangePlan['priority'] | null = null;
  for (const plan of plans) {
    if (plan.priority !== currentPriority) {
      if (currentPriority !== null) lines.push('');
      currentPriority = plan.priority;
      lines.push(`## ${plan.priority}`, '');
    }
    lines.push(`### ${inline(plan.title)} (\`${plan.id}\`)`, '');
    lines.push(`- Plan hash: \`${plan.planHash}\``);
    lines.push(`- Risk: **${plan.risk.level}** — ${plan.risk.reasons.map(inline).join('; ')}`);
    lines.push(`- Confidence: ${plan.confidence.toFixed(2)}`);
    lines.push(`- Description: ${inline(plan.description)}`);
    lines.push('- Changes:');
    for (const change of plan.changes) {
      const symbols = change.symbols.length ? ` symbols: ${change.symbols.map((item) => `\`${item}\``).join(', ')}` : '';
      lines.push(`  - \`${change.action}\` \`${change.path}\`${symbols}`);
      lines.push(`    - ${inline(change.rationale)}`);
    }
    lines.push('- Acceptance criteria:');
    for (const criterion of plan.acceptanceCriteria) lines.push(`  - [ ] ${inline(criterion)}`);
    lines.push(`- Diagnostics: ${renderIds(plan.evidence.diagnosticIds)}`);
    lines.push(`- Evidence records: ${renderIds(plan.evidence.recordIds)}`);
    if (plan.evidence.proposalIds.length) lines.push(`- TODO proposals: ${renderIds(plan.evidence.proposalIds)}`);
    if (plan.evidence.conclusionIds.length) lines.push(`- Conclusions: ${renderIds(plan.evidence.conclusionIds)}`);
    lines.push(`- Rollback: ${inline(plan.rollback)}`);
    lines.push('');
  }
  lines.push('## After implementation', '');
  lines.push('1. Re-run `t2c pipeline` (or extract + link + diagnose) on the changed tree.');
  lines.push('2. `t2c evaluate-code-change <plan.json> --before-graph … --after-graph … --out acceptance.json`.');
  lines.push('3. Require `accepted=true` and human/CI review before marking work DONE.');
  lines.push('');
  return lines.join('\n');
}

export function assertCodeChangeReviewPatch(value: unknown): asserts value is CodeChangeReviewPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change review patch must be an object');
  }
  const artifact = value as Record<string, unknown>;
  const required = [
    'schemaVersion', 'createdAt', 'graphFingerprint', 'planIds', 'planHashes',
    'renderedPatchHash', 'generation',
  ];
  for (const key of required) {
    if (!(key in artifact)) throw new Error(`Code change review patch is missing: ${key}`);
  }
  if (artifact.schemaVersion !== 't2c.code-change-review/v1') {
    throw new Error('Unsupported code change review schemaVersion');
  }
  if (typeof artifact.createdAt !== 'string' || Number.isNaN(Date.parse(artifact.createdAt))) {
    throw new Error('Code change review createdAt must be an ISO date-time');
  }
  if (typeof artifact.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.graphFingerprint)) {
    throw new Error('Code change review graphFingerprint must be SHA-256');
  }
  if (typeof artifact.renderedPatchHash !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.renderedPatchHash)) {
    throw new Error('Code change review renderedPatchHash must be SHA-256');
  }
  if (!Array.isArray(artifact.planIds) || !artifact.planIds.every((id) => typeof id === 'string' && /^CPLAN-[a-f0-9]{20}$/.test(id))) {
    throw new Error('Code change review planIds must be CPLAN ids');
  }
  if (!Array.isArray(artifact.planHashes) || !artifact.planHashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) {
    throw new Error('Code change review planHashes must be SHA-256 digests');
  }
  if (artifact.planIds.length !== artifact.planHashes.length) {
    throw new Error('Code change review planIds and planHashes must have equal length');
  }
  if (new Set(artifact.planIds as string[]).size !== (artifact.planIds as string[]).length) {
    throw new Error('Code change review planIds must be unique');
  }
  assertGroundedGenerationMetadata(artifact.generation, 'Code change review generation');
  const generation = artifact.generation as GroundedGenerationMetadata;
  if (generation.generatedAt !== artifact.createdAt) {
    throw new Error('Code change review generation.generatedAt must match createdAt');
  }
  if (generation.generator !== 't2c/code-change-review') {
    throw new Error('Code change review generation.generator must be t2c/code-change-review');
  }
}

function priorityRank(priority: TodoPriority): number {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 } as const)[priority];
}

function inline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderIds(ids: string[]): string {
  return ids.length ? ids.map((id) => `\`${id}\``).join(', ') : '_none_';
}
