import {
  createCodeChangePlanHash,
  createCodeChangePlanId,
  createConclusionId,
  createTodoProposalId,
  graphFingerprint,
} from './id.js';
import type {
  CodeChangeAcceptance,
  CodeChangePlan,
  Conclusion,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentGraphDiff,
  IntentRecord,
  IntentRelation,
  JsonValue,
  TodoProposal,
} from './types.js';

const ACTIONS = new Set([
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
]);
const MODALITIES = new Set(['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown']);
const POLARITIES = new Set(['positive', 'negative']);
const LIFECYCLES = new Set([
  'proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown',
]);
const SOURCE_KINDS = new Set(['nl', 'git', 'ast', 'todo', 'changelog', 'document', 'agent_log', 'test', 'system']);
const EPISTEMIC_CLASSES = new Set(['declaration', 'plan', 'claim', 'fact', 'inference', 'llm_inference']);
const RELATION_TYPES = new Set([
  'declares', 'plans', 'implements', 'modifies', 'tests', 'documents', 'releases', 'depends_on',
  'blocks', 'supersedes', 'contradicts', 'duplicates', 'evidenced_by', 'claimed_by', 'same_as', 'related_to',
]);
const CONCLUSION_KINDS = new Set(['finding', 'risk', 'decision', 'recommendation']);
const DIAGNOSTIC_SEVERITIES = new Set(['info', 'warning', 'review_required', 'blocking']);
const TODO_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const GENERATION_REQUESTED_MODES = new Set(['deterministic', 'prefer-llm', 'require-llm']);
const GENERATION_EFFECTIVE_MODES = new Set(['deterministic', 'llm']);
const RECORD_ID = /^INT-[A-Z]+-[a-f0-9]{20}$/;
const RELATION_ID = /^REL-[a-f0-9]{20}$/;
const DIAGNOSTIC_ID = /^DIAG-[a-f0-9]{20}$/;
const CONCLUSION_ID = /^CONC-[a-f0-9]{20}$/;
const TODO_PROPOSAL_ID = /^TPROP-[a-f0-9]{20}$/;
const CODE_CHANGE_PLAN_ID = /^CPLAN-[a-f0-9]{20}$/;
const CODE_CHANGE_ACTIONS = new Set(['create', 'modify', 'delete']);
const CODE_CHANGE_RISK_LEVELS = new Set(['low', 'medium', 'high']);
const FINGERPRINT = /^[a-f0-9]{64}$/;
const RUNTIME_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export interface GroundedValidationContext {
  graph: IntentGraph;
  diagnostics: DiagnosticReport;
}

export interface TodoProposalValidationContext extends GroundedValidationContext {
  conclusions: Conclusion[];
}

export interface CodeChangePlanValidationContext extends GroundedValidationContext {
  conclusions?: Conclusion[];
  proposals?: TodoProposal[];
}

export interface CodeChangeAcceptanceValidationContext {
  plan: CodeChangePlan;
  before: GroundedValidationContext;
  after: GroundedValidationContext;
}

export function assertIntentRecord(value: unknown): asserts value is IntentRecord {
  const record = objectValue(value, 'Intent record');
  exactKeys(record, ['schemaVersion', 'id', 'statement', 'lifecycle', 'source', 'epistemic', 'observedAt', 'metadata'], 'Intent record');
  if (record.schemaVersion !== 't2c.intent/v1') throw new Error('Unsupported intent schemaVersion');
  if (typeof record.id !== 'string' || !RECORD_ID.test(record.id)) throw new Error('Intent record id must match INT-<SOURCE>-<20 hex>');

  const statement = objectValue(record.statement, `Intent ${record.id}: statement`);
  exactKeys(statement, ['kind', 'actor', 'action', 'subject', 'object', 'target', 'modality', 'polarity', 'text'], `Intent ${record.id}: statement`);
  nonEmptyString(statement.kind, `Intent ${record.id}: statement.kind`);
  nullableString(statement.actor, `Intent ${record.id}: statement.actor`);
  enumValue(statement.action, ACTIONS, `Intent ${record.id}: statement.action`);
  nullableString(statement.subject, `Intent ${record.id}: statement.subject`);
  nonEmptyString(statement.object, `Intent ${record.id}: statement.object`);
  if (typeof statement.text !== 'string') throw new Error(`Intent ${record.id}: statement.text must be a string`);
  enumValue(statement.modality, MODALITIES, `Intent ${record.id}: statement.modality`);
  enumValue(statement.polarity, POLARITIES, `Intent ${record.id}: statement.polarity`);

  const target = objectValue(statement.target, `Intent ${record.id}: statement.target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `Intent ${record.id}: statement.target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `Intent ${record.id}: statement.target.${key}`, true);
  }

  const lifecycle = objectValue(record.lifecycle, `Intent ${record.id}: lifecycle`);
  exactKeys(lifecycle, ['status'], `Intent ${record.id}: lifecycle`);
  enumValue(lifecycle.status, LIFECYCLES, `Intent ${record.id}: lifecycle.status`);

  const source = objectValue(record.source, `Intent ${record.id}: source`);
  exactKeys(source, ['kind', 'path', 'lines', 'revision', 'symbol', 'commitIndex', 'extractor', 'contentHash', 'rawExcerpt'], `Intent ${record.id}: source`);
  enumValue(source.kind, SOURCE_KINDS, `Intent ${record.id}: source.kind`);
  nullableString(source.path, `Intent ${record.id}: source.path`);
  nullableString(source.revision, `Intent ${record.id}: source.revision`);
  nullableString(source.symbol, `Intent ${record.id}: source.symbol`);
  nullableString(source.rawExcerpt, `Intent ${record.id}: source.rawExcerpt`);
  nonEmptyString(source.extractor, `Intent ${record.id}: source.extractor`);
  if (typeof source.contentHash !== 'string' || !FINGERPRINT.test(source.contentHash)) {
    throw new Error(`Intent ${record.id}: source.contentHash must be SHA-256`);
  }
  if (source.commitIndex !== null && (!Number.isInteger(source.commitIndex) || (source.commitIndex as number) < 1)) {
    throw new Error(`Intent ${record.id}: source.commitIndex must be null or an integer >= 1`);
  }
  if (source.lines !== null) {
    const lines = objectValue(source.lines, `Intent ${record.id}: source.lines`);
    exactKeys(lines, ['start', 'end'], `Intent ${record.id}: source.lines`);
    if (!Number.isInteger(lines.start) || (lines.start as number) < 1 || !Number.isInteger(lines.end) || (lines.end as number) < (lines.start as number)) {
      throw new Error(`Intent ${record.id}: source.lines must be positive and end >= start`);
    }
  }

  const epistemic = objectValue(record.epistemic, `Intent ${record.id}: epistemic`);
  exactKeys(epistemic, ['class', 'confidence', 'basis'], `Intent ${record.id}: epistemic`);
  enumValue(epistemic.class, EPISTEMIC_CLASSES, `Intent ${record.id}: epistemic.class`);
  if (typeof epistemic.confidence !== 'number' || !Number.isFinite(epistemic.confidence)
    || epistemic.confidence < 0 || epistemic.confidence > 1) {
    throw new Error(`Intent ${record.id}: epistemic.confidence must be between 0 and 1`);
  }
  stringArray(epistemic.basis, `Intent ${record.id}: epistemic.basis`, true);
  nullableDate(record.observedAt, `Intent ${record.id}: observedAt`);

  const metadata = objectValue(record.metadata, `Intent ${record.id}: metadata`);
  if (!isJsonValue(metadata)) throw new Error(`Intent ${record.id}: metadata must contain JSON values only`);
  assertIntentGenerationMetadata(metadata.generation, `Intent ${record.id}: metadata.generation`);
  assertGenerationMatchesExtractor(metadata.generation, source.extractor as string, `Intent ${record.id}: metadata.generation`);
  if (epistemic.class === 'llm_inference'
    && (metadata.generation as { used: unknown }).used !== 'llm') {
    throw new Error(`Intent ${record.id}: llm_inference requires metadata.generation.used=llm`);
  }
}

function assertGenerationMatchesExtractor(value: unknown, extractor: string, name: string): void {
  const generation = value as { generator: string; generatorVersion: string };
  const separator = extractor.lastIndexOf('@');
  const expectedGenerator = separator > 0 ? extractor.slice(0, separator) : extractor;
  if (generation.generator !== expectedGenerator) {
    throw new Error(`${name}.generator must match source.extractor (${expectedGenerator})`);
  }
  if (separator > 0 && generation.generatorVersion !== extractor.slice(separator + 1)) {
    throw new Error(`${name}.generatorVersion must match source.extractor (${extractor.slice(separator + 1)})`);
  }
}

function assertIntentGenerationMetadata(value: unknown, name: string): void {
  const generation = objectValue(value, name);
  exactKeys(generation, [
    'generator', 'generatorVersion', 'runtimeVersion', 'requested', 'used', 'degraded',
    'fallbackReason', 'provider', 'model', 'responseId',
  ], name);
  nonBlankString(generation.generator, `${name}.generator`);
  nonBlankString(generation.generatorVersion, `${name}.generatorVersion`);
  if (typeof generation.runtimeVersion !== 'string' || !RUNTIME_VERSION.test(generation.runtimeVersion)) {
    throw new Error(`${name}.runtimeVersion must be a semantic version`);
  }
  enumValue(generation.requested, GENERATION_EFFECTIVE_MODES, `${name}.requested`);
  enumValue(generation.used, GENERATION_EFFECTIVE_MODES, `${name}.used`);
  if (typeof generation.degraded !== 'boolean') throw new Error(`${name}.degraded must be a boolean`);
  nullableString(generation.fallbackReason, `${name}.fallbackReason`);
  nullableString(generation.provider, `${name}.provider`);
  nullableString(generation.model, `${name}.model`);
  nullableString(generation.responseId, `${name}.responseId`);
  if (generation.used === 'llm') {
    nonBlankString(generation.provider, `${name}.provider`);
    nonBlankString(generation.model, `${name}.model`);
  } else if (generation.provider !== null || generation.model !== null || generation.responseId !== null) {
    throw new Error(`${name}: deterministic generation cannot claim an LLM provider, model or responseId`);
  }
  if (generation.degraded) {
    if (generation.requested !== 'llm' || generation.used !== 'deterministic') {
      throw new Error(`${name}: degraded generation must be an LLM request using deterministic fallback`);
    }
    nonBlankString(generation.fallbackReason, `${name}.fallbackReason`);
  } else if (generation.fallbackReason !== null) {
    throw new Error(`${name}.fallbackReason must be null when generation is not degraded`);
  }
}

export function assertIntentRecords(values: unknown): asserts values is IntentRecord[] {
  if (!Array.isArray(values)) throw new Error('Intent records must be an array');
  values.forEach(assertIntentRecord);
}

export function assertIntentGraph(value: unknown): asserts value is IntentGraph {
  const graph = objectValue(value, 'Intent graph');
  exactKeys(graph, ['schemaVersion', 'generatedAt', 'fingerprint', 'records', 'relations', 'stats'], 'Intent graph');
  if (graph.schemaVersion !== 't2c.graph/v1') throw new Error('Unsupported graph schemaVersion');
  dateString(graph.generatedAt, 'Graph generatedAt');
  fingerprint(graph.fingerprint, 'Graph fingerprint');
  assertIntentRecords(graph.records);
  if (!Array.isArray(graph.relations)) throw new Error('Graph relations must be an array');
  const recordIds = new Set((graph.records as IntentRecord[]).map((record) => record.id));
  if (recordIds.size !== (graph.records as IntentRecord[]).length) throw new Error('Graph record IDs must be unique');
  const relationIds = new Set<string>();
  for (const relation of graph.relations) {
    assertRelation(relation, recordIds);
    if (relationIds.has((relation as IntentRelation).id)) throw new Error(`Duplicate relation id: ${(relation as IntentRelation).id}`);
    relationIds.add((relation as IntentRelation).id);
  }
  const stats = objectValue(graph.stats, 'Graph stats');
  exactKeys(stats, ['bySource', 'byAction', 'byStatus'], 'Graph stats');
  countMap(stats.bySource, 'Graph stats.bySource');
  countMap(stats.byAction, 'Graph stats.byAction');
  countMap(stats.byStatus, 'Graph stats.byStatus');
  const records = graph.records as IntentRecord[];
  exactCounts(stats.bySource, countRecords(records, (record) => record.source.kind), 'Graph stats.bySource');
  exactCounts(stats.byAction, countRecords(records, (record) => record.statement.action), 'Graph stats.byAction');
  exactCounts(stats.byStatus, countRecords(records, (record) => record.lifecycle.status), 'Graph stats.byStatus');
  const expectedFingerprint = graphFingerprint(records, graph.relations as IntentRelation[]);
  if (graph.fingerprint !== expectedFingerprint) throw new Error('Graph fingerprint does not match records and relations');
}

export function assertIntentGraphDiff(value: unknown): asserts value is IntentGraphDiff {
  const diff = objectValue(value, 'Intent graph diff');
  exactKeys(diff, ['schemaVersion', 'generatedAt', 'fingerprint', 'beforeFingerprint', 'afterFingerprint', 'records', 'relations', 'summary'], 'Intent graph diff');
  if (diff.schemaVersion !== 't2c.diff/v1') throw new Error('Unsupported graph diff schemaVersion');
  dateString(diff.generatedAt, 'Graph diff generatedAt');
  fingerprint(diff.fingerprint, 'Graph diff fingerprint');
  fingerprint(diff.beforeFingerprint, 'Graph diff beforeFingerprint');
  fingerprint(diff.afterFingerprint, 'Graph diff afterFingerprint');

  const records = objectValue(diff.records, 'Graph diff records');
  exactKeys(records, ['added', 'removed', 'changed', 'unchanged'], 'Graph diff records');
  assertIntentRecords(records.added);
  assertIntentRecords(records.removed);
  if (!Array.isArray(records.changed)) throw new Error('Graph diff changed records must be an array');
  for (const rawChange of records.changed) {
    const change = objectValue(rawChange, 'Graph diff record change');
    exactKeys(change, ['identity', 'before', 'after', 'changedFields'], 'Graph diff record change');
    nonEmptyString(change.identity, 'Graph diff record change identity');
    assertIntentRecord(change.before);
    assertIntentRecord(change.after);
    stringArray(change.changedFields, 'Graph diff changedFields', true);
  }
  nonNegativeInteger(records.unchanged, 'Graph diff records.unchanged');

  const relations = objectValue(diff.relations, 'Graph diff relations');
  exactKeys(relations, ['added', 'removed', 'unchanged'], 'Graph diff relations');
  if (!Array.isArray(relations.added) || !Array.isArray(relations.removed)) throw new Error('Graph diff relation sets must be arrays');
  [...relations.added, ...relations.removed].forEach((relation) => assertRelation(relation));
  nonNegativeInteger(relations.unchanged, 'Graph diff relations.unchanged');

  const summary = objectValue(diff.summary, 'Graph diff summary');
  exactKeys(summary, ['recordsAdded', 'recordsRemoved', 'recordsChanged', 'recordsUnchanged', 'relationsAdded', 'relationsRemoved', 'relationsUnchanged'], 'Graph diff summary');
  for (const [key, count] of Object.entries(summary)) nonNegativeInteger(count, `Graph diff summary.${key}`);
  const expectedCounts: Record<string, number> = {
    recordsAdded: (records.added as unknown[]).length,
    recordsRemoved: (records.removed as unknown[]).length,
    recordsChanged: (records.changed as unknown[]).length,
    recordsUnchanged: records.unchanged as number,
    relationsAdded: (relations.added as unknown[]).length,
    relationsRemoved: (relations.removed as unknown[]).length,
    relationsUnchanged: relations.unchanged as number,
  };
  exactCounts(summary, expectedCounts, 'Graph diff summary');
}

export function assertConclusion(
  value: unknown,
  context: GroundedValidationContext,
): asserts value is Conclusion {
  const known = validateGroundedContext(context);
  assertConclusionValue(value, known.recordIds, known.diagnosticIds);
}

export function assertConclusions(
  values: unknown,
  context: GroundedValidationContext,
): asserts values is Conclusion[] {
  if (!Array.isArray(values)) throw new Error('Conclusions must be an array');
  const known = validateGroundedContext(context);
  const ids = new Set<string>();
  for (const value of values) {
    assertConclusionValue(value, known.recordIds, known.diagnosticIds);
    const id = (value as Conclusion).id;
    if (ids.has(id)) throw new Error(`Duplicate conclusion id: ${id}`);
    ids.add(id);
  }
}

export function assertTodoProposal(
  value: unknown,
  context: TodoProposalValidationContext,
): asserts value is TodoProposal {
  const known = validateTodoProposalContext(context);
  assertTodoProposalValue(value, known.recordIds, known.diagnosticIds, known.conclusionIds);
}

export function assertTodoProposals(
  values: unknown,
  context: TodoProposalValidationContext,
): asserts values is TodoProposal[] {
  if (!Array.isArray(values)) throw new Error('TODO proposals must be an array');
  const known = validateTodoProposalContext(context);
  const proposalIds = new Set<string>();
  for (const value of values) {
    assertTodoProposalValue(value, known.recordIds, known.diagnosticIds, known.conclusionIds);
    const id = (value as TodoProposal).id;
    if (proposalIds.has(id)) throw new Error(`Duplicate TODO proposal id: ${id}`);
    proposalIds.add(id);
  }
  for (const proposal of values as TodoProposal[]) {
    for (const dependency of proposal.dependencies) {
      if (!proposalIds.has(dependency)) {
        throw new Error(`TODO proposal ${proposal.id} references unknown dependency ${dependency}`);
      }
    }
  }
  assertAcyclicProposalDependencies(values as TodoProposal[]);
}

export function assertCodeChangePlan(
  value: unknown,
  context: CodeChangePlanValidationContext,
): asserts value is CodeChangePlan {
  const known = validateCodeChangePlanContext(context);
  assertCodeChangePlanValue(value, known);
  assertPlanGraphFingerprint(value, context.graph.fingerprint);
}

export function assertCodeChangePlans(
  values: unknown,
  context: CodeChangePlanValidationContext,
): asserts values is CodeChangePlan[] {
  if (!Array.isArray(values)) throw new Error('Code change plans must be an array');
  const known = validateCodeChangePlanContext(context);
  const ids = new Set<string>();
  for (const value of values) {
    assertCodeChangePlanValue(value, known);
    assertPlanGraphFingerprint(value, context.graph.fingerprint);
    const id = (value as CodeChangePlan).id;
    if (ids.has(id)) throw new Error(`Duplicate code change plan id: ${id}`);
    ids.add(id);
  }
}

/**
 * Validate a persisted plan before acceptance when its full conclusion and
 * TODO-proposal objects are no longer present. Their IDs remain syntax-checked
 * and content-bound by the plan hash; records and diagnostics stay grounded in
 * the supplied before graph.
 */
export function assertCodeChangePlanForAcceptance(
  value: unknown,
  context: GroundedValidationContext,
): asserts value is CodeChangePlan {
  const known = validateGroundedContext(context);
  const plan = objectValue(value, 'Code change plan');
  const evidence = objectValue(plan.evidence, 'Code change plan evidence');
  uniqueIdArray(evidence.conclusionIds, CONCLUSION_ID, 'Code change plan evidence.conclusionIds');
  uniqueIdArray(evidence.proposalIds, TODO_PROPOSAL_ID, 'Code change plan evidence.proposalIds');
  assertCodeChangePlanValue(value, {
    ...known,
    conclusionIds: new Set(evidence.conclusionIds as string[]),
    proposalIds: new Set(evidence.proposalIds as string[]),
  });
  assertPlanGraphFingerprint(value, context.graph.fingerprint);
}

function assertPlanGraphFingerprint(plan: CodeChangePlan, graphFingerprintValue: string): void {
  if (plan.evidence.graphFingerprint !== graphFingerprintValue) {
    throw new Error('Code change plan evidence.graphFingerprint does not match its graph');
  }
}

export function assertCodeChangeAcceptance(
  value: unknown,
  context: CodeChangeAcceptanceValidationContext,
): asserts value is CodeChangeAcceptance {
  assertCodeChangePlanForAcceptance(context.plan, context.before);
  const beforeKnown = validateGroundedContext(context.before);
  const afterKnown = validateGroundedContext(context.after);
  const acceptance = objectValue(value, 'Code change acceptance');
  exactKeys(acceptance, [
    'schemaVersion', 'planId', 'planHash', 'beforeGraphFingerprint', 'afterGraphFingerprint',
    'beforeDiagnosticIds', 'afterDiagnosticIds', 'clearedDiagnosticIds', 'remainingDiagnosticIds',
    'newBlockingDiagnosticIds', 'accepted', 'reasons', 'evaluatedAt', 'generation',
  ], 'Code change acceptance');
  if (acceptance.schemaVersion !== 't2c.code-change-acceptance/v1') {
    throw new Error('Unsupported code change acceptance schemaVersion');
  }
  if (acceptance.planId !== context.plan.id) throw new Error('Code change acceptance planId does not match its plan');
  if (acceptance.planHash !== context.plan.planHash) throw new Error('Code change acceptance planHash does not match its plan');
  if (acceptance.beforeGraphFingerprint !== context.before.graph.fingerprint) {
    throw new Error('Code change acceptance beforeGraphFingerprint does not match its graph');
  }
  if (acceptance.afterGraphFingerprint !== context.after.graph.fingerprint) {
    throw new Error('Code change acceptance afterGraphFingerprint does not match its graph');
  }
  for (const key of [
    'beforeDiagnosticIds', 'afterDiagnosticIds', 'clearedDiagnosticIds', 'remainingDiagnosticIds',
    'newBlockingDiagnosticIds',
  ] as const) {
    uniqueIdArray(acceptance[key], DIAGNOSTIC_ID, `Code change acceptance ${key}`);
  }
  const beforeIds = [...beforeKnown.diagnosticIds].sort();
  const afterIds = [...afterKnown.diagnosticIds].sort();
  const targeted = [...context.plan.evidence.diagnosticIds].sort();
  const expectedCleared = targeted.filter((id) => !afterKnown.diagnosticIds.has(id));
  const expectedRemaining = targeted.filter((id) => afterKnown.diagnosticIds.has(id));
  const expectedBlocking = context.after.diagnostics.diagnostics
    .filter((item) => item.severity === 'blocking' && !beforeKnown.diagnosticIds.has(item.id))
    .map((item) => item.id)
    .sort();
  exactStringSet(acceptance.beforeDiagnosticIds as string[], beforeIds, 'Code change acceptance beforeDiagnosticIds');
  exactStringSet(acceptance.afterDiagnosticIds as string[], afterIds, 'Code change acceptance afterDiagnosticIds');
  exactStringSet(acceptance.clearedDiagnosticIds as string[], expectedCleared, 'Code change acceptance clearedDiagnosticIds');
  exactStringSet(acceptance.remainingDiagnosticIds as string[], expectedRemaining, 'Code change acceptance remainingDiagnosticIds');
  exactStringSet(acceptance.newBlockingDiagnosticIds as string[], expectedBlocking, 'Code change acceptance newBlockingDiagnosticIds');
  const expectedAccepted = expectedRemaining.length === 0 && expectedBlocking.length === 0;
  if (acceptance.accepted !== expectedAccepted) throw new Error('Code change acceptance accepted flag is inconsistent');
  nonEmptyUniqueStringArray(acceptance.reasons, 'Code change acceptance reasons');
  dateString(acceptance.evaluatedAt, 'Code change acceptance evaluatedAt');
  assertGroundedGenerationMetadata(acceptance.generation, 'Code change acceptance generation');
  if ((acceptance.generation as GroundedGenerationMetadata).generatedAt !== acceptance.evaluatedAt) {
    throw new Error('Code change acceptance generation.generatedAt must match evaluatedAt');
  }
}

function assertConclusionValue(
  value: unknown,
  recordIds: Set<string>,
  diagnosticIds: Set<string>,
): asserts value is Conclusion {
  const conclusion = objectValue(value, 'Conclusion');
  exactKeys(conclusion, [
    'schemaVersion', 'id', 'kind', 'title', 'detail', 'severity', 'diagnosticIds', 'recordIds', 'confidence', 'generation',
  ], 'Conclusion');
  if (conclusion.schemaVersion !== 't2c.conclusion/v1') throw new Error('Unsupported conclusion schemaVersion');
  if (typeof conclusion.id !== 'string' || !CONCLUSION_ID.test(conclusion.id)) {
    throw new Error('Conclusion id must match CONC-<20 hex>');
  }
  enumValue(conclusion.kind, CONCLUSION_KINDS, `Conclusion ${conclusion.id}: kind`);
  nonBlankString(conclusion.title, `Conclusion ${conclusion.id}: title`);
  nonBlankString(conclusion.detail, `Conclusion ${conclusion.id}: detail`);
  enumValue(conclusion.severity, DIAGNOSTIC_SEVERITIES, `Conclusion ${conclusion.id}: severity`);
  nonEmptyUniqueIdArray(conclusion.diagnosticIds, DIAGNOSTIC_ID, `Conclusion ${conclusion.id}: diagnosticIds`);
  nonEmptyUniqueIdArray(conclusion.recordIds, RECORD_ID, `Conclusion ${conclusion.id}: recordIds`);
  knownReferences(conclusion.diagnosticIds as string[], diagnosticIds, `Conclusion ${conclusion.id}: diagnosticIds`);
  knownReferences(conclusion.recordIds as string[], recordIds, `Conclusion ${conclusion.id}: recordIds`);
  confidence(conclusion.confidence, `Conclusion ${conclusion.id}: confidence`);
  assertGroundedGenerationMetadata(conclusion.generation, `Conclusion ${conclusion.id}: generation`);
  const expectedId = createConclusionId(conclusion as unknown as Conclusion);
  if (conclusion.id !== expectedId) throw new Error(`Conclusion id does not match semantic content: expected ${expectedId}`);
}

function assertTodoProposalValue(
  value: unknown,
  recordIds: Set<string>,
  diagnosticIds: Set<string>,
  conclusionIds: Set<string>,
): asserts value is TodoProposal {
  const proposal = objectValue(value, 'TODO proposal');
  exactKeys(proposal, [
    'schemaVersion', 'id', 'title', 'description', 'priority', 'status', 'target', 'acceptanceCriteria',
    'dependencies', 'conclusionIds', 'diagnosticIds', 'recordIds', 'confidence', 'generation',
  ], 'TODO proposal');
  if (proposal.schemaVersion !== 't2c.todo-proposal/v1') throw new Error('Unsupported TODO proposal schemaVersion');
  if (typeof proposal.id !== 'string' || !TODO_PROPOSAL_ID.test(proposal.id)) {
    throw new Error('TODO proposal id must match TPROP-<20 hex>');
  }
  nonBlankString(proposal.title, `TODO proposal ${proposal.id}: title`);
  nonBlankString(proposal.description, `TODO proposal ${proposal.id}: description`);
  enumValue(proposal.priority, TODO_PRIORITIES, `TODO proposal ${proposal.id}: priority`);
  if (proposal.status !== 'proposed') throw new Error(`TODO proposal ${proposal.id}: status must be proposed`);
  const target = objectValue(proposal.target, `TODO proposal ${proposal.id}: target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `TODO proposal ${proposal.id}: target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `TODO proposal ${proposal.id}: target.${key}`, true);
    if ((target[key] as string[]).some((item) => !item.trim())) {
      throw new Error(`TODO proposal ${proposal.id}: target.${key} cannot contain blank values`);
    }
  }
  nonEmptyUniqueStringArray(proposal.acceptanceCriteria, `TODO proposal ${proposal.id}: acceptanceCriteria`);
  uniqueIdArray(proposal.dependencies, TODO_PROPOSAL_ID, `TODO proposal ${proposal.id}: dependencies`);
  if ((proposal.dependencies as string[]).includes(proposal.id as string)) {
    throw new Error(`TODO proposal ${proposal.id} cannot depend on itself`);
  }
  nonEmptyUniqueIdArray(proposal.conclusionIds, CONCLUSION_ID, `TODO proposal ${proposal.id}: conclusionIds`);
  nonEmptyUniqueIdArray(proposal.diagnosticIds, DIAGNOSTIC_ID, `TODO proposal ${proposal.id}: diagnosticIds`);
  nonEmptyUniqueIdArray(proposal.recordIds, RECORD_ID, `TODO proposal ${proposal.id}: recordIds`);
  knownReferences(proposal.conclusionIds as string[], conclusionIds, `TODO proposal ${proposal.id}: conclusionIds`);
  knownReferences(proposal.diagnosticIds as string[], diagnosticIds, `TODO proposal ${proposal.id}: diagnosticIds`);
  knownReferences(proposal.recordIds as string[], recordIds, `TODO proposal ${proposal.id}: recordIds`);
  confidence(proposal.confidence, `TODO proposal ${proposal.id}: confidence`);
  assertGroundedGenerationMetadata(proposal.generation, `TODO proposal ${proposal.id}: generation`);
  const expectedId = createTodoProposalId(proposal as unknown as TodoProposal);
  if (proposal.id !== expectedId) throw new Error(`TODO proposal id does not match semantic content: expected ${expectedId}`);
}

function assertGroundedGenerationMetadata(value: unknown, name: string): asserts value is GroundedGenerationMetadata {
  const generation = objectValue(value, name);
  exactKeys(generation, [
    'generator', 'generatorVersion', 'runtimeVersion', 'generatedAt', 'requestedMode', 'effectiveMode',
    'degraded', 'model', 'provider', 'responseId', 'configurationFingerprint', 'reason',
  ], name);
  nonBlankString(generation.generator, `${name}.generator`);
  nonBlankString(generation.generatorVersion, `${name}.generatorVersion`);
  if (typeof generation.runtimeVersion !== 'string' || !RUNTIME_VERSION.test(generation.runtimeVersion)) {
    throw new Error(`${name}.runtimeVersion must be a semantic version`);
  }
  dateString(generation.generatedAt, `${name}.generatedAt`);
  enumValue(generation.requestedMode, GENERATION_REQUESTED_MODES, `${name}.requestedMode`);
  enumValue(generation.effectiveMode, GENERATION_EFFECTIVE_MODES, `${name}.effectiveMode`);
  if (typeof generation.degraded !== 'boolean') throw new Error(`${name}.degraded must be a boolean`);
  nullableString(generation.model, `${name}.model`);
  nullableString(generation.provider, `${name}.provider`);
  nullableString(generation.responseId, `${name}.responseId`);
  fingerprint(generation.configurationFingerprint, `${name}.configurationFingerprint`);
  nullableString(generation.reason, `${name}.reason`);

  if (generation.effectiveMode === 'llm') {
    nonBlankString(generation.model, `${name}.model`);
    nonBlankString(generation.provider, `${name}.provider`);
    if (generation.degraded) throw new Error(`${name}.degraded must be false when effectiveMode is llm`);
  }
  if (generation.requestedMode === 'deterministic') {
    if (generation.effectiveMode !== 'deterministic' || generation.degraded
      || generation.model !== null || generation.provider !== null || generation.responseId !== null
      || generation.reason !== null) {
      throw new Error(`${name} deterministic mode cannot contain LLM or degradation metadata`);
    }
  }
  if (generation.requestedMode === 'require-llm' && generation.effectiveMode !== 'llm') {
    throw new Error(`${name} require-llm mode cannot use deterministic output`);
  }
  if (generation.requestedMode === 'prefer-llm' && generation.effectiveMode === 'deterministic' && !generation.degraded) {
    throw new Error(`${name} prefer-llm deterministic output must be marked degraded`);
  }
  if (generation.degraded) {
    if (generation.requestedMode !== 'prefer-llm' || generation.effectiveMode !== 'deterministic') {
      throw new Error(`${name} degraded output is only valid for prefer-llm deterministic fallback`);
    }
    nonBlankString(generation.reason, `${name}.reason`);
  } else if (generation.reason !== null) {
    throw new Error(`${name}.reason must be null when output is not degraded`);
  }
}

function validateGroundedContext(context: GroundedValidationContext): {
  recordIds: Set<string>;
  diagnosticIds: Set<string>;
} {
  assertIntentGraph(context.graph);
  const report = objectValue(context.diagnostics, 'Diagnostic report');
  if (report.schemaVersion !== 't2c.diagnostics/v1') throw new Error('Unsupported diagnostic schemaVersion');
  if (report.graphFingerprint !== context.graph.fingerprint) {
    throw new Error('Diagnostic report does not describe the supplied graph');
  }
  if (!Array.isArray(report.diagnostics)) throw new Error('Diagnostic report diagnostics must be an array');
  const diagnosticIds = new Set<string>();
  for (const value of report.diagnostics) {
    const diagnostic = objectValue(value, 'Diagnostic');
    if (typeof diagnostic.id !== 'string' || !DIAGNOSTIC_ID.test(diagnostic.id)) {
      throw new Error('Diagnostic id must match DIAG-<20 hex>');
    }
    if (diagnosticIds.has(diagnostic.id)) throw new Error(`Duplicate diagnostic id: ${diagnostic.id}`);
    diagnosticIds.add(diagnostic.id);
  }
  return {
    recordIds: new Set(context.graph.records.map((record) => record.id)),
    diagnosticIds,
  };
}

function validateTodoProposalContext(context: TodoProposalValidationContext): {
  recordIds: Set<string>;
  diagnosticIds: Set<string>;
  conclusionIds: Set<string>;
} {
  const known = validateGroundedContext(context);
  assertConclusions(context.conclusions, context);
  return {
    ...known,
    conclusionIds: new Set(context.conclusions.map((conclusion) => conclusion.id)),
  };
}

function validateCodeChangePlanContext(context: CodeChangePlanValidationContext): {
  recordIds: Set<string>;
  diagnosticIds: Set<string>;
  conclusionIds: Set<string>;
  proposalIds: Set<string>;
} {
  const known = validateGroundedContext(context);
  const conclusions = context.conclusions ?? [];
  const proposals = context.proposals ?? [];
  if (conclusions.length) assertConclusions(conclusions, context);
  // Full proposal contracts need conclusions. When only proposal IDs are
  // supplied as evidence references, accept the IDs after a light shape check.
  if (proposals.length && conclusions.length) {
    assertTodoProposals(proposals, { graph: context.graph, diagnostics: context.diagnostics, conclusions });
  } else if (proposals.length) {
    const referencedConclusionIds = new Set<string>();
    for (const [index, value] of proposals.entries()) {
      const proposal = objectValue(value, `TODO proposal reference[${index}]`);
      uniqueIdArray(proposal.conclusionIds, CONCLUSION_ID, `TODO proposal reference[${index}].conclusionIds`);
      for (const id of proposal.conclusionIds as string[]) referencedConclusionIds.add(id);
    }
    const proposalIds = new Set<string>();
    for (const proposal of proposals) {
      assertTodoProposalValue(
        proposal,
        known.recordIds,
        known.diagnosticIds,
        referencedConclusionIds,
      );
      if (proposalIds.has(proposal.id)) throw new Error(`Duplicate TODO proposal id: ${proposal.id}`);
      proposalIds.add(proposal.id);
    }
  }
  return {
    ...known,
    conclusionIds: new Set(conclusions.map((item) => item.id)),
    proposalIds: new Set(proposals.map((item) => item.id)),
  };
}

function assertCodeChangePlanValue(
  value: unknown,
  known: {
    recordIds: Set<string>;
    diagnosticIds: Set<string>;
    conclusionIds: Set<string>;
    proposalIds: Set<string>;
  },
): asserts value is CodeChangePlan {
  const plan = objectValue(value, 'Code change plan');
  exactKeys(plan, [
    'schemaVersion', 'id', 'planHash', 'status', 'createdAt', 'title', 'description', 'priority',
    'target', 'acceptanceCriteria', 'changes', 'risk', 'rollback', 'evidence', 'confidence', 'generation',
  ], 'Code change plan');
  if (plan.schemaVersion !== 't2c.code-change-plan/v1') {
    throw new Error('Unsupported code change plan schemaVersion');
  }
  if (typeof plan.id !== 'string' || !CODE_CHANGE_PLAN_ID.test(plan.id)) {
    throw new Error('Code change plan id must match CPLAN-<20 hex>');
  }
  fingerprint(plan.planHash, `Code change plan ${plan.id}: planHash`);
  if (plan.status !== 'proposed') throw new Error(`Code change plan ${plan.id}: status must be proposed`);
  dateString(plan.createdAt, `Code change plan ${plan.id}: createdAt`);
  nonBlankString(plan.title, `Code change plan ${plan.id}: title`);
  nonBlankString(plan.description, `Code change plan ${plan.id}: description`);
  enumValue(plan.priority, TODO_PRIORITIES, `Code change plan ${plan.id}: priority`);
  const target = objectValue(plan.target, `Code change plan ${plan.id}: target`);
  exactKeys(target, ['paths', 'symbols', 'tickets', 'versions'], `Code change plan ${plan.id}: target`);
  for (const key of ['paths', 'symbols', 'tickets', 'versions'] as const) {
    stringArray(target[key], `Code change plan ${plan.id}: target.${key}`, true);
    if ((target[key] as string[]).some((item) => !item.trim())) {
      throw new Error(`Code change plan ${plan.id}: target.${key} cannot contain blank values`);
    }
  }
  const targetPaths = new Set((target.paths as string[]).map((item, index) => (
    repositoryPath(item, `Code change plan ${plan.id}: target.paths[${index}]`)
  )));
  nonEmptyUniqueStringArray(plan.acceptanceCriteria, `Code change plan ${plan.id}: acceptanceCriteria`);
  if (!Array.isArray(plan.changes) || plan.changes.length === 0) {
    throw new Error(`Code change plan ${plan.id}: changes must be a non-empty array`);
  }
  const changePaths = new Set<string>();
  for (const [index, rawChange] of plan.changes.entries()) {
    const change = objectValue(rawChange, `Code change plan ${plan.id}: changes[${index}]`);
    exactKeys(change, ['path', 'action', 'symbols', 'rationale'], `Code change plan ${plan.id}: changes[${index}]`);
    nonBlankString(change.path, `Code change plan ${plan.id}: changes[${index}].path`);
    const normalizedPath = repositoryPath(change.path, `Code change plan ${plan.id}: changes[${index}].path`);
    if (!targetPaths.has(normalizedPath)) {
      throw new Error(`Code change plan ${plan.id}: changes[${index}].path is not present in target.paths`);
    }
    enumValue(change.action, CODE_CHANGE_ACTIONS, `Code change plan ${plan.id}: changes[${index}].action`);
    stringArray(change.symbols, `Code change plan ${plan.id}: changes[${index}].symbols`, true);
    if ((change.symbols as string[]).some((item) => !item.trim())) {
      throw new Error(`Code change plan ${plan.id}: changes[${index}].symbols cannot contain blank values`);
    }
    nonBlankString(change.rationale, `Code change plan ${plan.id}: changes[${index}].rationale`);
    if (changePaths.has(normalizedPath)) {
      throw new Error(`Code change plan ${plan.id}: duplicate change for ${normalizedPath}`);
    }
    changePaths.add(normalizedPath);
  }
  const risk = objectValue(plan.risk, `Code change plan ${plan.id}: risk`);
  exactKeys(risk, ['level', 'reasons'], `Code change plan ${plan.id}: risk`);
  enumValue(risk.level, CODE_CHANGE_RISK_LEVELS, `Code change plan ${plan.id}: risk.level`);
  nonEmptyUniqueStringArray(risk.reasons, `Code change plan ${plan.id}: risk.reasons`);
  nonBlankString(plan.rollback, `Code change plan ${plan.id}: rollback`);
  const evidence = objectValue(plan.evidence, `Code change plan ${plan.id}: evidence`);
  exactKeys(evidence, [
    'graphFingerprint', 'recordIds', 'diagnosticIds', 'conclusionIds', 'proposalIds',
  ], `Code change plan ${plan.id}: evidence`);
  fingerprint(evidence.graphFingerprint, `Code change plan ${plan.id}: evidence.graphFingerprint`);
  nonEmptyUniqueIdArray(evidence.recordIds, RECORD_ID, `Code change plan ${plan.id}: evidence.recordIds`);
  nonEmptyUniqueIdArray(evidence.diagnosticIds, DIAGNOSTIC_ID, `Code change plan ${plan.id}: evidence.diagnosticIds`);
  uniqueIdArray(evidence.conclusionIds, CONCLUSION_ID, `Code change plan ${plan.id}: evidence.conclusionIds`);
  uniqueIdArray(evidence.proposalIds, TODO_PROPOSAL_ID, `Code change plan ${plan.id}: evidence.proposalIds`);
  knownReferences(evidence.recordIds as string[], known.recordIds, `Code change plan ${plan.id}: evidence.recordIds`);
  knownReferences(evidence.diagnosticIds as string[], known.diagnosticIds, `Code change plan ${plan.id}: evidence.diagnosticIds`);
  knownReferences(evidence.conclusionIds as string[], known.conclusionIds, `Code change plan ${plan.id}: evidence.conclusionIds`);
  knownReferences(evidence.proposalIds as string[], known.proposalIds, `Code change plan ${plan.id}: evidence.proposalIds`);
  confidence(plan.confidence, `Code change plan ${plan.id}: confidence`);
  assertGroundedGenerationMetadata(plan.generation, `Code change plan ${plan.id}: generation`);

  const semantic = plan as unknown as CodeChangePlan;
  const expectedHash = createCodeChangePlanHash(semantic);
  if (plan.planHash !== expectedHash) {
    throw new Error(`Code change plan planHash does not match semantic content: expected ${expectedHash}`);
  }
  const expectedId = createCodeChangePlanId(semantic);
  if (plan.id !== expectedId) {
    throw new Error(`Code change plan id does not match semantic content: expected ${expectedId}`);
  }
}

function assertRelation(value: unknown, knownRecords?: Set<string>): asserts value is IntentRelation {
  const relation = objectValue(value, 'Intent relation');
  exactKeys(relation, ['id', 'from', 'to', 'type', 'confidence', 'basis'], 'Intent relation');
  if (typeof relation.id !== 'string' || !RELATION_ID.test(relation.id)) throw new Error('Intent relation id must match REL-<20 hex>');
  nonEmptyString(relation.from, `Relation ${relation.id}: from`);
  nonEmptyString(relation.to, `Relation ${relation.id}: to`);
  enumValue(relation.type, RELATION_TYPES, `Relation ${relation.id}: type`);
  if (typeof relation.confidence !== 'number' || !Number.isFinite(relation.confidence)
    || relation.confidence < 0 || relation.confidence > 1) {
    throw new Error(`Relation ${relation.id}: confidence must be between 0 and 1`);
  }
  stringArray(relation.basis, `Relation ${relation.id}: basis`, true);
  if (knownRecords && (!knownRecords.has(relation.from as string) || !knownRecords.has(relation.to as string))) {
    throw new Error(`Relation ${relation.id} references unknown records`);
  }
}

function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[], name: string): void {
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !expectedSet.has(key));
  if (missing.length) throw new Error(`${name} is missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`${name} has unsupported fields: ${extra.join(', ')}`);
}

function nonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.length) throw new Error(`${name} must be a non-empty string`);
}

function nonBlankString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim().length) throw new Error(`${name} must be a non-blank string`);
}

function nullableString(value: unknown, name: string): void {
  if (value !== null && typeof value !== 'string') throw new Error(`${name} must be a string or null`);
}

function enumValue(value: unknown, allowed: Set<string>, name: string): asserts value is string {
  if (typeof value !== 'string' || !allowed.has(value)) throw new Error(`${name} has unsupported value: ${String(value)}`);
}

function stringArray(value: unknown, name: string, unique = false): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error(`${name} must be an array of strings`);
  if (unique && new Set(value).size !== value.length) throw new Error(`${name} must contain unique values`);
}

function nonEmptyUniqueStringArray(value: unknown, name: string): asserts value is string[] {
  stringArray(value, name, true);
  if (!value.length || value.some((item) => !item.trim().length)) {
    throw new Error(`${name} must contain at least one non-blank string`);
  }
  if (new Set(value.map((item) => item.trim())).size !== value.length) {
    throw new Error(`${name} must remain unique after trimming whitespace`);
  }
}

function repositoryPath(value: unknown, name: string): string {
  nonBlankString(value, name);
  const normalized = value.trim().replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.split('/').some((part) => part === '..')) {
    throw new Error(`${name} must be a relative repository path without parent traversal`);
  }
  return normalized;
}

function exactStringSet(actual: string[], expected: string[], name: string): void {
  const normalizedActual = [...actual].sort();
  if (normalizedActual.length !== expected.length
    || normalizedActual.some((value, index) => value !== expected[index])) {
    throw new Error(`${name} does not match the grounded diagnostic set`);
  }
}

function uniqueIdArray(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  stringArray(value, name, true);
  if (value.some((item) => !pattern.test(item))) throw new Error(`${name} contains an invalid id`);
}

function nonEmptyUniqueIdArray(value: unknown, pattern: RegExp, name: string): asserts value is string[] {
  uniqueIdArray(value, pattern, name);
  if (!value.length) throw new Error(`${name} must contain at least one id`);
}

function knownReferences(values: string[], known: Set<string>, name: string): void {
  const unknown = values.filter((value) => !known.has(value));
  if (unknown.length) throw new Error(`${name} references unknown ids: ${unknown.join(', ')}`);
}

function confidence(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

function assertAcyclicProposalDependencies(proposals: TodoProposal[]): void {
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, chain: string[]): void => {
    if (visiting.has(id)) {
      const start = chain.indexOf(id);
      throw new Error(`TODO proposal dependency cycle: ${[...chain.slice(Math.max(0, start)), id].join(' -> ')}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const proposal of proposals) visit(proposal.id, []);
}

function dateString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} must be an ISO date-time string`);
  }
}

function nullableDate(value: unknown, name: string): void {
  if (value !== null) dateString(value, name);
}

function fingerprint(value: unknown, name: string): void {
  if (typeof value !== 'string' || !FINGERPRINT.test(value)) throw new Error(`${name} must be SHA-256`);
}

function nonNegativeInteger(value: unknown, name: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${name} must be an integer >= 0`);
}

function countMap(value: unknown, name: string): void {
  const map = objectValue(value, name);
  for (const [key, count] of Object.entries(map)) {
    if (!key) throw new Error(`${name} keys must be non-empty`);
    nonNegativeInteger(count, `${name}.${key}`);
  }
}

function countRecords(records: IntentRecord[], selector: (record: IntentRecord) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const key = selector(record);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function exactCounts(value: unknown, expected: Record<string, number>, name: string): void {
  const actual = objectValue(value, name);
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${name} is inconsistent for ${key}: expected ${expected[key] ?? 0}, received ${String(actual[key] ?? 0)}`);
    }
  }
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
}
