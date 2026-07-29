import { OpenRouterModelError } from './openrouter.js';

export interface LlmFailureReason {
  code: string;
  message: string;
}

export function classifyLlmFailure(error: unknown): LlmFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof OpenRouterModelError) return { code: 'LLM_INVALID_MODEL', message };
  if (/timed out|timeout|AbortError|aborted/i.test(message)) return { code: 'LLM_TIMEOUT', message };
  if (/HTTP 429/i.test(message)) return { code: 'LLM_RATE_LIMITED', message };
  if (/JSON|response does not contain|structured/i.test(message)) return { code: 'LLM_RESPONSE_INVALID', message };
  return { code: 'LLM_UNAVAILABLE', message };
}
