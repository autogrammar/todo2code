import type { T2CConfig } from '../config/env.js';
import type { IntentRecord, LlmExtractionMode, LlmResponseMetadata } from '../core/types.js';
import type { CommunicationExtractionOptions } from '../extractors/communication.js';
import { classifyLlmFailure, rejectedLlmResponseMetadata, type LlmFailureReason } from '../llm/failure.js';
import { OpenRouterClient, type OpenRouterResult } from '../llm/openrouter.js';
import { StructuredResponseError } from '../llm/structured-schema.js';
import { COMMUNICATION_RESPONSE_CONTRACT } from './communication-llm-schema.js';
import {
  communicationAudit,
  deterministicSyntheses,
  fallbackGeneration,
  markDeterministic,
} from './communication-llm-helpers.js';
import type { AuditedCommunicationExtractionResult, RawCommunicationResponse } from './communication-llm-types.js';
import { CommunicationLlmRequiredError } from './communication-llm-types.js';

export class CommunicationAttemptError extends Error {
  constructor(readonly failure: unknown, readonly responses: LlmResponseMetadata[]) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'CommunicationAttemptError';
  }
}

export async function enrichWithCorrection(
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

export async function fallbackOrThrow(
  records: IntentRecord[],
  warnings: string[],
  config: T2CConfig,
  options: CommunicationExtractionOptions,
  mode: LlmExtractionMode,
  startedAt: number,
  reason: LlmFailureReason,
  responses: LlmResponseMetadata[] = [],
): Promise<AuditedCommunicationExtractionResult> {
  const failed = communicationAudit('failed', 'llm', 'none', true, 0, warnings.length + 1,
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
    audit: communicationAudit('fallback', 'llm', 'deterministic', true, marked.length, warnings.length + 1,
      config.openRouter.communicationModel, reason, Date.now() - startedAt, responses, config, options),
  };
}