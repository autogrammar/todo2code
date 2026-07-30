import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { createIntentId, sha256, stableStringify } from '../core/id.js';
import { pathExists } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import type {
  GroundedGenerationMetadata,
  IntentAction,
  IntentRecord,
  LlmExtractionMode,
  LlmResponseMetadata,
  PipelineStageAudit,
} from '../core/types.js';
import { classifyLlmFailure, type LlmFailureReason } from '../llm/failure.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { T2C_VERSION } from '../version.js';
import {
  extractCommunicationIntent,
  type CommunicationExtractionOptions,
  type CommunicationRole,
} from '../extractors/communication.js';

const ACTIONS: IntentAction[] = [
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
];
const ACTION_SET = new Set<IntentAction>(ACTIONS);

interface RawCommunicationEnrichment {
  recordId: string;
  action: IntentAction;
  object: string;
  polarity: 'positive' | 'negative';
  confidence: number;
  basis: string[];
  target: { paths: string[]; symbols: string[]; versions: string[] };
  topics: string[];
}

interface RawParticipantSynthesis {
  participantKey: string;
  summary: string;
  commitments: string[];
  risks: string[];
  recordIds: string[];
  confidence: number;
}

interface RawCommunicationResponse {
  enrichments: RawCommunicationEnrichment[];
  participantSyntheses: RawParticipantSynthesis[];
}

export interface ParticipantCommunicationSynthesis {
  schemaVersion: 't2c.participant-synthesis/v1';
  id: string;
  participant: string;
  role: CommunicationRole;
  tickets: string[];
  summary: string;
  commitments: string[];
  risks: string[];
  recordIds: string[];
  confidence: number;
  generation: GroundedGenerationMetadata;
}

export interface AuditedCommunicationExtractionResult {
  schemaVersion: 't2c.communication-enrichment/v1';
  records: IntentRecord[];
  participants: ParticipantCommunicationSynthesis[];
  warnings: string[];
  audit: PipelineStageAudit;
}

export class CommunicationLlmRequiredError extends Error {
  constructor(message: string, readonly audit: PipelineStageAudit) {
    super(message);
    this.name = 'CommunicationLlmRequiredError';
  }
}

export async function extractCommunicationIntentAudited(
  options: CommunicationExtractionOptions,
  config: T2CConfig,
  mode: LlmExtractionMode = config.communicationMode,
): Promise<AuditedCommunicationExtractionResult> {
  const startedAt = Date.now();
  const deterministic = await extractCommunicationIntent(options, config);
  if (deterministic.records.length === 0) {
    return {
      schemaVersion: 't2c.communication-enrichment/v1',
      ...deterministic,
      participants: [],
      audit: audit('skipped', mode === 'deterministic' ? 'deterministic' : 'llm', 'none', false,
        deterministic.records.length, deterministic.warnings.length, null,
        { code: 'NO_COMMUNICATION_RECORDS', message: 'No communication records were available for enrichment' },
        Date.now() - startedAt, [], config, options),
    };
  }
  if (mode === 'deterministic') {
    const records = markDeterministic(deterministic.records, false, null);
    return {
      schemaVersion: 't2c.communication-enrichment/v1', records,
      participants: deterministicSyntheses(records, deterministicGeneration()),
      warnings: deterministic.warnings,
      audit: audit(deterministic.warnings.length ? 'partial' : 'succeeded', 'deterministic', 'deterministic', false, records.length,
        deterministic.warnings.length, null, null, Date.now() - startedAt, [], config, options),
    };
  }

  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    return fallbackOrThrow(deterministic.records, deterministic.warnings, config, options, mode, startedAt, {
      code: 'LLM_NOT_CONFIGURED', message: 'OPENROUTER_API_KEY is not configured',
    });
  }
  try {
    const groups = participantGroups(deterministic.records);
    const completion = await client.chatJsonWithMetadata<RawCommunicationResponse>([
      { role: 'system', content: await readPrompt() },
      { role: 'user', content: JSON.stringify(promptPayload(deterministic.records, groups)) },
    ], 't2c_communication_enrichment', responseSchema(), config.openRouter.communicationModel);
    const enrichments = validateEnrichments(completion.value.enrichments, deterministic.records);
    const enrichedByOriginal = new Map<string, IntentRecord>();
    for (const record of deterministic.records) {
      enrichedByOriginal.set(record.id, enrichRecord(record, enrichments.get(record.id)!, config, completion.metadata));
    }
    const generation = llmGeneration(config, mode, completion.metadata);
    const participants = materializeSyntheses(
      completion.value.participantSyntheses,
      groups,
      enrichedByOriginal,
      generation,
    );
    return {
      schemaVersion: 't2c.communication-enrichment/v1',
      records: [...enrichedByOriginal.values()],
      participants,
      warnings: deterministic.warnings,
      audit: audit(deterministic.warnings.length ? 'partial' : 'succeeded', 'llm', 'llm', false, deterministic.records.length,
        deterministic.warnings.length, config.openRouter.communicationModel, null,
        Date.now() - startedAt, [completion.metadata], config, options),
    };
  } catch (error) {
    return fallbackOrThrow(
      deterministic.records, deterministic.warnings, config, options, mode, startedAt, classifyLlmFailure(error),
    );
  }
}

async function fallbackOrThrow(
  records: IntentRecord[],
  warnings: string[],
  config: T2CConfig,
  options: CommunicationExtractionOptions,
  mode: LlmExtractionMode,
  startedAt: number,
  reason: LlmFailureReason,
): Promise<AuditedCommunicationExtractionResult> {
  const failed = audit('failed', 'llm', 'none', true, 0, warnings.length + 1,
    config.openRouter.communicationModel, reason, Date.now() - startedAt, [], config, options);
  if (mode === 'require-llm') {
    throw new CommunicationLlmRequiredError(`Communication enrichment requires LLM: ${reason.message}`, failed);
  }
  const warning = `Communication enrichment used deterministic fallback (${reason.code}): ${reason.message}`;
  const marked = markDeterministic(records, true, reason.code);
  return {
    schemaVersion: 't2c.communication-enrichment/v1',
    records: marked,
    participants: deterministicSyntheses(marked, fallbackGeneration(reason.code)),
    warnings: [...warnings, warning],
    audit: audit('fallback', 'llm', 'deterministic', true, marked.length, warnings.length + 1,
      config.openRouter.communicationModel, reason, Date.now() - startedAt, [], config, options),
  };
}

interface ParticipantGroup {
  key: string;
  participant: string;
  role: CommunicationRole;
  tickets: string[];
  records: IntentRecord[];
}

function participantGroups(records: IntentRecord[]): ParticipantGroup[] {
  const grouped = new Map<string, IntentRecord[]>();
  for (const record of records) {
    const participant = String(record.metadata.participant ?? record.statement.actor ?? `unknown:${record.id}`);
    const role = roleOf(record);
    const key = stableStringify({ participant, role });
    const values = grouped.get(key);
    if (values) values.push(record);
    else grouped.set(key, [record]);
  }
  return [...grouped.values()].map((values, index) => ({
    key: `participant-${index + 1}`,
    participant: String(values[0]?.metadata.participant ?? values[0]?.statement.actor ?? 'unknown'),
    role: roleOf(values[0]),
    tickets: [...new Set(values.flatMap((record) => record.statement.target.tickets))].sort(),
    records: [...values].sort((left, right) => left.id.localeCompare(right.id)),
  })).sort((left, right) => left.role.localeCompare(right.role) || left.participant.localeCompare(right.participant))
    .map((group, index) => ({ ...group, key: `participant-${index + 1}` }));
}

function promptPayload(records: IntentRecord[], groups: ParticipantGroup[]): Record<string, unknown> {
  return {
    records: records.map((record) => ({
      recordId: record.id,
      participantKey: groups.find((group) => group.records.some((item) => item.id === record.id))?.key,
      text: record.statement.text,
      deterministic: {
        action: record.statement.action,
        object: record.statement.object,
        polarity: record.statement.polarity,
        paths: record.statement.target.paths,
        symbols: record.statement.target.symbols,
        versions: record.statement.target.versions,
      },
    })),
    participants: groups.map((group) => ({
      participantKey: group.key,
      recordIds: group.records.map((record) => record.id),
    })),
  };
}

function validateEnrichments(values: RawCommunicationEnrichment[] | undefined, records: IntentRecord[]): Map<string, RawCommunicationEnrichment> {
  if (!Array.isArray(values)) throw new Error('Structured response does not contain communication enrichments');
  const expected = new Set(records.map((record) => record.id));
  const output = new Map<string, RawCommunicationEnrichment>();
  for (const value of values) {
    if (!isEnrichment(value)) throw new Error('Structured response contains an invalid communication enrichment');
    if (!expected.has(value.recordId)) throw new Error(`Structured response contains unknown recordId: ${value.recordId}`);
    if (output.has(value.recordId)) throw new Error(`Structured response duplicates recordId: ${value.recordId}`);
    output.set(value.recordId, value);
  }
  if (output.size !== expected.size) throw new Error(`Structured response returned ${output.size} of ${expected.size} enrichments`);
  return output;
}

function materializeSyntheses(
  values: RawParticipantSynthesis[] | undefined,
  groups: ParticipantGroup[],
  enrichedByOriginal: Map<string, IntentRecord>,
  generation: GroundedGenerationMetadata,
): ParticipantCommunicationSynthesis[] {
  if (!Array.isArray(values)) throw new Error('Structured response does not contain participantSyntheses');
  const byKey = new Map(groups.map((group) => [group.key, group]));
  const seen = new Set<string>();
  const output = values.map((raw) => {
    if (!isRawSynthesis(raw)) throw new Error('Structured response contains an invalid participant synthesis');
    const group = byKey.get(raw.participantKey);
    if (!group) throw new Error(`Structured response contains unknown participantKey: ${raw.participantKey}`);
    if (seen.has(raw.participantKey)) throw new Error(`Structured response duplicates participantKey: ${raw.participantKey}`);
    seen.add(raw.participantKey);
    const permitted = new Set(group.records.map((record) => record.id));
    if (!raw.recordIds.length || raw.recordIds.some((id) => !permitted.has(id))) {
      throw new Error(`Participant synthesis ${raw.participantKey} contains ungrounded recordIds`);
    }
    const recordIds = raw.recordIds.map((id) => enrichedByOriginal.get(id)?.id)
      .filter((id): id is string => Boolean(id)).sort();
    return synthesis({
      participant: group.participant,
      role: group.role,
      tickets: group.tickets,
      summary: raw.summary,
      commitments: raw.commitments,
      risks: raw.risks,
      recordIds,
      confidence: raw.confidence,
      generation,
    });
  });
  if (seen.size !== groups.length) throw new Error(`Structured response returned ${seen.size} of ${groups.length} participant syntheses`);
  return output.sort((left, right) => left.role.localeCompare(right.role) || left.participant.localeCompare(right.participant));
}

function enrichRecord(
  record: IntentRecord,
  enrichment: RawCommunicationEnrichment,
  config: T2CConfig,
  response: LlmResponseMetadata,
): IntentRecord {
  return buildRecord({
    kind: record.statement.kind,
    actor: record.statement.actor,
    action: enrichment.action,
    subject: record.statement.subject,
    object: enrichment.object.trim() || record.statement.object,
    target: {
      paths: [...record.statement.target.paths, ...enrichment.target.paths],
      symbols: [...record.statement.target.symbols, ...enrichment.target.symbols],
      // Ticket ownership is structural and never accepted from the model.
      tickets: record.statement.target.tickets,
      versions: [...record.statement.target.versions, ...enrichment.target.versions],
    },
    modality: record.statement.modality,
    polarity: enrichment.polarity,
    text: record.statement.text,
    lifecycle: record.lifecycle.status,
    sourceKind: record.source.kind,
    sourcePath: record.source.path,
    sourceLines: record.source.lines,
    revision: record.source.revision,
    symbol: record.source.symbol,
    commitIndex: record.source.commitIndex,
    extractor: 't2c/project-communication-openrouter@1',
    rawExcerpt: record.source.rawExcerpt,
    // A plan/declaration/claim cannot become a fact through model prose.
    epistemicClass: record.epistemic.class,
    confidence: Math.min(0.85, Math.max(0.05, enrichment.confidence)),
    basis: [...record.epistemic.basis, 'openrouter_communication_enrichment', ...enrichment.basis],
    observedAt: record.observedAt,
    metadata: {
      ...record.metadata,
      llmUsed: true,
      topics: sortedUnique(enrichment.topics),
      generation: {
        requested: 'llm', used: 'llm', degraded: false, fallbackReason: null,
        runtimeVersion: T2C_VERSION, model: config.openRouter.communicationModel, response,
      },
    },
  });
}

function deterministicSyntheses(records: IntentRecord[], generation: GroundedGenerationMetadata): ParticipantCommunicationSynthesis[] {
  return participantGroups(records).map((group) => synthesis({
    participant: group.participant,
    role: group.role,
    tickets: group.tickets,
    summary: `${group.participant} (${group.role}) ma ${group.records.length} uziemionych rekordów komunikacji.`,
    commitments: group.records.filter((record) => record.epistemic.class === 'plan')
      .map((record) => record.statement.text),
    risks: group.records.filter((record) => record.statement.polarity === 'negative')
      .map((record) => record.statement.text),
    recordIds: group.records.map((record) => record.id).sort(),
    confidence: 1,
    generation,
  }));
}

function synthesis(input: Omit<ParticipantCommunicationSynthesis, 'schemaVersion' | 'id'>): ParticipantCommunicationSynthesis {
  const semantic = {
    participant: input.participant,
    role: input.role,
    tickets: sortedUnique(input.tickets),
    summary: input.summary.trim(),
    commitments: sortedUnique(input.commitments),
    risks: sortedUnique(input.risks),
    recordIds: sortedUnique(input.recordIds),
  };
  if (!semantic.summary || !semantic.recordIds.length) throw new Error('Participant synthesis requires a summary and record citations');
  return {
    schemaVersion: 't2c.participant-synthesis/v1',
    id: createIntentId(semantic, 'COMM-SYN'),
    ...semantic,
    confidence: Math.min(1, Math.max(0, input.confidence)),
    generation: input.generation,
  };
}

function markDeterministic(records: IntentRecord[], degraded: boolean, fallbackReason: string | null): IntentRecord[] {
  return records.map((record) => ({
    ...record,
    metadata: {
      ...record.metadata,
      llmUsed: false,
      generation: {
        requested: degraded ? 'llm' : 'deterministic', used: 'deterministic', degraded, fallbackReason,
        runtimeVersion: T2C_VERSION,
      },
    },
  }));
}

function deterministicGeneration(): GroundedGenerationMetadata {
  return {
    runtimeVersion: T2C_VERSION, generatedAt: new Date().toISOString(),
    requestedMode: 'deterministic', effectiveMode: 'deterministic', degraded: false,
    model: null, provider: null, responseId: null,
    configurationFingerprint: sha256('t2c-communication-deterministic/v1'), reason: null,
  };
}

function fallbackGeneration(reason: string): GroundedGenerationMetadata {
  return {
    runtimeVersion: T2C_VERSION, generatedAt: new Date().toISOString(),
    requestedMode: 'prefer-llm', effectiveMode: 'deterministic', degraded: true,
    model: null, provider: null, responseId: null,
    configurationFingerprint: sha256(stableStringify({ stage: 'communication', reason })), reason,
  };
}

function llmGeneration(config: T2CConfig, mode: LlmExtractionMode, response: LlmResponseMetadata): GroundedGenerationMetadata {
  return {
    runtimeVersion: T2C_VERSION, generatedAt: new Date().toISOString(),
    requestedMode: mode, effectiveMode: 'llm', degraded: false,
    model: response.model ?? config.openRouter.communicationModel,
    provider: response.provider ?? 'openrouter', responseId: response.responseId,
    configurationFingerprint: sha256(stableStringify(openRouterAuditConfiguration(config, config.openRouter.communicationModel))),
    reason: null,
  };
}

function audit(
  status: PipelineStageAudit['status'], requestedMode: PipelineStageAudit['requestedMode'],
  effectiveMode: PipelineStageAudit['effectiveMode'], degraded: boolean, recordCount: number,
  warningCount: number, model: string | null, reason: PipelineStageAudit['reason'], durationMs: number,
  responses: LlmResponseMetadata[], config: T2CConfig, options: CommunicationExtractionOptions,
): PipelineStageAudit {
  return {
    runtimeVersion: T2C_VERSION,
    configuration: {
      ...openRouterAuditConfiguration(config, model),
      projectDirectory: options.projectDir ?? 'project',
      ticket: options.ticket ?? null,
    },
    status, requestedMode, effectiveMode, degraded, recordCount, warningCount,
    model, durationMs, reason, responses,
  };
}

function roleOf(record: IntentRecord | undefined): CommunicationRole {
  return record?.metadata.participantRole === 'human' || record?.metadata.participantRole === 'agent'
    ? record.metadata.participantRole
    : 'unknown';
}

function isEnrichment(value: unknown): value is RawCommunicationEnrichment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RawCommunicationEnrichment>;
  return typeof item.recordId === 'string' && typeof item.action === 'string' && ACTION_SET.has(item.action as IntentAction)
    && typeof item.object === 'string' && (item.polarity === 'positive' || item.polarity === 'negative')
    && finiteConfidence(item.confidence) && isStrings(item.basis) && isStrings(item.topics)
    && Boolean(item.target) && isStrings(item.target?.paths) && isStrings(item.target?.symbols) && isStrings(item.target?.versions);
}

function isRawSynthesis(value: unknown): value is RawParticipantSynthesis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RawParticipantSynthesis>;
  return typeof item.participantKey === 'string' && typeof item.summary === 'string' && Boolean(item.summary.trim())
    && isStrings(item.commitments) && isStrings(item.risks) && isStrings(item.recordIds) && finiteConfidence(item.confidence);
}

function finiteConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 0.85;
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

async function readPrompt(): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', 'communication-to-intent.system.md');
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

function responseSchema(): Record<string, unknown> {
  const strings = { type: 'array', items: { type: 'string' } };
  return {
    type: 'object', additionalProperties: false, required: ['enrichments', 'participantSyntheses'], properties: {
      enrichments: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['recordId', 'action', 'object', 'polarity', 'confidence', 'basis', 'target', 'topics'],
        properties: {
          recordId: { type: 'string' }, action: { type: 'string', enum: ACTIONS }, object: { type: 'string' },
          polarity: { type: 'string', enum: ['positive', 'negative'] }, confidence: { type: 'number', minimum: 0, maximum: 0.85 },
          basis: strings, topics: strings,
          target: { type: 'object', additionalProperties: false, required: ['paths', 'symbols', 'versions'], properties: {
            paths: strings, symbols: strings, versions: strings,
          } },
        },
      } },
      participantSyntheses: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['participantKey', 'summary', 'commitments', 'risks', 'recordIds', 'confidence'],
        properties: {
          participantKey: { type: 'string' }, summary: { type: 'string' }, commitments: strings,
          risks: strings, recordIds: strings, confidence: { type: 'number', minimum: 0, maximum: 0.85 },
        },
      } },
    },
  };
}
