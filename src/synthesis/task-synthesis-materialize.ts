import { groundRecordIdsByDiagnostics } from '../core/grounding.js';
import { createConclusionId, createTodoProposalId } from '../core/id.js';
import { assertConclusions, assertTodoProposals } from '../core/schema.js';
import { normalizeTarget } from '../core/target.js';
import type {
  Conclusion,
  DiagnosticReport,
  GroundedGenerationMetadata,
  IntentGraph,
  TodoProposal,
} from '../core/types.js';
import { TASK_SYNTHESIS_RESPONSE_CONTRACT } from './task-synthesis-contract.js';

export function materializeTaskSynthesisResponse(
  response: unknown,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  generation: GroundedGenerationMetadata,
): { conclusions: Conclusion[]; proposals: TodoProposal[] } {
  const parsed = TASK_SYNTHESIS_RESPONSE_CONTRACT.parse(response);
  const conclusionKeys = normalizeLocalKeys(
    parsed.conclusions,
    'conclusion',
    parsed.proposals.flatMap((proposal) => proposal.conclusionKeys),
  );
  const proposalKeys = normalizeLocalKeys(
    parsed.proposals,
    'proposal',
    parsed.proposals.flatMap((proposal) => proposal.dependencyKeys),
  );
  const conclusions = parsed.conclusions.map((raw): Conclusion => {
    const diagnosticIds = sortedUnique(raw.diagnosticIds);
    const content: Omit<Conclusion, 'id'> = {
      schemaVersion: 't2c.conclusion/v1',
      kind: raw.kind,
      title: raw.title,
      detail: raw.detail,
      severity: raw.severity,
      diagnosticIds,
      recordIds: groundRecordIdsByDiagnostics(diagnosticIds, normalizeStringArray(raw.recordIds), diagnostics),
      confidence: raw.confidence,
      generation,
    };
    return { ...content, id: createConclusionId(content) };
  });
  const conclusionIdByKey = new Map(conclusionKeys.map((key, index) => [key, conclusions[index]!.id]));
  const conclusionByKey = new Map(conclusionKeys.map((key, index) => [key, conclusions[index]!]));

  const proposalDrafts = parsed.proposals.map((raw): TodoProposal => {
    const conclusionKeys = normalizeStringArray(raw.conclusionKeys);
    const citedConclusions = conclusionKeys.map((key) => {
      const conclusion = conclusionByKey.get(key);
      if (!conclusion) throw new Error(`Invalid structured task synthesis response: proposal ${raw.key} conclusionKeys references unknown key ${key}`);
      return conclusion;
    });
    const content: Omit<TodoProposal, 'id'> = {
      schemaVersion: 't2c.todo-proposal/v1',
      title: raw.title,
      description: raw.description,
      priority: raw.priority,
      status: 'proposed',
      target: normalizeRawTarget(raw.target),
      acceptanceCriteria: normalizeAcceptanceCriteria(raw.acceptanceCriteria, raw.description),
      dependencies: [],
      conclusionIds: mapKeys(conclusionKeys, conclusionIdByKey, `proposal ${raw.key} conclusionKeys`),
      // Proposal citations duplicate its conclusion citations in the provider
      // schema. Derive them from already validated conclusion keys so a model
      // cannot smuggle in a fabricated ID through the redundant fields.
      diagnosticIds: sortedUnique(citedConclusions.flatMap((conclusion) => conclusion.diagnosticIds)),
      recordIds: sortedUnique(citedConclusions.flatMap((conclusion) => conclusion.recordIds)),
      confidence: raw.confidence,
      generation,
    };
    return { ...content, id: createTodoProposalId(content) };
  });
  const proposalIdByKey = new Map(proposalKeys.map((key, index) => [key, proposalDrafts[index]!.id]));
  const proposals = proposalDrafts.map((proposal, index): TodoProposal => ({
    ...proposal,
    dependencies: mapKeys(
      parsed.proposals[index]!.dependencyKeys,
      proposalIdByKey,
      `proposal ${parsed.proposals[index]!.key} dependencyKeys`,
    ),
  }));

  assertConclusions(conclusions, { graph, diagnostics });
  assertTodoProposals(proposals, { graph, diagnostics, conclusions });
  assertProposalEvidenceMatchesConclusions(proposals, conclusions);
  return { conclusions, proposals };
}

function normalizeLocalKeys(
  values: Array<{ key: string }>,
  name: string,
  references: string[],
): string[] {
  const explicit = values
    .map((value) => typeof value.key === 'string' ? value.key.trim() : '')
    .filter(Boolean);
  if (new Set(explicit).size !== explicit.length) {
    throw new Error(`Invalid structured task synthesis response: duplicate ${name} key`);
  }
  const reserved = new Set(explicit);
  const keys = new Set<string>();
  const hasBlankKey = explicit.length !== values.length;
  if (hasBlankKey && references.some((reference) => !reference.trim())) {
    throw new Error(`Invalid structured task synthesis response: blank ${name} key is referenced`);
  }
  return values.map((value, index) => {
    let key = typeof value.key === 'string' ? value.key.trim() : '';
    if (!key) {
      let suffix = index + 1;
      do key = `${name}-${suffix++}`; while (reserved.has(key) || keys.has(key));
    }
    if (keys.has(key)) throw new Error(`Invalid structured task synthesis response: duplicate ${name} key ${key}`);
    keys.add(key);
    return key;
  });
}

function mapKeys(values: unknown, ids: Map<string, string>, name: string): string[] {
  const keys = normalizeStringArray(values);
  return sortedUnique(keys.map((key) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Invalid structured task synthesis response: ${name} references unknown key ${key}`);
    return id;
  }));
}

function sortedUnique(values: unknown): string[] {
  return [...new Set(normalizeStringArray(values))].sort((left, right) => left.localeCompare(right));
}

function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRawTarget(value: unknown): ReturnType<typeof normalizeTarget> {
  const target = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return normalizeTarget({
    paths: normalizeStringArray(target.paths),
    symbols: normalizeStringArray(target.symbols),
    tickets: normalizeStringArray(target.tickets),
    versions: normalizeStringArray(target.versions),
  });
}

function normalizeAcceptanceCriteria(value: unknown, description: unknown): string[] {
  const criteria = sortedUnique(value);
  if (criteria.length > 0) return criteria;
  const source = typeof description === 'string' ? description.trim() : '';
  return source ? [`Verify: ${source}`] : [];
}

function assertProposalEvidenceMatchesConclusions(proposals: TodoProposal[], conclusions: Conclusion[]): void {
  const byId = new Map(conclusions.map((conclusion) => [conclusion.id, conclusion]));
  for (const proposal of proposals) {
    const cited = proposal.conclusionIds.map((id) => byId.get(id)).filter((value): value is Conclusion => Boolean(value));
    const diagnostics = new Set(cited.flatMap((conclusion) => conclusion.diagnosticIds));
    const records = new Set(cited.flatMap((conclusion) => conclusion.recordIds));
    if (proposal.diagnosticIds.some((id) => !diagnostics.has(id))) {
      throw new Error(`Invalid structured task synthesis response: proposal ${proposal.id} cites diagnostics outside its conclusions`);
    }
    if (proposal.recordIds.some((id) => !records.has(id))) {
      throw new Error(`Invalid structured task synthesis response: proposal ${proposal.id} cites records outside its conclusions`);
    }
  }
}
