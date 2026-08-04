import type { T2CConfig } from '../../config/env.js';
import type {
  GroundedGenerationMetadata,
  IntentRecord,
  LlmExtractionMode,
  LlmResponseMetadata,
  PipelineStageAudit,
} from '../../core/types.js';
import { classifyLlmFailure, rejectedLlmResponseMetadata, type LlmFailureReason } from '../../llm/failure.js';
import { OpenRouterClient, type OpenRouterResult } from '../../llm/openrouter.js';
import { StructuredResponseError } from '../../llm/structured-schema.js';
import {
  audit,
  deterministicGeneration,
  deterministicSyntheses,
  enrichRecord,
  fallbackGeneration,
  llmGeneration,
  markDeterministic,
  materializeSyntheses,
  participantGroups,
  promptPayload,
  readPrompt,
  type RawCommunicationResponse,
  validateEnrichments,
  COMMUNICATION_RESPONSE_CONTRACT,
} from './implementation-helpers.js';
import {
  extractCommunicationIntent,
  type CommunicationExtractionOptions,
  type CommunicationRole,
} from '../extractors/communication.js';

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
