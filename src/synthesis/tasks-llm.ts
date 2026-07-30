import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConclusionId, createTodoProposalId, sha256, stableStringify } from '../core/id.js';
import { pathExists } from '../core/io.js';
import { assertConclusions, assertTodoProposals } from '../core/schema.js';
import { normalizeTarget } from '../core/target.js';
import type {
  Conclusion,
  ConclusionKind,
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentRecord,
  LlmResponseMetadata,
  PipelineStageAudit,
  TodoPriority,
  TodoProposal,
} from '../core/types.js';
import type { T2CConfig } from '../config/env.js';
import { classifyLlmFailure, type LlmFailureReason } from '../llm/failure.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { T2C_VERSION } from '../version.js';
import {
  validateAndClassifyTodoProposals,
  type TodoProposalValidationResult,
} from './validation.js';

export type TaskSynthesisMode = 'prefer-llm' | 'require-llm';

export interface RawDiagnosticAction {
  diagnosticId: string;
  recordIds: string[];
  suggestedAction: string;
}

export interface AuditedTaskSynthesisResult {
  schemaVersion: 't2c.task-synthesis/v1';
  conclusions: Conclusion[];
  proposals: TodoProposal[];
  validation: TodoProposalValidationResult;
  rawDiagnosticActions: RawDiagnosticAction[];
  warnings: string[];
  audit: PipelineStageAudit;
}

export class TaskSynthesisRequiredError extends Error {
  constructor(message: string, readonly audit: PipelineStageAudit) {
    super(message);
    this.name = 'TaskSynthesisRequiredError';
  }
}

class TaskSynthesisAttemptError extends Error {
  constructor(readonly failure: unknown, readonly responses: LlmResponseMetadata[]) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'TaskSynthesisAttemptError';
  }
}

interface RawConclusion {
  key: string;
  kind: ConclusionKind;
  title: string;
  detail: string;
  severity: DiagnosticSeverity;
  diagnosticIds: string[];
  recordIds: string[];
  confidence: number;
}

interface RawProposal {
  key: string;
  title: string;
  description: string;
  priority: TodoPriority;
  target: { paths: string[]; symbols: string[]; tickets: string[]; versions: string[] };
  acceptanceCriteria: string[];
  dependencyKeys: string[];
  conclusionKeys: string[];
  diagnosticIds: string[];
  recordIds: string[];
  confidence: number;
}

interface RawTaskSynthesisResponse {
  conclusions: RawConclusion[];
  proposals: RawProposal[];
}

export async function synthesizeTodoProposals(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  config: T2CConfig,
  mode: TaskSynthesisMode = 'prefer-llm',
): Promise<AuditedTaskSynthesisResult> {
  const startedAt = Date.now();
  // An empty conclusion collection is still enough to validate that both
  // inputs form one coherent evidence context before any provider call.
  assertConclusions([], { graph, diagnostics });
  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    return fallbackOrThrow(graph, diagnostics, config, mode, startedAt, {
      code: 'LLM_NOT_CONFIGURED',
      message: 'OPENROUTER_API_KEY is not configured',
    });
  }

  try {
    const prompt = await readPrompt('tasks-from-dsl.system.md');
    const payload = JSON.stringify(compactSynthesisPayload(graph, diagnostics));
    const { output, responses } = await synthesizeWithCorrection(
      client, config, mode, prompt, payload, graph, diagnostics,
    );
    return {
      schemaVersion: 't2c.task-synthesis/v1',
      ...output,
      validation: validateAndClassifyTodoProposals(output.proposals, { graph, diagnostics, conclusions: output.conclusions }),
      rawDiagnosticActions: [],
      warnings: [],
      audit: synthesisAudit(
        'succeeded', 'llm', false, output.conclusions.length + output.proposals.length,
        0, null, Date.now() - startedAt, responses, config,
      ),
    };
  } catch (error) {
    const failure = error instanceof TaskSynthesisAttemptError ? error.failure : error;
    const responses = error instanceof TaskSynthesisAttemptError ? error.responses : [];
    return fallbackOrThrow(
      graph, diagnostics, config, mode, startedAt, classifyLlmFailure(failure), responses,
    );
  }
}

/**
 * Calls the model, and on a grounding rejection gives it exactly one corrective
 * attempt with the specific error quoted back.
 *
 * Measured on `make demollm`: the model fabricates a well-formed but non-existent
 * record ID often enough that only 1 of 6 runs completed. The runtime is right to
 * reject those — an invented citation is precisely what this contract exists to
 * stop — but failing the whole pipeline on the first miss throws away four
 * already-successful LLM stages. One bounded retry does not weaken grounding:
 * the same validation still runs, and a second fabrication still fails the run.
 */
async function synthesizeWithCorrection(
  client: OpenRouterClient,
  config: T2CConfig,
  mode: TaskSynthesisMode,
  systemPrompt: string,
  payload: string,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
): Promise<{
  output: { conclusions: Conclusion[]; proposals: TodoProposal[] };
  responses: LlmResponseMetadata[];
}> {
  const responses: LlmResponseMetadata[] = [];
  let correction: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: payload },
      ...(correction
        ? [{
            role: 'user' as const,
            content: `The previous response was rejected: ${correction}\n`
              + 'Every diagnosticIds and recordIds entry must appear verbatim in the input above.'
              + ' Re-emit the full object using only identifiers copied from it.',
          }]
        : []),
    ];
    let completion;
    try {
      completion = await client.chatJsonWithMetadata<RawTaskSynthesisResponse>(
        messages, 't2c_grounded_task_synthesis', responseSchema(), config.openRouter.taskModel,
      );
    } catch (error) {
      throw new TaskSynthesisAttemptError(error, [...responses]);
    }
    responses.push(completion.metadata);
    try {
      const generation = generationMetadata(config, mode, completion.metadata);
      return { output: materializeResponse(completion.value, graph, diagnostics, generation), responses };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const wrapped = message.startsWith('Invalid structured task synthesis response:')
        ? message
        : `Invalid structured task synthesis response: ${message}`;
      if (attempt === 1) throw new TaskSynthesisAttemptError(new Error(wrapped), [...responses]);
      correction = message;
    }
  }

  throw new Error('Invalid structured task synthesis response: retry budget exhausted');
}

function materializeResponse(
  response: RawTaskSynthesisResponse,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  generation: GroundedGenerationMetadata,
): { conclusions: Conclusion[]; proposals: TodoProposal[] } {
  if (!Array.isArray(response?.conclusions) || !Array.isArray(response?.proposals)) {
    const keys = response && typeof response === 'object' ? Object.keys(response).sort() : [];
    throw new Error(
      'Invalid structured task synthesis response: conclusions and proposals must be arrays'
      + ` (returned keys: ${keys.length > 0 ? keys.join(', ') : 'none'})`,
    );
  }
  const conclusionKeys = uniqueKeys(response.conclusions, 'conclusion');
  const proposalKeys = uniqueKeys(response.proposals, 'proposal');
  const conclusions = response.conclusions.map((raw): Conclusion => {
    const content: Omit<Conclusion, 'id'> = {
      schemaVersion: 't2c.conclusion/v1',
      kind: normalizeConclusionKind(raw.kind),
      title: raw.title,
      detail: raw.detail,
      severity: normalizeSeverity(raw.severity),
      diagnosticIds: sortedUnique(raw.diagnosticIds),
      recordIds: sortedUnique(raw.recordIds),
      confidence: normalizeConfidence(raw.confidence),
      generation,
    };
    return { ...content, id: createConclusionId(content) };
  });
  const conclusionIdByKey = new Map(response.conclusions.map((raw, index) => [raw.key, conclusions[index]!.id]));
  const conclusionByKey = new Map(response.conclusions.map((raw, index) => [raw.key, conclusions[index]!]));

  const proposalDrafts = response.proposals.map((raw): TodoProposal => {
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
      priority: normalizePriority(raw.priority),
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
      confidence: normalizeConfidence(raw.confidence),
      generation,
    };
    return { ...content, id: createTodoProposalId(content) };
  });
  const proposalIdByKey = new Map(response.proposals.map((raw, index) => [raw.key, proposalDrafts[index]!.id]));
  const proposals = proposalDrafts.map((proposal, index): TodoProposal => ({
    ...proposal,
    dependencies: mapKeys(
      response.proposals[index]!.dependencyKeys,
      proposalIdByKey,
      `proposal ${response.proposals[index]!.key} dependencyKeys`,
    ),
  }));

  // Keep these maps live until conversion completes so duplicate/unknown keys
  // cannot be hidden by Map's last-value-wins behavior.
  if (conclusionKeys.size !== conclusions.length || proposalKeys.size !== proposals.length) {
    throw new Error('Invalid structured task synthesis response: duplicate keys');
  }
  assertConclusions(conclusions, { graph, diagnostics });
  assertTodoProposals(proposals, { graph, diagnostics, conclusions });
  assertProposalEvidenceMatchesConclusions(proposals, conclusions);
  return { conclusions, proposals };
}

async function fallbackOrThrow(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  config: T2CConfig,
  mode: TaskSynthesisMode,
  startedAt: number,
  reason: LlmFailureReason,
  responses: LlmResponseMetadata[] = [],
): Promise<AuditedTaskSynthesisResult> {
  const failedAudit = synthesisAudit(
    'failed', 'none', true, 0, 0, reason, Date.now() - startedAt, responses, config,
  );
  if (mode === 'require-llm') {
    throw new TaskSynthesisRequiredError(`Graph + diagnostics -> tasks requires LLM: ${reason.message}`, failedAudit);
  }
  const rawDiagnosticActions = diagnostics.diagnostics
    .filter((diagnostic) => diagnostic.code !== 'ALIGNED')
    .map((diagnostic) => ({
      diagnosticId: diagnostic.id,
      recordIds: [...diagnostic.recordIds],
      suggestedAction: diagnostic.suggestedAction,
    }));
  const warning = `Semantic task synthesis unavailable (${reason.code}); returned raw diagnostic actions only: ${reason.message}`;
  return {
    schemaVersion: 't2c.task-synthesis/v1',
    conclusions: [],
    proposals: [],
    validation: { orderedProposalIds: [], newProposalIds: [], duplicateProposalIds: [], duplicates: [] },
    rawDiagnosticActions,
    warnings: [warning],
    audit: synthesisAudit(
      'fallback', 'deterministic', true, 0, 1, reason, Date.now() - startedAt, responses, config,
    ),
  };
}

function generationMetadata(
  config: T2CConfig,
  mode: TaskSynthesisMode,
  response: LlmResponseMetadata,
): GroundedGenerationMetadata {
  const configuration = openRouterAuditConfiguration(config, config.openRouter.taskModel);
  return {
    generator: 't2c/task-synthesis',
    generatorVersion: '1',
    runtimeVersion: T2C_VERSION,
    generatedAt: new Date().toISOString(),
    requestedMode: mode,
    effectiveMode: 'llm',
    degraded: false,
    model: response.model ?? config.openRouter.taskModel,
    provider: response.provider ?? 'openrouter',
    responseId: response.responseId,
    configurationFingerprint: sha256(stableStringify(configuration)),
    reason: null,
  };
}

function synthesisAudit(
  status: PipelineStageAudit['status'],
  effectiveMode: PipelineStageAudit['effectiveMode'],
  degraded: boolean,
  recordCount: number,
  warningCount: number,
  reason: PipelineStageAudit['reason'],
  durationMs: number,
  responses: LlmResponseMetadata[],
  config: T2CConfig,
): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: openRouterAuditConfiguration(config, config.openRouter.taskModel),
    status,
    requestedMode: 'llm',
    effectiveMode,
    degraded,
    recordCount,
    warningCount,
    model: config.openRouter.taskModel,
    durationMs,
    reason,
    responses,
  };
}

function compactSynthesisPayload(graph: IntentGraph, report: DiagnosticReport): Record<string, unknown> {
  const diagnostics = [...report.diagnostics]
    .filter((diagnostic) => diagnostic.code !== 'ALIGNED' && diagnostic.recordIds.length > 0)
    .sort(compareDiagnostics)
    .slice(0, 200);
  const recordIds = new Set(diagnostics.flatMap((diagnostic) => diagnostic.recordIds));
  const todoRecords = graph.records.filter((record) => record.source.kind === 'todo').slice(0, 100);
  todoRecords.forEach((record) => recordIds.add(record.id));
  // Truncating records after collecting their IDs from diagnostics can ship a
  // diagnostic that cites a record the model never sees, which invites exactly
  // the fabricated citation the corrective retry then has to absorb. Drop the
  // diagnostics whose evidence did not survive the record budget instead.
  const records = graph.records.filter((record) => recordIds.has(record.id)).slice(0, 500);
  const includedIds = new Set(records.map((record) => record.id));
  const groundedDiagnostics = diagnostics.filter((diagnostic) =>
    diagnostic.recordIds.some((id) => includedIds.has(id)));
  return {
    graph: {
      schemaVersion: graph.schemaVersion,
      fingerprint: graph.fingerprint,
      stats: graph.stats,
      records: records.map(compactRecord),
      relations: graph.relations
        .filter((relation) => includedIds.has(relation.from) && includedIds.has(relation.to))
        .slice(0, 800),
    },
    diagnostics: {
      schemaVersion: report.schemaVersion,
      graphFingerprint: report.graphFingerprint,
      diagnostics: groundedDiagnostics,
    },
    limits: {
      maxConclusions: 100,
      maxProposals: 100,
      originalDiagnostics: report.diagnostics.length,
      includedDiagnostics: groundedDiagnostics.length,
      originalRecords: graph.records.length,
      includedRecords: records.length,
    },
  };
}

function compactRecord(record: IntentRecord): Record<string, unknown> {
  return {
    id: record.id,
    statement: record.statement,
    lifecycle: record.lifecycle,
    source: {
      kind: record.source.kind,
      path: record.source.path,
      lines: record.source.lines,
      revision: record.source.revision,
      symbol: record.source.symbol,
    },
    epistemic: record.epistemic,
  };
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const rank: Record<DiagnosticSeverity, number> = { blocking: 0, review_required: 1, warning: 2, info: 3 };
  return rank[left.severity] - rank[right.severity] || left.id.localeCompare(right.id);
}

function uniqueKeys(values: Array<{ key: string }>, name: string): Set<string> {
  const keys = new Set<string>();
  for (const value of values) {
    if (typeof value.key !== 'string' || !value.key.trim()) {
      throw new Error(`Invalid structured task synthesis response: ${name} key must be non-blank`);
    }
    if (keys.has(value.key)) throw new Error(`Invalid structured task synthesis response: duplicate ${name} key ${value.key}`);
    keys.add(value.key);
  }
  return keys;
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

/** Providers occasionally return confidence as a percentage despite JSON Schema. */
function normalizeConfidence(value: unknown): number {
  const text = typeof value === 'string' ? value.trim().replace(/%$/, '') : value;
  const numeric = typeof text === 'number' ? text : Number(text);
  if (!Number.isFinite(numeric)) return 0.5;
  if (numeric >= 0 && numeric <= 1) return numeric;
  if (numeric > 1 && numeric <= 100) return numeric / 100;
  return 0.5;
}

function normalizeConclusionKind(value: unknown): ConclusionKind {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'finding' || normalized === 'risk'
    || normalized === 'decision' || normalized === 'recommendation') return normalized;
  if (['issue', 'observation', 'fact', 'error', 'problem'].includes(normalized)) return 'finding';
  if (['action', 'proposal', 'suggestion'].includes(normalized)) return 'recommendation';
  return 'finding';
}

function normalizeSeverity(value: unknown): DiagnosticSeverity {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'info' || normalized === 'warning'
    || normalized === 'review_required' || normalized === 'blocking') return normalized;
  if (['error', 'critical', 'blocker', 'fatal', 'high'].includes(normalized)) return 'blocking';
  if (['review', 'needs_review', 'medium'].includes(normalized)) return 'review_required';
  if (['warn', 'caution'].includes(normalized)) return 'warning';
  return 'info';
}

function normalizePriority(value: unknown): TodoPriority {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (normalized === 'P0' || normalized === 'P1' || normalized === 'P2' || normalized === 'P3') return normalized;
  if (['CRITICAL', 'BLOCKING', 'BLOCKER', 'URGENT'].includes(normalized)) return 'P0';
  if (['HIGH', 'IMPORTANT'].includes(normalized)) return 'P1';
  if (['MEDIUM', 'NORMAL'].includes(normalized)) return 'P2';
  return 'P3';
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

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

function responseSchema(): Record<string, unknown> {
  const target = {
    type: 'object', additionalProperties: false, required: ['paths', 'symbols', 'tickets', 'versions'], properties: {
      paths: stringArray(), symbols: stringArray(), tickets: stringArray(), versions: stringArray(),
    },
  };
  return {
    type: 'object', additionalProperties: false, required: ['conclusions', 'proposals'], properties: {
      conclusions: {
        type: 'array', maxItems: 100, items: {
          type: 'object', additionalProperties: false,
          required: ['key', 'kind', 'title', 'detail', 'severity', 'diagnosticIds', 'recordIds', 'confidence'],
          properties: {
            key: { type: 'string', minLength: 1 },
            kind: { enum: ['finding', 'risk', 'decision', 'recommendation'] },
            title: { type: 'string', minLength: 1 }, detail: { type: 'string', minLength: 1 },
            severity: { enum: ['info', 'warning', 'review_required', 'blocking'] },
            diagnosticIds: idArray('^DIAG-[a-f0-9]{20}$', true),
            recordIds: idArray('^INT-[A-Z]+-[a-f0-9]{20}$', true),
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
      proposals: {
        type: 'array', maxItems: 100, items: {
          type: 'object', additionalProperties: false,
          required: [
            'key', 'title', 'description', 'priority', 'target', 'acceptanceCriteria', 'dependencyKeys',
            'conclusionKeys', 'diagnosticIds', 'recordIds', 'confidence',
          ],
          properties: {
            key: { type: 'string', minLength: 1 }, title: { type: 'string', minLength: 1 },
            description: { type: 'string', minLength: 1 }, priority: { enum: ['P0', 'P1', 'P2', 'P3'] },
            target, acceptanceCriteria: { ...stringArray(), minItems: 1 }, dependencyKeys: stringArray(),
            conclusionKeys: { ...stringArray(), minItems: 1 },
            diagnosticIds: idArray('^DIAG-[a-f0-9]{20}$', true),
            recordIds: idArray('^INT-[A-Z]+-[a-f0-9]{20}$', true),
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
  };
}

function stringArray(): Record<string, unknown> {
  return { type: 'array', uniqueItems: true, items: { type: 'string' } };
}

function idArray(pattern: string, required: boolean): Record<string, unknown> {
  return { ...stringArray(), minItems: required ? 1 : 0, items: { type: 'string', pattern } };
}
