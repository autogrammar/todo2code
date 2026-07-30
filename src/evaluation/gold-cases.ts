import { createConclusionId, createTodoProposalId, sha256 } from '../core/id.js';
import { buildRecord } from '../core/record.js';
import type { Conclusion, GroundedGenerationMetadata, IntentRecord, TodoProposal } from '../core/types.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { linkIntentRecords } from '../graph/linker.js';
import { validateAndClassifyTodoProposals } from '../synthesis/validation.js';
import { T2C_VERSION } from '../version.js';
import { compareSets, type Counts } from './gold-metrics.js';
import {
  GOLD_FIXED_TIME,
  GOLD_RELATION_CLASSES,
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
    const record = buildRecord({
      kind: fixture.statementKind ?? 'gold_fixture',
      action: fixture.action,
      object: fixture.text,
      text: fixture.text,
      ...(fixture.target ? { target: fixture.target } : {}),
      polarity: fixture.polarity ?? 'positive',
      modality: fixture.sourceKind === 'todo' ? 'required' : 'observed',
      lifecycle: fixture.lifecycle,
      sourceKind: fixture.sourceKind,
      sourcePath: `evaluation/${caseId}/${fixture.label}-${index + 1}.md`,
      sourceLines: { start: 1, end: 1 },
      extractor: 't2c/gold-fixture@1',
      epistemicClass: fixture.sourceKind === 'todo' ? 'plan' : fixture.sourceKind === 'git' ? 'fact' : 'declaration',
      confidence: 1,
      basis: ['versioned_gold_fixture'],
      ...(fixture.metadata ? { metadata: fixture.metadata as Record<string, never> } : {}),
    });
    if (labels.has(fixture.label)) throw new Error(`Duplicate gold fixture label: ${fixture.label}`);
    labels.set(fixture.label, record.id);
    return record;
  });
  return { records, labels };
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
