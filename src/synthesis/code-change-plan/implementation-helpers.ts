import { randomUUID } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createCodeChangePlanHash,
  createCodeChangePlanId,
  createCodeChangeSourcePatchHash,
  createCodeChangeSourcePatchId,
  sha256,
  stableStringify,
} from '../../core/id.js';
import { ensureDir, pathExists, readJson, readText } from '../../core/io.js';
import { assertPathWithinRoot } from '../../core/security.js';
import {
  assertCodeChangeAcceptance,
  assertCodeChangePlanForAcceptance,
  assertCodeChangePlans,
  assertCodeChangePlansForReview,
  assertConclusions,
  assertGroundedGenerationMetadata,
  assertIntentGraph,
} from '../../core/schema.js';
import type {
  CodeChangeAcceptance,
  CodeChangeCloseResult,
  CodeChangeFile,
  CodeChangeFileAction,
  CodeChangePlan,
  CodeChangeReviewPatch,
  CodeChangeSourceApplyReceipt,
  CodeChangeSourceEdit,
  CodeChangeSourcePatch,
  CodeChangeSourcePatchApproval,
  CodeChangeSourcePatchSet,
  Conclusion,
  Diagnostic,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentRecord,
  IntentTarget,
  TodoPriority,
  TodoProposal,
} from '../../core/types.js';
import { normalizeTarget } from '../../core/target.js';
import { diagnoseGraph } from '../../graph/diagnostics.js';
import { T2C_VERSION } from '../../version.js';
import { isUsefulCodeChangePath } from '../code-change-path.js';

export { isUsefulCodeChangePath } from '../code-change-path.js';

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
  /**
   * Repository probe used to tell `create` from `modify`. Injected rather than
   * read here so plan synthesis stays pure and deterministic; when omitted the
   * plan cannot know and keeps the conservative `modify`.
   * See {@link createRepositoryPathProbe}.
   */
  pathExists?: (relativePath: string) => boolean;
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

export interface CloseCodeChangesOptions {
  plans: CodeChangePlan[];
  before: { graph: IntentGraph; diagnostics: DiagnosticReport };
  afterGraph: IntentGraph;
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
    // A released CHANGELOG entry is an audit signal; an open TODO is an
    // explicit request for work.  With a bounded plan set, sorting only by
    // content id allowed historical release notes to consume every slot and
    // hide the repository's actual backlog from autonomous executors.
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

/** Evaluate a plan set under one timestamp without applying changes or marking DONE. */
export function closeCodeChanges(options: CloseCodeChangesOptions): CodeChangeCloseResult {
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(evaluatedAt))) throw new Error('evaluatedAt must be an ISO date-time');
  assertIntentGraph(options.before.graph);
  assertIntentGraph(options.afterGraph);
  assertConclusions([], options.before);
  const afterDiagnostics = options.afterDiagnostics ?? diagnoseGraph(options.afterGraph, evaluatedAt);
  assertConclusions([], { graph: options.afterGraph, diagnostics: afterDiagnostics });
  const planIds = options.plans.map((plan) => plan.id);
  if (new Set(planIds).size !== planIds.length) throw new Error('Code change close plans must have unique ids');

  const acceptances = options.plans.map((plan) => evaluateCodeChangeAcceptance({
    plan,
    before: options.before,
    afterGraph: options.afterGraph,
    afterDiagnostics,
    evaluatedAt,
  }));
  const acceptedCount = acceptances.filter((item) => item.accepted).length;
  return {
    schemaVersion: 't2c.code-change-close-result/v1',
    evaluatedAt,
    graphFingerprintBefore: options.before.graph.fingerprint,
    graphFingerprintAfter: options.afterGraph.fingerprint,
    planCount: options.plans.length,
    acceptedCount,
    rejectedCount: options.plans.length - acceptedCount,
    allAccepted: options.plans.length > 0 && acceptedCount === options.plans.length,
    acceptances,
    generation: deterministicGeneration(evaluatedAt, 't2c/code-change-close-result'),
  };
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
  // The diagnostic explains why evidence is missing; it is not necessarily an
  // implementation instruction. Reusing its generic remediation here produced
  // contradictory tickets such as “replace magic number 50” followed by
  // “provide a missing function”. The lossless source declaration is the work
  // to perform, while the diagnostic remains available in the plan evidence.
  const sourceIntents = uniqueSorted(records.map((record) => record.statement.text));
  const rationale = sourceIntents.length
    ? `Implement the source intent: ${sourceIntents.join(' | ')}`
    : diagnostic.detail || `Address ${diagnostic.code}.`;

  if (target.paths.length) {
    const changes: CodeChangeFile[] = [];
    for (const declared of uniqueSorted(target.paths)) {
      const normalized = declared.replace(/\\/g, '/');
      const exists = pathExistsInRepository?.(normalized);
      // A path without a directory is shorthand that never said *where* the
      // file belongs. Creating one at the repository root invents a location:
      // measured across seven foreign repositories this proposed `__init__.py`
      // beside 22 real ones, `pyproject.toml` beside 32, and files named after
      // prose fragments such as `it.md`. The diagnostic still reports the gap;
      // only the invented instruction is withheld.
      if (exists === false && !normalized.includes('/')) continue;
      // Documentation routinely plans files that do not exist yet (a target
      // repository's `docs/ARCHITECTURE.md`). Telling an executor to modify
      // them is an instruction it cannot follow, and `apply-source-patch`
      // rejects a create edit whose target already exists, so the two actions
      // must not be guessed.
      const action: CodeChangeFileAction = exists === false ? 'create' : 'modify';
      changes.push({ path: normalized, action, symbols, rationale });
    }
    return changes;
  }

  // Without a path the plan cannot safely name a source file. Skip rather than invent.
  return [];
}

function titleFor(diagnostic: Diagnostic, records: IntentRecord[]): string {
  const record = records[0];
  const object = record?.statement.object?.trim();
  // `inferObject` removes the verb selected by the action classifier. In a
  // compound sentence a later high-precedence verb can win (`verify` before
  // `implement`), leaving the original leading imperative inside `object` and
  // a broken fragment after the removed verb. The source statement is the
  // lossless title whenever that mismatch is visible.
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
  const artifact = assertSourcePatchObject(value, 'Code change review patch must be an object');
  validateReviewPatchKeys(artifact);
  assertCodeChangeReviewPatchSchema(artifact);
  assertCodeChangeReviewPatchPlanCollections(artifact);
  assertCodeChangeReviewPatchGeneration(artifact);
}

function validateReviewPatchKeys(artifact: Record<string, unknown>): void {
  const required = [
    'schemaVersion', 'createdAt', 'graphFingerprint', 'planIds', 'planHashes',
    'renderedPatchHash', 'generation',
  ];
  for (const key of required) {
    if (!(key in artifact)) throw new Error(`Code change review patch is missing: ${key}`);
  }
}

function assertCodeChangeReviewPatchSchema(artifact: Record<string, unknown>): void {
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
}

function assertCodeChangeReviewPatchPlanCollections(artifact: Record<string, unknown>): void {
  if (artifact.planIds.length !== artifact.planHashes.length) {
    throw new Error('Code change review planIds and planHashes must have equal length');
  }
  if (new Set(artifact.planIds as string[]).size !== (artifact.planIds as string[]).length) {
    throw new Error('Code change review planIds must be unique');
  }
}

function assertCodeChangeReviewPatchGeneration(artifact: Record<string, unknown>): void {
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

export interface CreateCodeChangeSourcePatchOptions {
  plan: CodeChangePlan;
  /** Optional per-path unified diffs keyed by relative repository path. */
  unifiedDiffs?: Record<string, string>;
  createdAt?: string;
}

/**
 * Build a structured source-edit proposal from one grounded code-change plan.
 *
 * Deterministic by default: each planned file gets an imperative instruction.
 * Callers may attach a unified diff per path; the runtime validates path headers
 * and rejects traversal / host paths. Nothing is written to the working tree.
 */
export function createCodeChangeSourcePatch(
  options: CreateCodeChangeSourcePatchOptions,
): CodeChangeSourcePatch {
  const plan = options.plan;
  const graphFingerprint = plan?.evidence?.graphFingerprint;
  assertCodeChangePlansForReview(
    [plan],
    typeof graphFingerprint === 'string' ? graphFingerprint : '',
  );
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('createdAt must be an ISO date-time');
  const allowed = new Set(plan.target.paths.map((path) => path.replace(/\\/g, '/')));
  const diffs = options.unifiedDiffs ?? {};
  for (const path of Object.keys(diffs)) {
    const normalized = path.replace(/\\/g, '/');
    if (!allowed.has(normalized)) {
      throw new Error(`Unified diff path ${normalized} is not declared by plan ${plan.id}`);
    }
  }
  const edits: CodeChangeSourceEdit[] = [...plan.changes]
    .map((change) => {
      const path = change.path.replace(/\\/g, '/');
      if (!allowed.has(path)) {
        throw new Error(`Edit path ${path} is not present in plan target.paths`);
      }
      const rawDiff = diffs[path];
      const unifiedDiff = rawDiff === undefined ? null : normalizeUnifiedDiff(rawDiff, path);
      return {
        path,
        action: change.action,
        symbols: uniqueSorted(change.symbols),
        instruction: instructionFor(change, plan),
        unifiedDiff,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  if (!edits.length) throw new Error(`Plan ${plan.id} has no editable paths`);

  const semantic = {
    planId: plan.id,
    planHash: plan.planHash,
    graphFingerprint: plan.evidence.graphFingerprint,
    diagnosticIds: uniqueSorted(plan.evidence.diagnosticIds),
    recordIds: uniqueSorted(plan.evidence.recordIds),
    edits,
    acceptanceCriteria: uniqueSorted(plan.acceptanceCriteria),
  };
  const patchHash = createCodeChangeSourcePatchHash(semantic);
  const patch: CodeChangeSourcePatch = {
    schemaVersion: 't2c.code-change-source-patch/v1',
    id: createCodeChangeSourcePatchId(semantic),
    patchHash,
    status: 'proposed',
    createdAt,
    ...semantic,
    generation: deterministicGeneration(createdAt, 't2c/code-change-source-patch'),
  };
  assertCodeChangeSourcePatch(patch, plan);
  return patch;
}

export function createCodeChangeSourcePatchSet(options: {
  plans: CodeChangePlan[];
  graphFingerprint: string;
  unifiedDiffsByPlanId?: Record<string, Record<string, string>>;
  generatedAt?: string;
}): CodeChangeSourcePatchSet {
  if (typeof options.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(options.graphFingerprint)) {
    throw new Error('graphFingerprint must be a SHA-256 hex digest');
  }
  assertCodeChangePlansForReview(options.plans, options.graphFingerprint);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const patches = [...options.plans]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((plan) => createCodeChangeSourcePatch({
      plan,
      createdAt: generatedAt,
      ...(options.unifiedDiffsByPlanId?.[plan.id]
        ? { unifiedDiffs: options.unifiedDiffsByPlanId[plan.id] }
        : {}),
    }));
  const result: CodeChangeSourcePatchSet = {
    schemaVersion: 't2c.code-change-source-patch-set/v1',
    generatedAt,
    graphFingerprint: options.graphFingerprint,
    patches,
    generation: deterministicGeneration(generatedAt, 't2c/code-change-source-patch-set'),
  };
  assertCodeChangeSourcePatchSet(result, options.plans);
  return result;
}

export function assertCodeChangeSourcePatch(
  value: unknown,
  plan?: CodeChangePlan,
): asserts value is CodeChangeSourcePatch {
  const patch = assertCodeChangeSourcePatchObject(value, plan);
  validateSourcePatchSchema(patch);
  validateSourcePatchIdentifiers(patch);
  const editPaths = validateSourcePatchEdits(patch);
  validateSourcePatchHashAndId(patch);
  validateSourcePatchGeneration(patch);
  if (plan) {
    validateSourcePatchAgainstPlan(patch, plan, editPaths);
  }
}

function assertCodeChangeSourcePatchObject(value: unknown, plan?: CodeChangePlan): CodeChangeSourcePatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch must be an object');
  }
  const patch = value as CodeChangeSourcePatch;
  exactSourcePatchKeys(patch as unknown as Record<string, unknown>, [
    'schemaVersion', 'id', 'patchHash', 'status', 'createdAt', 'planId', 'planHash',
    'graphFingerprint', 'diagnosticIds', 'recordIds', 'edits', 'acceptanceCriteria', 'generation',
  ], 'Source patch');
  if (plan !== undefined && typeof patch.planId === 'string' && patch.id) {
    if (patch.planId !== plan.id) {
      throw new Error('Source patch is not bound to the supplied plan');
    }
  }
  return patch;
}

function validateSourcePatchSchema(patch: CodeChangeSourcePatch): void {
  if (patch.schemaVersion !== 't2c.code-change-source-patch/v1') {
    throw new Error('Unsupported code change source patch schemaVersion');
  }
  if (typeof patch.createdAt !== 'string' || Number.isNaN(Date.parse(patch.createdAt))) {
    throw new Error('Source patch createdAt must be an ISO date-time');
  }
  if (patch.status !== 'proposed') throw new Error('Source patch status must be proposed');
  if (!Array.isArray(patch.edits) || patch.edits.length === 0) {
    throw new Error('Source patch edits must be a non-empty array');
  }
}

function validateSourcePatchIdentifiers(patch: CodeChangeSourcePatch): void {
  if (typeof patch.id !== 'string' || !/^SPATCH-[a-f0-9]{20}$/.test(patch.id)) {
    throw new Error('Source patch id must match SPATCH-<20 hex>');
  }
  if (typeof patch.patchHash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.patchHash)) {
    throw new Error('Source patch patchHash must be SHA-256');
  }
  if (typeof patch.planId !== 'string' || !/^CPLAN-[a-f0-9]{20}$/.test(patch.planId)) {
    throw new Error('Source patch planId must match CPLAN-<20 hex>');
  }
  if (typeof patch.planHash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.planHash)) {
    throw new Error('Source patch planHash must be SHA-256');
  }
  if (typeof patch.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(patch.graphFingerprint)) {
    throw new Error('Source patch graphFingerprint must be SHA-256');
  }
  assertSourcePatchIds(patch.diagnosticIds, /^DIAG-[a-f0-9]{20}$/, 'diagnosticIds');
  assertSourcePatchIds(patch.recordIds, /^INT-[A-Z]+-[a-f0-9]{20}$/, 'recordIds');
  assertSourcePatchStrings(patch.acceptanceCriteria, 'acceptanceCriteria', false);
}

function validateSourcePatchEdits(patch: CodeChangeSourcePatch): Set<string> {
  const paths = new Set<string>();
  for (const edit of patch.edits) {
    if (!edit || typeof edit !== 'object') throw new Error('Source patch edit must be an object');
    exactSourcePatchKeys(edit as unknown as Record<string, unknown>, [
      'path', 'action', 'symbols', 'instruction', 'unifiedDiff',
    ], 'Source patch edit');
    const normalizedPath = edit.path?.trim().replace(/\\/g, '/') ?? '';
    if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
      throw new Error(`Source patch edit path is not a relative repository path: ${normalizedPath}`);
    }
    if (!['create', 'modify', 'delete'].includes(edit.action)) {
      throw new Error(`Source patch edit action is unsupported: ${String(edit.action)}`);
    }
    if (typeof edit.instruction !== 'string' || !edit.instruction.trim()) {
      throw new Error('Source patch edit instruction must be non-blank');
    }
    assertSourcePatchStrings(edit.symbols, `edits[${normalizedPath}].symbols`, true);
    if (edit.unifiedDiff !== null) {
      if (typeof edit.unifiedDiff !== 'string') throw new Error('Source patch unifiedDiff must be string or null');
      normalizeUnifiedDiff(edit.unifiedDiff, normalizedPath);
    }
    const key = `${normalizedPath}::${edit.action}`;
    if (paths.has(key)) throw new Error(`Duplicate source patch edit for ${normalizedPath}`);
    paths.add(key);
  }
  return paths;
}

function validateSourcePatchHashAndId(patch: CodeChangeSourcePatch): void {
  const expectedHash = createCodeChangeSourcePatchHash(patch);
  if (patch.patchHash !== expectedHash) {
    throw new Error(`Source patch patchHash does not match semantic content: expected ${expectedHash}`);
  }
  if (patch.id !== createCodeChangeSourcePatchId(patch)) {
    throw new Error('Source patch id does not match semantic content');
  }
}

function validateSourcePatchGeneration(patch: CodeChangeSourcePatch): void {
  assertGroundedGenerationMetadata(patch.generation, 'Source patch generation');
  if (patch.generation.generatedAt !== patch.createdAt) {
    throw new Error('Source patch generation.generatedAt must match createdAt');
  }
  if (patch.generation.generator !== 't2c/code-change-source-patch') {
    throw new Error('Source patch generation.generator must be t2c/code-change-source-patch');
  }
}

function validateSourcePatchAgainstPlan(
  patch: CodeChangeSourcePatch,
  plan: CodeChangePlan,
  editPaths: Set<string>,
): void {
  if (patch.planHash !== plan.planHash) {
    throw new Error('Source patch is not bound to the supplied plan');
  }
  if (patch.graphFingerprint !== plan.evidence.graphFingerprint) {
    throw new Error('Source patch graphFingerprint does not match the plan');
  }
  const allowed = new Set(plan.target.paths.map((item) => item.replace(/\\/g, '/')));
  const expectedChanges = new Map(plan.changes.map((item) => [
    item.path.replace(/\\/g, '/'), item.action,
  ]));
  for (const edit of patch.edits) {
    const editPath = edit.path.replace(/\\/g, '/');
    if (!allowed.has(editPath)) {
      throw new Error(`Source patch path ${edit.path} is outside plan target.paths`);
    }
    if (expectedChanges.get(editPath) !== edit.action) {
      throw new Error(`Source patch action for ${edit.path} does not match the plan`);
    }
  }
  exactSourcePatchSet(
    [...editPaths].map((item) => item.split('::')[0]),
    [...expectedChanges.keys()],
    'edit paths',
  );
  exactSourcePatchSet(patch.diagnosticIds, plan.evidence.diagnosticIds, 'diagnosticIds');
  exactSourcePatchSet(patch.recordIds, plan.evidence.recordIds, 'recordIds');
  exactSourcePatchSet(patch.acceptanceCriteria, plan.acceptanceCriteria, 'acceptanceCriteria');
}

export function assertCodeChangeSourcePatchSet(
  value: unknown,
  plans?: CodeChangePlan[],
): asserts value is CodeChangeSourcePatchSet {
  const set = assertSourcePatchSetObject(value);
  validateSourcePatchSetSchema(set);
  validateSourcePatchSetPatches(set, plans);
  validateSourcePatchSetGeneration(set);
}

function assertSourcePatchObject(value: unknown, objectLabel: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(objectLabel);
  }
  return value as Record<string, unknown>;
}

function assertSourcePatchSetObject(value: unknown): CodeChangeSourcePatchSet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Code change source patch set must be an object');
  }
  const set = value as CodeChangeSourcePatchSet;
  exactSourcePatchKeys(set as unknown as Record<string, unknown>, [
    'schemaVersion', 'generatedAt', 'graphFingerprint', 'patches', 'generation',
  ], 'Source patch set');
  return set;
}

function validateSourcePatchSetSchema(set: CodeChangeSourcePatchSet): void {
  if (set.schemaVersion !== 't2c.code-change-source-patch-set/v1') {
    throw new Error('Unsupported code change source patch set schemaVersion');
  }
  if (typeof set.generatedAt !== 'string' || Number.isNaN(Date.parse(set.generatedAt))) {
    throw new Error('Source patch set generatedAt must be an ISO date-time');
  }
  if (typeof set.graphFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(set.graphFingerprint)) {
    throw new Error('Source patch set graphFingerprint must be SHA-256');
  }
  if (!Array.isArray(set.patches)) throw new Error('Source patch set patches must be an array');
}

function validateSourcePatchSetPatches(set: CodeChangeSourcePatchSet, plans?: CodeChangePlan[]): void {
  const plansById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const patchIds = new Set<string>();
  for (const patch of set.patches) {
    const expectedPlan = plans ? plansById.get(patch.planId) : undefined;
    assertCodeChangeSourcePatch(patch, expectedPlan);
    if (patch.graphFingerprint !== set.graphFingerprint) {
      throw new Error(`Source patch ${patch.id} graphFingerprint does not match its set`);
    }
    if (patchIds.has(patch.id)) throw new Error(`Duplicate source patch id: ${patch.id}`);
    patchIds.add(patch.id);
  }
  if (plans) exactSourcePatchSet(set.patches.map((patch) => patch.planId), plans.map((plan) => plan.id), 'planIds');
}

function validateSourcePatchSetGeneration(set: CodeChangeSourcePatchSet): void {
  assertGroundedGenerationMetadata(set.generation, 'Source patch set generation');
  if (set.generation.generatedAt !== set.generatedAt) {
    throw new Error('Source patch set generation.generatedAt must match generatedAt');
  }
  if (set.generation.generator !== 't2c/code-change-source-patch-set') {
    throw new Error('Source patch set generation.generator must be t2c/code-change-source-patch-set');
  }
}

function exactSourcePatchKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${name} keys must be exactly: ${wanted.join(', ')}`);
  }
}

function assertSourcePatchIds(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0
    || value.some((item) => typeof item !== 'string' || !pattern.test(item))) {
    throw new Error(`Source patch ${name} must be a non-empty array of valid IDs`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

function assertSourcePatchStrings(value: unknown, name: string, emptyAllowed: boolean): asserts value is string[] {
  if (!Array.isArray(value) || (!emptyAllowed && value.length === 0)
    || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`Source patch ${name} must contain ${emptyAllowed ? 'only ' : ''}non-blank strings`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Source patch ${name} must be unique`);
}

function exactSourcePatchSet(actual: string[], expected: string[], name: string): void {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (left.length !== right.length || left.some((item, index) => item !== right[index])) {
    throw new Error(`Source patch ${name} do not match the plan`);
  }
}

function instructionFor(change: CodeChangeFile, plan: CodeChangePlan): string {
  const symbols = change.symbols.length
    ? ` Focus on symbols: ${change.symbols.join(', ')}.`
    : '';
  const criteria = plan.acceptanceCriteria.length
    ? ` Acceptance: ${plan.acceptanceCriteria.join(' ')}`
    : '';
  return `${change.action} \`${change.path}\`. ${change.rationale.trim()}.${symbols}${criteria}`.replace(/\s+/g, ' ').trim();
}

/**
 * Validate a single-file unified diff body.
 * Accepts optional `--- a/path` / `+++ b/path` headers and rejects foreign paths.
 */
function normalizeUnifiedDiff(diff: string, expectedPath: string): string {
  const normalized = diff.replace(/\r\n/g, '\n');
  if (!normalized.trim()) throw new Error(`Unified diff for ${expectedPath} is empty`);
  if (normalized.includes('\0')) throw new Error(`Unified diff for ${expectedPath} contains NUL bytes`);
  // Lightweight secret heuristic — refuse obvious credential dumps in proposed diffs.
  if (/(?:api[_-]?key|secret|password|private[_-]?key)\s*[:=]\s*['"]?[^'"\s]{8,}/i.test(normalized)) {
    throw new Error(`Unified diff for ${expectedPath} appears to contain a secret assignment`);
  }
  const headers = [...normalized.matchAll(/^(?:---|\+\+\+)\s+(?:[ab]\/)?(.+)$/gm)].map((match) => match[1]!.trim());
  for (const header of headers) {
    if (header === '/dev/null') continue;
    const path = header.replace(/\\/g, '/');
    if (path.startsWith('/') || path.split('/').includes('..')) {
      throw new Error(`Unified diff for ${expectedPath} uses a non-repository path header: ${path}`);
    }
    if (path !== expectedPath && path !== `a/${expectedPath}` && path !== `b/${expectedPath}`) {
      // Headers may include timestamps after a tab; strip them.
      const bare = path.split('\t')[0] ?? path;
      const stripped = bare.replace(/^[ab]\//, '');
      if (stripped !== expectedPath) {
        throw new Error(`Unified diff for ${expectedPath} references foreign path: ${path}`);
      }
    }
  }
  return normalized;
}

export interface ApplyCodeChangeSourcePatchOptions {
  root: string;
  patch: CodeChangeSourcePatch;
  approval: CodeChangeSourcePatchApproval;
  receiptPath: string;
  now?: Date;
}

export interface ApplyCodeChangeSourcePatchResult {
  applied: boolean;
  idempotent: boolean;
  receipt: CodeChangeSourceApplyReceipt;
}

/**
 * Apply a fully-diffed source patch after explicit hash approval.
 *
 * Instruction-only edits (null unifiedDiff) are rejected. Paths must stay
 * relative and inside `root`. Re-applying with an existing matching receipt is
 * idempotent.
 */
export async function applyCodeChangeSourcePatch(
  options: ApplyCodeChangeSourcePatchOptions,
): Promise<ApplyCodeChangeSourcePatchResult> {
  assertCodeChangeSourcePatch(options.patch);
  if (!options.approval?.actor?.trim()) throw new Error('Explicit source patch approval actor is required');
  if (options.approval.patchHash !== options.patch.patchHash) {
    throw new Error('Source patch approval hash does not match the patch');
  }
  for (const edit of options.patch.edits) {
    if (edit.unifiedDiff === null) {
      throw new Error(`Source patch edit ${edit.path} has no unifiedDiff and cannot be applied`);
    }
  }

  const root = path.resolve(options.root);
  const receiptPath = await assertPathWithinRoot(root, path.resolve(options.receiptPath));
  const lockPath = `${receiptPath}.t2c-apply.lock`;
  await ensureDir(path.dirname(receiptPath));
  let lock: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    lock = await fs.open(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Another source patch apply operation is in progress');
    }
    throw error;
  }

  try {
    if (await pathExists(receiptPath)) {
      const existing = await readJson<CodeChangeSourceApplyReceipt>(receiptPath, 1024 * 1024);
      await assertExistingSourceReceipt(existing, options.patch, root);
      return { applied: false, idempotent: true, receipt: existing };
    }

    const prepared: PreparedSourceEdit[] = [];
    for (const edit of options.patch.edits) {
      const relative = edit.path.replace(/\\/g, '/');
      const absolute = await assertPathWithinRoot(root, path.resolve(root, relative));
      if (absolute === receiptPath) {
        throw new Error(`Source patch target collides with its receipt path: ${relative}`);
      }
      const exists = await pathExists(absolute);
      if (exists && (await fs.lstat(absolute)).isSymbolicLink()) {
        throw new Error(`Refusing to apply through a symlink: ${relative}`);
      }
      if (edit.action === 'create' && exists) throw new Error(`Source patch create target already exists: ${relative}`);
      if (edit.action === 'delete' && !exists) throw new Error(`Source patch delete target does not exist: ${relative}`);
      if (edit.action === 'modify' && !exists) {
        const fromEmpty = /(?:^|\n)---\s+\/dev\/null(?:\n|$)/.test(edit.unifiedDiff!)
          || /(?:^|\n)@@\s+-0(?:,0)?\s+\+/.test(edit.unifiedDiff!);
        if (!fromEmpty) throw new Error(`Source patch modify target does not exist: ${relative}`);
      }
      const before = exists ? await readText(absolute, 16 * 1024 * 1024) : '';
      const after = applyUnifiedDiffToText(before, edit.unifiedDiff!, relative);
      if (edit.action === 'delete' && after !== '') {
        throw new Error(`Source patch delete diff must remove the complete file: ${relative}`);
      }
      prepared.push({ relative, absolute, action: edit.action, before, after, existed: exists });
    }

    const changed: PreparedSourceEdit[] = [];
    try {
      for (const edit of prepared) {
        if (edit.action === 'delete') await fs.unlink(edit.absolute);
        else await atomicWriteRaw(edit.absolute, edit.after);
        changed.push(edit);
      }
      const now = (options.now ?? new Date()).toISOString();
      const fileHashesAfter = Object.fromEntries(prepared
        .map((edit): [string, string] => [edit.relative, sha256(edit.after)])
        .sort(([left], [right]) => left.localeCompare(right)));
      const receipt: CodeChangeSourceApplyReceipt = {
        schemaVersion: 't2c.code-change-source-apply-receipt/v1',
        patchId: options.patch.id,
        patchHash: options.patch.patchHash,
        planId: options.patch.planId,
        approvedBy: options.approval.actor.trim(),
        approvedAt: now,
        appliedAt: now,
        appliedPaths: prepared.map((edit) => edit.relative).sort(),
        fileHashesAfter,
        generation: deterministicGeneration(now, 't2c/code-change-source-apply'),
      };
      assertSourceApplyReceipt(receipt, options.patch);
      // The receipt is part of the transaction: without it a retry could apply
      // the same approved patch again. Roll files back if persisting it fails.
      await atomicWriteRaw(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      return { applied: true, idempotent: false, receipt };
    } catch (error) {
      const rollbackErrors: string[] = [];
      for (const edit of [...changed].reverse()) {
        try {
          if (edit.existed) await atomicWriteRaw(edit.absolute, edit.before);
          else await fs.unlink(edit.absolute).catch((failure: NodeJS.ErrnoException) => {
            if (failure.code !== 'ENOENT') throw failure;
          });
        } catch (rollbackError) {
          rollbackErrors.push(`${edit.relative}: ${String(rollbackError)}`);
        }
      }
      if (rollbackErrors.length) {
        throw new Error(`Source patch apply failed (${String(error)}); rollback also failed: ${rollbackErrors.join('; ')}`);
      }
      throw error;
    }
  } finally {
    await lock.close();
    await fs.unlink(lockPath).catch(() => undefined);
  }
}

interface PreparedSourceEdit {
  relative: string;
  absolute: string;
  action: CodeChangeFileAction;
  before: string;
  after: string;
  existed: boolean;
}

async function assertExistingSourceReceipt(
  receipt: CodeChangeSourceApplyReceipt,
  patch: CodeChangeSourcePatch,
  root: string,
): Promise<void> {
  try {
    assertSourceApplyReceipt(receipt, patch);
  } catch {
    throw new Error('A different or invalid source patch receipt already exists at the receipt path');
  }
  for (const edit of patch.edits) {
    const relative = edit.path.replace(/\\/g, '/');
    const absolute = await assertPathWithinRoot(root, path.resolve(root, relative));
    const exists = await pathExists(absolute);
    if (edit.action === 'delete') {
      if (exists) throw new Error(`Applied source patch state changed after receipt: ${relative}`);
      continue;
    }
    if (!exists || (await fs.lstat(absolute)).isSymbolicLink()) {
      throw new Error(`Applied source patch state changed after receipt: ${relative}`);
    }
    const current = await readText(absolute, 16 * 1024 * 1024);
    if (receipt.fileHashesAfter[relative] !== sha256(current)) {
      throw new Error(`Applied source patch state changed after receipt: ${relative}`);
    }
  }
}

function assertSourceApplyReceipt(receipt: CodeChangeSourceApplyReceipt, patch: CodeChangeSourcePatch): void {
  exactSourcePatchKeys(receipt as unknown as Record<string, unknown>, [
    'schemaVersion', 'patchId', 'patchHash', 'planId', 'approvedBy', 'approvedAt',
    'appliedAt', 'appliedPaths', 'fileHashesAfter', 'generation',
  ], 'Code change source apply receipt');
  if (receipt.schemaVersion !== 't2c.code-change-source-apply-receipt/v1'
    || receipt.patchId !== patch.id || receipt.patchHash !== patch.patchHash || receipt.planId !== patch.planId) {
    throw new Error('Code change source apply receipt does not match its patch');
  }
  if (!receipt.approvedBy.trim()) throw new Error('Code change source apply receipt approvedBy is required');
  if (!Number.isFinite(Date.parse(receipt.approvedAt)) || !Number.isFinite(Date.parse(receipt.appliedAt))) {
    throw new Error('Code change source apply receipt timestamps must be ISO date-times');
  }
  const expectedPaths = patch.edits.map((edit) => edit.path).sort();
  exactSourcePatchSet(receipt.appliedPaths, expectedPaths, 'receipt appliedPaths');
  const hashPaths = Object.keys(receipt.fileHashesAfter).sort();
  exactSourcePatchSet(hashPaths, expectedPaths, 'receipt fileHashesAfter paths');
  if (Object.values(receipt.fileHashesAfter).some((value) => !/^[a-f0-9]{64}$/.test(value))) {
    throw new Error('Code change source apply receipt file hashes must be SHA-256');
  }
  assertGroundedGenerationMetadata(receipt.generation, 'Code change source apply receipt generation');
  if (receipt.generation.generatedAt !== receipt.appliedAt
    || receipt.generation.generator !== 't2c/code-change-source-apply') {
    throw new Error('Code change source apply receipt generation does not match the apply operation');
  }
}

async function atomicWriteRaw(target: string, content: string): Promise<void> {
  await ensureDir(path.dirname(target));
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await fs.writeFile(temporary, content, 'utf8');
    await fs.rename(temporary, target);
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
}

/**
 * Apply a single-file unified diff to a text buffer.
 * Supports standard hunks with space/+/− prefixes. Throws on context mismatch.
 */
export function applyUnifiedDiffToText(base: string, diff: string, expectedPath: string): string {
  const normalizedDiff = normalizeUnifiedDiff(diff, expectedPath);
  const baseLines = splitKeep(base);
  const diffLines = normalizedDiff.split('\n');
  // Drop trailing empty element only if the original split introduced it
  // without a final newline — normalize by working on lines as split.
  const hunks: Array<{ oldStart: number; oldCount: number; newCount: number; lines: string[] }> = [];
  let current: { oldStart: number; oldCount: number; newCount: number; lines: string[] } | null = null;
  for (const line of diffLines) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
      continue;
    }
    const header = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
    if (header) {
      if (current) hunks.push(current);
      current = {
        oldStart: Number(header[1]),
        oldCount: header[2] === undefined ? 1 : Number(header[2]),
        newCount: header[4] === undefined ? 1 : Number(header[4]),
        lines: [],
      };
      continue;
    }
    if (!current) {
      if (line === '') continue;
      throw new Error(`Unified diff for ${expectedPath} has content outside hunks`);
    }
    // Blank lines without a unified-diff prefix separate hunks in some emitters.
    if (line === '') continue;
    current.lines.push(line);
  }
  if (current) hunks.push(current);
  if (!hunks.length) throw new Error(`Unified diff for ${expectedPath} contains no hunks`);

  let cursor = 0;
  const output: string[] = [];
  for (const hunk of hunks) {
    const oldIndex = Math.max(0, hunk.oldStart - 1);
    if (oldIndex < cursor) throw new Error(`Unified diff for ${expectedPath} has overlapping or unordered hunks`);
    const oldCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('-')).length;
    const newCount = hunk.lines.filter((line) => line.startsWith(' ') || line.startsWith('+')).length;
    if (oldCount !== hunk.oldCount || newCount !== hunk.newCount) {
      throw new Error(`Unified diff hunk counts do not match its header for ${expectedPath}`);
    }
    while (cursor < oldIndex) {
      if (cursor >= baseLines.length) throw new Error(`Unified diff for ${expectedPath} ran past end of file`);
      output.push(baseLines[cursor]!);
      cursor += 1;
    }
    for (const line of hunk.lines) {
      if (line.startsWith('\\')) continue; // "\ No newline at end of file"
      const mark = line[0];
      const body = line.slice(1);
      if (mark === ' ') {
        if (baseLines[cursor] !== body) {
          throw new Error(`Unified diff context mismatch for ${expectedPath} at line ${cursor + 1}`);
        }
        output.push(baseLines[cursor]!);
        cursor += 1;
      } else if (mark === '-') {
        if (baseLines[cursor] !== body) {
          throw new Error(`Unified diff deletion mismatch for ${expectedPath} at line ${cursor + 1}`);
        }
        cursor += 1;
      } else if (mark === '+') {
        output.push(body);
      } else if (line === '') {
        // empty line inside hunk without prefix is invalid in strict unified diffs
        throw new Error(`Unified diff for ${expectedPath} has an unprefixed hunk line`);
      } else {
        throw new Error(`Unified diff for ${expectedPath} has unsupported hunk line`);
      }
    }
  }
  while (cursor < baseLines.length) {
    output.push(baseLines[cursor]!);
    cursor += 1;
  }
  // Reconstruct text. Files without a trailing newline end without an empty last segment.
  if (base.endsWith('\n') || output.length === 0) return `${output.join('\n')}${output.length ? '\n' : ''}`;
  return output.join('\n');
}

function splitKeep(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines;
}
