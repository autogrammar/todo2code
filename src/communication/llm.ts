import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { createIntentId, sha256, stableStringify } from '../core/id.js';
import { pathExists } from '../core/io.js';
import { buildRecord, withRecordGeneration } from '../core/record.js';
import type {
  GroundedGenerationMetadata,
  IntentAction,
  IntentRecord,
  LlmExtractionMode,
  LlmResponseMetadata,
  PipelineStageAudit,
} from '../core/types.js';
import { classifyLlmFailure, rejectedLlmResponseMetadata, type LlmFailureReason } from '../llm/failure.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient, type OpenRouterResult } from '../llm/openrouter.js';
import { StructuredResponseError, structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';
import { T2C_VERSION } from '../version.js';
import {
  extractCommunicationIntent,
  type CommunicationExtractionOptions,
  type CommunicationRole,
} from '../extractors/communication.js';

const ACTIONS = [
  'add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate',
  'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown',
] as const satisfies readonly IntentAction[];

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
    const { completion, responses } = await enrichWithCorrection(client, [
      { role: 'system', content: await readPrompt() },
      { role: 'user', content: JSON.stringify(promptPayload(deterministic.records, groups)) },
    ], config.openRouter.communicationModel);
    const response = completion.value;
    const enrichments = validateEnrichments(response.enrichments, deterministic.records);
    const enrichedByOriginal = new Map<string, IntentRecord>();
    for (const record of deterministic.records) {
      enrichedByOriginal.set(record.id, enrichRecord(record, enrichments.get(record.id)!, config, completion.metadata));
    }
    const generation = llmGeneration(config, mode, completion.metadata);
    const participants = materializeSyntheses(
      response.participantSyntheses,
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
        Date.now() - startedAt, responses, config, options),
    };
  } catch (error) {
    const failure = error instanceof CommunicationAttemptError ? error.failure : error;
    const responses = error instanceof CommunicationAttemptError
      ? error.responses
      : rejectedLlmResponseMetadata(error);
    return fallbackOrThrow(
      deterministic.records, deterministic.warnings, config, options, mode, startedAt,
      classifyLlmFailure(failure), responses,
    );
  }
}

class CommunicationAttemptError extends Error {
  constructor(readonly failure: unknown, readonly responses: LlmResponseMetadata[]) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'CommunicationAttemptError';
  }
}

async function enrichWithCorrection(
  client: OpenRouterClient,
  baseMessages: Array<{ role: 'system' | 'user'; content: string }>,
  model: string,
): Promise<{ completion: OpenRouterResult<RawCommunicationResponse>; responses: LlmResponseMetadata[] }> {
  const responses: LlmResponseMetadata[] = [];
  let correction: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await client.chatStructuredWithMetadata([
        ...baseMessages,
        ...(correction
          ? [{
              role: 'user' as const,
              content: `The previous response was rejected: ${correction}\n`
                + 'Correct exactly that violation and re-emit the full object. Do not add, rename, or omit properties.\n'
                + `The exact required JSON Schema is: ${JSON.stringify(COMMUNICATION_RESPONSE_CONTRACT.jsonSchema)}`,
            }]
          : []),
      ], 't2c_communication_enrichment', COMMUNICATION_RESPONSE_CONTRACT, model);
      responses.push(completion.metadata);
      return { completion, responses };
    } catch (error) {
      if (error instanceof StructuredResponseError) {
        if (error.responseMetadata) responses.push(error.responseMetadata);
        if (attempt === 0) {
          correction = error.message;
          continue;
        }
      }
      throw new CommunicationAttemptError(error, [...responses]);
    }
  }

  throw new CommunicationAttemptError(new Error('Communication correction retry budget exhausted'), responses);
}

async function fallbackOrThrow(
  records: IntentRecord[],
  warnings: string[],
  config: T2CConfig,
  options: CommunicationExtractionOptions,
  mode: LlmExtractionMode,
  startedAt: number,
  reason: LlmFailureReason,
  responses: LlmResponseMetadata[] = [],
): Promise<AuditedCommunicationExtractionResult> {
  const failed = audit('failed', 'llm', 'none', true, 0, warnings.length + 1,
    config.openRouter.communicationModel, reason, Date.now() - startedAt, responses, config, options);
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
      config.openRouter.communicationModel, reason, Date.now() - startedAt, responses, config, options),
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
    generation: {
      requested: 'llm', used: 'llm', provider: response.provider ?? 'openrouter',
      model: response.model ?? config.openRouter.communicationModel, responseId: response.responseId,
    },
    metadata: {
      ...record.metadata,
      llmUsed: true,
      topics: sortedUnique(enrichment.topics),
      response,
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
  return records.map((record) => {
    const marked = withRecordGeneration(record, {
      requested: degraded ? 'llm' : 'deterministic', used: 'deterministic', degraded, fallbackReason,
    });
    return { ...marked, metadata: { ...marked.metadata, llmUsed: false } };
  });
}

function deterministicGeneration(): GroundedGenerationMetadata {
  return {
    generator: 't2c/participant-synthesis', generatorVersion: '1',
    runtimeVersion: T2C_VERSION, generatedAt: new Date().toISOString(),
    requestedMode: 'deterministic', effectiveMode: 'deterministic', degraded: false,
    model: null, provider: null, responseId: null,
    configurationFingerprint: sha256('t2c-communication-deterministic/v1'), reason: null,
  };
}

function fallbackGeneration(reason: string): GroundedGenerationMetadata {
  return {
    generator: 't2c/participant-synthesis', generatorVersion: '1',
    runtimeVersion: T2C_VERSION, generatedAt: new Date().toISOString(),
    requestedMode: 'prefer-llm', effectiveMode: 'deterministic', degraded: true,
    model: null, provider: null, responseId: null,
    configurationFingerprint: sha256(stableStringify({ stage: 'communication', reason })), reason,
  };
}

function llmGeneration(config: T2CConfig, mode: LlmExtractionMode, response: LlmResponseMetadata): GroundedGenerationMetadata {
  return {
    generator: 't2c/participant-synthesis', generatorVersion: '1',
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

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

async function readPrompt(): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', 'communication-to-intent.system.md');
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}

const communicationStrings = () => s.array(s.string());
const COMMUNICATION_ENRICHMENT_CONTRACT = s.object({
  recordId: s.string(),
  action: s.enum(ACTIONS),
  object: s.string(),
  polarity: s.enum(['positive', 'negative']),
  confidence: s.number({ minimum: 0, maximum: 0.85 }),
  basis: communicationStrings(),
  target: s.object({ paths: communicationStrings(), symbols: communicationStrings(), versions: communicationStrings() }),
  topics: communicationStrings(),
}) satisfies StructuredSchema<RawCommunicationEnrichment>;
const PARTICIPANT_SYNTHESIS_CONTRACT = s.object({
  participantKey: s.string(),
  summary: s.string({ minLength: 1, pattern: '.*\\S.*' }),
  commitments: communicationStrings(),
  risks: communicationStrings(),
  recordIds: communicationStrings(),
  confidence: s.number({ minimum: 0, maximum: 0.85 }),
}) satisfies StructuredSchema<RawParticipantSynthesis>;
const COMMUNICATION_RESPONSE_CONTRACT = s.object({
  enrichments: s.array(COMMUNICATION_ENRICHMENT_CONTRACT),
  participantSyntheses: s.array(PARTICIPANT_SYNTHESIS_CONTRACT),
}) satisfies StructuredSchema<RawCommunicationResponse>;
