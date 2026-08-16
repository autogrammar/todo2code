import type { T2CConfig } from '../config/env.js';
import type { LlmExtractionMode } from '../core/types.js';
import { classifyLlmFailure, rejectedLlmResponseMetadata } from '../llm/failure.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import {
  extractCommunicationIntent,
  type CommunicationExtractionOptions,
} from '../extractors/communication.js';
import {
  CommunicationAttemptError,
  enrichWithCorrection,
  fallbackOrThrow,
} from './communication-llm-enrich.js';
import {
  communicationAudit,
  deterministicGeneration,
  deterministicSyntheses,
  enrichRecord,
  llmGeneration,
  markDeterministic,
  materializeSyntheses,
  participantGroups,
  promptPayload,
  readCommunicationPrompt,
  validateEnrichments,
} from './communication-llm-helpers.js';

export type {
  AuditedCommunicationExtractionResult,
  ParticipantCommunicationSynthesis,
} from './communication-llm-types.js';
export { CommunicationLlmRequiredError } from './communication-llm-types.js';

export async function extractCommunicationIntentAudited(
  options: CommunicationExtractionOptions,
  config: T2CConfig,
  mode: LlmExtractionMode = config.communicationMode,
) {
  const startedAt = Date.now();
  const deterministic = await extractCommunicationIntent(options, config);
  if (deterministic.records.length === 0) {
    return {
      schemaVersion: 't2c.communication-enrichment/v1' as const,
      ...deterministic,
      participants: [],
      audit: communicationAudit('skipped', mode === 'deterministic' ? 'deterministic' : 'llm', 'none', false,
        deterministic.records.length, deterministic.warnings.length, null,
        { code: 'NO_COMMUNICATION_RECORDS', message: 'No communication records were available for enrichment' },
        Date.now() - startedAt, [], config, options),
    };
  }
  if (mode === 'deterministic') {
    const records = markDeterministic(deterministic.records, false, null);
    return {
      schemaVersion: 't2c.communication-enrichment/v1' as const,
      records,
      participants: deterministicSyntheses(records, deterministicGeneration()),
      warnings: deterministic.warnings,
      audit: communicationAudit(deterministic.warnings.length ? 'partial' : 'succeeded', 'deterministic', 'deterministic', false, records.length,
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
      { role: 'system', content: await readCommunicationPrompt() },
      { role: 'user', content: JSON.stringify(promptPayload(deterministic.records, groups)) },
    ], config.openRouter.communicationModel);
    const response = completion.value;
    const enrichments = validateEnrichments(response.enrichments, deterministic.records);
    const enrichedByOriginal = new Map<string, typeof deterministic.records[number]>();
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
      schemaVersion: 't2c.communication-enrichment/v1' as const,
      records: [...enrichedByOriginal.values()],
      participants,
      warnings: deterministic.warnings,
      audit: communicationAudit(deterministic.warnings.length ? 'partial' : 'succeeded', 'llm', 'llm', false, deterministic.records.length,
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
