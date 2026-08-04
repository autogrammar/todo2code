import { createConclusionId, createTodoProposalId, sha256 } from '../core/id.js';
import { buildRecord } from '../core/record.js';
import type { Conclusion, GroundedGenerationMetadata, IntentRecord, TodoProposal } from '../core/types.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import {
  applyAcceptedSemanticRelations,
  createSemanticCandidateSet,
  createSemanticRerankResult,
} from '../semantic/reranker.js';
import { validateAndClassifyTodoProposals } from '../synthesis/validation.js';
import { T2C_VERSION } from '../version.js';
import { compareSets, type Counts } from './gold-metrics.js';
import {
  GOLD_FIXED_TIME,
  GOLD_RELATION_CLASSES,
  type GoldDiagnosticsCase,
  type GoldDsl2TodoCase,
  type GoldFixtureRecord,
  type GoldLinkingCase,
  type GoldRelationClass,
} from './gold-types.js';

export interface LinkingCaseResult {
  counts: Counts;
  /** The same comparison restricted to each justification class. */
  byClass: Record<GoldRelationClass, Counts>;
  /** Forbidden pairs the linker produced anyway. */
  forbiddenViolations: number;
  actual: unknown[];
}

export function evaluateLinkingCase(fixture: GoldLinkingCase): LinkingCaseResult {
  const { records, labels } = buildFixtureRecords(fixture.id, fixture.records);
  const idToLabel = new Map([...labels].map(([label, id]) => [id, label]));
  const graph = linkIntentRecords(records, GOLD_FIXED_TIME);
  const observed = graph.relations.map((relation) => ({
    from: idToLabel.get(relation.from) ?? relation.from,
    to: idToLabel.get(relation.to) ?? relation.to,
    type: relation.type,
    relationClass: classifyRelation(relation.basis),
  }));
  const actual = observed.map(({ from, to, type, relationClass }) => ({ from, to, type, relationClass }));
  const expected = fixture.expected.map((item) => ({ ...item, relationClass: item.relationClass ?? 'exact-target' }));

  const byClass = Object.fromEntries(GOLD_RELATION_CLASSES.map((relationClass) => [
    relationClass,
    compareSets(
      actual.filter((item) => item.relationClass === relationClass),
      expected.filter((item) => item.relationClass === relationClass),
    ),
  ])) as Record<GoldRelationClass, Counts>;

  const forbidden = fixture.forbidden ?? [];
  const forbiddenViolations = forbidden.filter((pair) => observed.some((relation) =>
    (relation.from === pair.from && relation.to === pair.to)
    || (relation.from === pair.to && relation.to === pair.from))).length;

  return { counts: compareSets(actual, expected), byClass, forbiddenViolations, actual };
}

export interface RerankingCaseResult {
  counts: Counts;
  forbiddenViolations: number;
  accepted: number;
  abstained: number;
  actual: unknown[];
  snapshot: unknown;
}

export function evaluateRerankingCase(fixture: GoldLinkingCase): RerankingCaseResult {
  const reranker = resolveRerankerFixture(fixture);
  const { records, labels } = buildFixtureRecords(fixture.id, fixture.records);
  const idToLabel = new Map([...labels].map(([label, id]) => [id, label]));
  const declarationRecordId = resolveDeclarationRecordId(fixture.id, labels);
  const graph = linkIntentRecords(records, GOLD_FIXED_TIME);
  const candidates = buildRerankerCandidates(fixture.id, graph, labels, declarationRecordId, reranker);
  const decisions = buildRerankerDecisions(fixture.id, reranker, labels, candidates, declarationRecordId);
  const rerank = buildRerankResult(graph, fixture, reranker, candidates, decisions);
  const observed = buildObservedRerankRelations(graph, candidates, rerank, idToLabel);
  const forbiddenViolations = countForbiddenRelations(observed, fixture.forbidden);
  return {
    counts: compareSets(observed, buildRerankExpected(fixture.expected)),
    forbiddenViolations,
    accepted: countVerdictDecisions(rerank.decisions, 'accept'),
    abstained: countVerdictDecisions(rerank.decisions, 'abstain'),
    actual: observed,
    snapshot: buildRerankSnapshot(fixture.id, candidates, rerank, observed),
  };
}

function buildRerankerCandidates(
  caseId: string,
  graph: ReturnType<typeof linkIntentRecords>,
  labels: Map<string, string>,
  declarationRecordId: string,
  reranker: NonNullable<GoldLinkingCase['reranker']>,
): ReturnType<typeof createSemanticCandidateSet> {
  const requestedCandidates = reranker.decisions.map((decision) => ({
    declarationRecordId,
    moduleRecordId: resolveFixtureLabelToRecordId(caseId, labels, decision.module),
    score: decision.score,
  }));
  return createSemanticCandidateSet(
    graph,
    requestedCandidates,
    {
      provider: 'captured-gold-retrieval',
      model: 'intfloat/multilingual-e5-base',
      revision: '18fcae5',
      metric: 'cosine',
    },
    Math.max(1, requestedCandidates.length),
    GOLD_FIXED_TIME,
  );
}

function buildRerankerDecisions(
  caseId: string,
  reranker: NonNullable<GoldLinkingCase['reranker']>,
  labels: Map<string, string>,
  candidates: ReturnType<typeof createSemanticCandidateSet>,
  declarationRecordId: string,
): Array<{
  candidateId: string;
  verdict: 'accept' | 'reject' | 'abstain';
  confidence: number;
  reasonCode: string;
  rationale: string;
  citedRecordIds: [string, string];
  evidence: Array<{ recordId: string; quote: string }>;
}> {
  const candidateByModule = new Map(candidates.candidates.map((candidate) => [candidate.moduleRecordId, candidate]));
  return reranker.decisions.map((decision) => {
    const moduleRecordId = resolveFixtureLabelToRecordId(caseId, labels, decision.module);
    const candidate = candidateByModule.get(moduleRecordId);
    if (!candidate) {
      throw new Error(`Gold reranker case ${caseId} cannot resolve candidate ${decision.module}`);
    }
    return {
      candidateId: candidate.id,
      verdict: decision.verdict,
      confidence: decision.confidence,
      reasonCode: decision.reasonCode,
      rationale: decision.rationale,
      citedRecordIds: [declarationRecordId, moduleRecordId],
      evidence: [
        { recordId: declarationRecordId, quote: decision.declarationQuote },
        { recordId: moduleRecordId, quote: decision.moduleQuote },
      ],
    };
  });
}

function buildRerankResult(
  graph: ReturnType<typeof linkIntentRecords>,
  fixture: GoldLinkingCase,
  reranker: NonNullable<GoldLinkingCase['reranker']>,
  candidates: ReturnType<typeof createSemanticCandidateSet>,
  decisions: ReturnType<typeof buildRerankerDecisions>,
): ReturnType<typeof createSemanticRerankResult> {
  return createSemanticRerankResult(graph, candidates, decisions, {
    provider: 'captured-gold-response',
    requestedModel: reranker.model,
    model: reranker.model,
    modelRevision: reranker.modelRevision,
    responseId: `gold-${fixture.id}`,
  }, GOLD_FIXED_TIME);
}

function buildObservedRerankRelations(
  graph: ReturnType<typeof linkIntentRecords>,
  candidates: ReturnType<typeof createSemanticCandidateSet>,
  rerank: ReturnType<typeof createSemanticRerankResult>,
  idToLabel: Map<string, string>,
): Array<{ from: string; to: string; type: string }> {
  const augmented = applyAcceptedSemanticRelations(graph, candidates, rerank, GOLD_FIXED_TIME);
  return augmented.relations
    .filter((relation) => relation.basis.includes('cross_language_reranker'))
    .map((relation) => ({
      from: idToLabel.get(relation.from) ?? relation.from,
      to: idToLabel.get(relation.to) ?? relation.to,
      type: relation.type,
    }));
}

function countForbiddenRelations<T extends { from: string; to: string }>(
  observed: T[],
  forbidden?: Array<{ from: string; to: string }>,
): number {
  const restricted = forbidden ?? [];
  return restricted.filter((pair) => observed.some((item) => (
    (item.from === pair.from && item.to === pair.to)
    || (item.from === pair.to && item.to === pair.from)
  ))).length;
}

function buildRerankExpected(expected: GoldLinkingCase['expected']): Array<{ from: string; to: string; type: string }> {
  return expected.map(({ from, to, type }) => ({ from, to, type }));
}

function buildRerankSnapshot(
  caseId: string,
  candidates: ReturnType<typeof createSemanticCandidateSet>,
  rerank: ReturnType<typeof createSemanticRerankResult>,
  observed: ReturnType<typeof buildObservedRerankRelations>,
): { caseId: string; candidateSetHash: string; resultHash: string; actual: typeof observed } {
  return {
    caseId,
    candidateSetHash: candidates.candidateSetHash,
    resultHash: rerank.resultHash,
    actual: observed,
  };
}

function countVerdictDecisions(
  decisions: Array<{ verdict: 'accept' | 'reject' | 'abstain' }>,
  verdict: 'accept' | 'abstain',
): number {
  return decisions.filter((decision) => decision.verdict === verdict).length;
}

function resolveRerankerFixture(fixture: GoldLinkingCase): NonNullable<GoldLinkingCase['reranker']> {
  if (!fixture.reranker) {
    throw new Error(`Gold case ${fixture.id} has no reranker fixture`);
  }
  return fixture.reranker;
}

function resolveDeclarationRecordId(caseId: string, labels: Map<string, string>): string {
  const declarationRecordId = labels.get('declaration');
  if (!declarationRecordId) {
    throw new Error(`Gold reranker case ${caseId} has no declaration label`);
  }
  return declarationRecordId;
}

function resolveFixtureLabelToRecordId(
  caseId: string,
  labels: Map<string, string>,
  label: string,
): string {
  const recordId = labels.get(label);
  if (!recordId) {
    throw new Error(`Gold reranker case ${caseId} references unknown module label ${label}`);
  }
  return recordId;
}

/**
 * Reads the justification class off a relation's `basis`.
 *
 * `module_topic:<n>` is the only capability heuristic the linker emits; every
 * other basis rests on a ticket, path or symbol the record states explicitly.
 */
function classifyRelation(basis: string[]): GoldRelationClass {
  const exact = basis.some((item) => item === 'shared_ticket' || item === 'shared_symbol' || item === 'shared_path');
  if (exact) return 'exact-target';
  return basis.some((item) => item.startsWith('module_topic:')) ? 'capability-topic' : 'exact-target';
}

export interface DiagnosticsCaseResult {
  counts: Counts;
  /** Codes the case forbids but the graph raised anyway. */
  forbiddenViolations: number;
  actual: unknown[];
}

/**
 * Measures which diagnostic codes a small graph raises, per record.
 *
 * `ALIGNED` is a report-level statement rather than a record finding, so it is
 * compared under the reserved label `graph`. Everything else is attributed to
 * the fixture label of the record it cites; a diagnostic citing several records
 * appears once per cited label.
 */
export function evaluateDiagnosticsCase(fixture: GoldDiagnosticsCase): DiagnosticsCaseResult {
  const { records, labels } = buildFixtureRecords(fixture.id, fixture.records);
  const idToLabel = new Map([...labels].map(([label, id]) => [id, label]));
  const graph = linkIntentRecords(records, GOLD_FIXED_TIME);
  const report = diagnoseGraph(graph, GOLD_FIXED_TIME);
  const observed = report.diagnostics.flatMap((diagnostic) => (
    diagnostic.recordIds.length
      ? diagnostic.recordIds.map((id) => ({ record: idToLabel.get(id) ?? id, code: diagnostic.code }))
      : [{ record: 'graph', code: diagnostic.code }]
  ));
  const actual = [...new Map(observed.map((item) => [`${item.record}|${item.code}`, item])).values()]
    .sort((a, b) => a.record.localeCompare(b.record) || a.code.localeCompare(b.code));
  const forbidden = fixture.forbidden ?? [];
  const forbiddenViolations = forbidden.filter((item) => (
    actual.some((observedItem) => observedItem.record === item.record && observedItem.code === item.code)
  )).length;
  return { counts: compareSets(actual, fixture.expected), forbiddenViolations, actual };
}

export interface Dsl2TodoCaseResult {
  duplicates: Counts;
  citationRequired: number;
  citationCited: number;
  proposals: number;
  classifiedDuplicates: number;
  snapshot: unknown;
}

export function evaluateDsl2TodoCase(fixture: GoldDsl2TodoCase): Dsl2TodoCaseResult {
  const { records, labels } = buildFixtureRecords(fixture.id, fixture.records);
  const graph = linkIntentRecords(records, GOLD_FIXED_TIME);
  const diagnostics = diagnoseGraph(graph, GOLD_FIXED_TIME);
  const diagnosticIds = diagnostics.diagnostics.map((item) => item.id);
  if (!diagnosticIds.length) throw new Error(`Gold DSL2TODO case ${fixture.id} produced no diagnostics`);
  const conclusion = buildConclusion(fixture.id, records, diagnosticIds, diagnostics.diagnostics[0]?.severity ?? 'warning');
  const proposals = fixture.proposals.map((raw) => ({
    fixture: raw,
    proposal: buildProposal(raw, labels, diagnosticIds, conclusion.id),
  }));
  const validation = validateAndClassifyTodoProposals(
    proposals.map(({ proposal }) => proposal),
    { graph, diagnostics, conclusions: [conclusion] },
  );
  const duplicateIds = new Set(validation.duplicateProposalIds);
  const actual = proposals.filter(({ proposal }) => duplicateIds.has(proposal.id)).map(({ fixture: raw }) => raw.label);
  const expected = proposals.filter(({ fixture: raw }) => raw.expectedDuplicate).map(({ fixture: raw }) => raw.label);
  const citations = countCitations(records, diagnosticIds, conclusion, proposals, labels);
  return {
    duplicates: compareSets(actual, expected),
    ...citations,
    proposals: proposals.length,
    classifiedDuplicates: validation.duplicateProposalIds.length,
    snapshot: {
      conclusion,
      proposals: proposals.map(({ fixture: raw, proposal }) => ({ label: raw.label, proposal })),
      duplicateLabels: actual,
    },
  };
}

function buildConclusion(
  caseId: string,
  records: IntentRecord[],
  diagnosticIds: string[],
  severity: Conclusion['severity'],
): Conclusion {
  const content: Omit<Conclusion, 'id'> = {
    schemaVersion: 't2c.conclusion/v1',
    kind: 'finding',
    title: `Gold finding: ${caseId}`,
    detail: 'Versioned gold evidence requires a reviewed TODO proposal.',
    severity,
    diagnosticIds,
    recordIds: records.map((record) => record.id),
    confidence: 1,
    generation: deterministicGeneration(),
  };
  return { ...content, id: createConclusionId(content) };
}

function buildProposal(
  raw: GoldDsl2TodoCase['proposals'][number],
  labels: Map<string, string>,
  diagnosticIds: string[],
  conclusionId: string,
): TodoProposal {
  const recordIds = raw.requiredRecordLabels.map((label) => {
    const id = labels.get(label);
    if (!id) throw new Error(`Gold proposal ${raw.label} references unknown record label ${label}`);
    return id;
  });
  const content: Omit<TodoProposal, 'id'> = {
    schemaVersion: 't2c.todo-proposal/v1',
    title: raw.title,
    description: raw.description,
    priority: raw.priority,
    status: 'proposed',
    target: raw.target,
    acceptanceCriteria: raw.acceptanceCriteria,
    dependencies: [],
    conclusionIds: [conclusionId],
    diagnosticIds,
    recordIds,
    confidence: 1,
    generation: deterministicGeneration(),
  };
  return { ...content, id: createTodoProposalId(content) };
}

function countCitations(
  records: IntentRecord[],
  diagnosticIds: string[],
  conclusion: Conclusion,
  proposals: Array<{
    fixture: GoldDsl2TodoCase['proposals'][number];
    proposal: TodoProposal;
  }>,
  labels: Map<string, string>,
): { citationRequired: number; citationCited: number } {
  let citationRequired = records.length + diagnosticIds.length;
  let citationCited = conclusion.recordIds.filter((id) => records.some((record) => record.id === id)).length
    + conclusion.diagnosticIds.filter((id) => diagnosticIds.includes(id)).length;
  for (const { fixture, proposal } of proposals) {
    citationRequired += fixture.requiredRecordLabels.length + diagnosticIds.length + 1;
    citationCited += proposal.recordIds.filter((id) => (
      fixture.requiredRecordLabels.some((label) => labels.get(label) === id)
    )).length;
    citationCited += proposal.diagnosticIds.filter((id) => diagnosticIds.includes(id)).length;
    citationCited += proposal.conclusionIds.includes(conclusion.id) ? 1 : 0;
  }
  return { citationRequired, citationCited };
}

function buildFixtureRecords(
  caseId: string,
  fixtures: GoldFixtureRecord[],
): { records: IntentRecord[]; labels: Map<string, string> } {
  const labels = new Map<string, string>();
  const records = fixtures.map((fixture, index) => {
    if (labels.has(fixture.label)) throw new Error(`Duplicate gold fixture label: ${fixture.label}`);
    const record = buildFixtureRecord(caseId, fixture, index);
    labels.set(fixture.label, record.id);
    return record;
  });
  return { records, labels };
}

function buildFixtureRecord(
  caseId: string,
  fixture: GoldFixtureRecord,
  index: number,
): IntentRecord {
  return buildRecord({
    kind: fixture.statementKind ?? 'gold_fixture',
    action: fixture.action,
    object: fixture.text,
    text: fixture.text,
    ...(fixture.target ? { target: fixture.target } : {}),
    polarity: fixture.polarity ?? 'positive',
    modality: fixture.modality ?? resolveDefaultFixtureModality(fixture),
    lifecycle: fixture.lifecycle,
    sourceKind: fixture.sourceKind,
    sourcePath: resolveFixtureSourcePath(caseId, fixture, index),
    sourceLines: { start: 1, end: 1 },
    extractor: 't2c/gold-fixture@1',
    ...(resolveFixtureSymbol(fixture) ? { symbol: resolveFixtureSymbol(fixture) } : {}),
    epistemicClass: resolveFixtureEpistemicClass(fixture),
    confidence: 1,
    basis: ['versioned_gold_fixture'],
    ...(fixture.metadata ? { metadata: fixture.metadata as Record<string, never> } : {}),
  });
}

function resolveDefaultFixtureModality(fixture: GoldFixtureRecord): IntentRecord['modality'] {
  return fixture.sourceKind === 'todo' ? 'required' : 'observed';
}

function resolveFixtureSourcePath(
  caseId: string,
  fixture: GoldFixtureRecord,
  index: number,
): string {
  return fixture.sourceKind === 'ast' && fixture.target?.paths?.length === 1
    ? fixture.target.paths[0] as string
    : `evaluation/${caseId}/${fixture.label}-${index + 1}.md`;
}

function resolveFixtureSymbol(fixture: GoldFixtureRecord): string | undefined {
  return fixture.sourceKind === 'ast' && fixture.target?.symbols?.length === 1
    ? fixture.target.symbols[0] as string
    : undefined;
}

function resolveFixtureEpistemicClass(fixture: GoldFixtureRecord): IntentRecord['epistemicClass'] {
  return fixture.sourceKind === 'todo' ? 'plan' : fixture.sourceKind === 'git' ? 'fact' : 'declaration';
}

function deterministicGeneration(): GroundedGenerationMetadata {
  return {
    generator: 't2c/gold-evaluation',
    generatorVersion: '1',
    runtimeVersion: T2C_VERSION,
    generatedAt: GOLD_FIXED_TIME,
    requestedMode: 'deterministic',
    effectiveMode: 'deterministic',
    degraded: false,
    model: null,
    provider: null,
    responseId: null,
    configurationFingerprint: sha256('t2c-gold-evaluation/v1'),
    reason: null,
  };
}
