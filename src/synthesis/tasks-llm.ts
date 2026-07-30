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
    const completion = await client.chatJsonWithMetadata<RawTaskSynthesisResponse>([
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(compactSynthesisPayload(graph, diagnostics)) },
    ], 't2c_grounded_task_synthesis', responseSchema(), config.openRouter.taskModel);
    const generation = generationMetadata(config, mode, completion.metadata);
    let output: { conclusions: Conclusion[]; proposals: TodoProposal[] };
    try {
      output = materializeResponse(completion.value, graph, diagnostics, generation);
    } catch (error) {
      throw new Error(`Invalid structured task synthesis response: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
      schemaVersion: 't2c.task-synthesis/v1',
      ...output,
      validation: validateAndClassifyTodoProposals(output.proposals, { graph, diagnostics, conclusions: output.conclusions }),
      rawDiagnosticActions: [],
      warnings: [],
      audit: synthesisAudit(
        'succeeded', 'llm', false, output.conclusions.length + output.proposals.length,
        0, null, Date.now() - startedAt, [completion.metadata], config,
      ),
    };
  } catch (error) {
    return fallbackOrThrow(graph, diagnostics, config, mode, startedAt, classifyLlmFailure(error));
  }
}

function materializeResponse(
  response: RawTaskSynthesisResponse,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  generation: GroundedGenerationMetadata,
): { conclusions: Conclusion[]; proposals: TodoProposal[] } {
  if (!Array.isArray(response?.conclusions) || !Array.isArray(response?.proposals)) {
    throw new Error('Invalid structured task synthesis response: conclusions and proposals must be arrays');
  }
  const conclusionKeys = uniqueKeys(response.conclusions, 'conclusion');
  const proposalKeys = uniqueKeys(response.proposals, 'proposal');
  const conclusions = response.conclusions.map((raw): Conclusion => {
    const content: Omit<Conclusion, 'id'> = {
      schemaVersion: 't2c.conclusion/v1',
      kind: raw.kind,
      title: raw.title,
      detail: raw.detail,
      severity: raw.severity,
      diagnosticIds: sortedUnique(raw.diagnosticIds),
      recordIds: sortedUnique(raw.recordIds),
      confidence: raw.confidence,
      generation,
    };
    return { ...content, id: createConclusionId(content) };
  });
  const conclusionIdByKey = new Map(response.conclusions.map((raw, index) => [raw.key, conclusions[index]!.id]));

  const proposalDrafts = response.proposals.map((raw): TodoProposal => {
    const content: Omit<TodoProposal, 'id'> = {
      schemaVersion: 't2c.todo-proposal/v1',
      title: raw.title,
      description: raw.description,
      priority: raw.priority,
      status: 'proposed',
      target: normalizeTarget(raw.target),
      acceptanceCriteria: sortedUnique(raw.acceptanceCriteria.map((item) => item.trim())),
      dependencies: [],
      conclusionIds: mapKeys(raw.conclusionKeys, conclusionIdByKey, `proposal ${raw.key} conclusionKeys`),
      diagnosticIds: sortedUnique(raw.diagnosticIds),
      recordIds: sortedUnique(raw.recordIds),
      confidence: raw.confidence,
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
): Promise<AuditedTaskSynthesisResult> {
  const failedAudit = synthesisAudit('failed', 'none', true, 0, 0, reason, Date.now() - startedAt, [], config);
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
      'fallback', 'deterministic', true, 0, 1, reason, Date.now() - startedAt, [], config,
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
  const records = graph.records.filter((record) => recordIds.has(record.id)).slice(0, 500);
  const includedIds = new Set(records.map((record) => record.id));
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
      diagnostics,
    },
    limits: {
      maxConclusions: 100,
      maxProposals: 100,
      originalDiagnostics: report.diagnostics.length,
      includedDiagnostics: diagnostics.length,
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

function mapKeys(values: string[], ids: Map<string, string>, name: string): string[] {
  if (!Array.isArray(values)) throw new Error(`Invalid structured task synthesis response: ${name} must be an array`);
  return sortedUnique(values.map((key) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Invalid structured task synthesis response: ${name} references unknown key ${key}`);
    return id;
  }));
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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
