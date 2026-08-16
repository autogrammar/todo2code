import type { LlmResponseMetadata } from '../core/types.js';
import { StructuredResponseError } from './structured-schema.js';
import { redactProviderFailureText } from './openrouter-redact.js';

export interface OpenRouterChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

export interface OpenRouterResponse {
  id?: string;
  model?: string;
  provider?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  choices?: OpenRouterChoice[];
  error?: { message?: string };
}

export interface OpenRouterResult<T> {
  value: T;
  metadata: LlmResponseMetadata;
}

export function parseProviderResponse(
  text: string,
  status: number,
  credential: string,
  providerLabel: string,
): OpenRouterResponse {
  try {
    return JSON.parse(text) as OpenRouterResponse;
  } catch {
    throw new Error(
      `${providerLabel} returned non-JSON HTTP ${status}: `
      + redactProviderFailureText(text.slice(0, 500), credential),
    );
  }
}

export function extractContent(response: OpenRouterResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  throw new Error(`${responseProviderLabel(response)} response does not contain choices[0].message.content`);
}

export function parseJsonContent<T>(content: string, providerLabel: string): T {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        // Fall through to the detailed error below.
      }
    }
    throw new Error(`${providerLabel} JSON parsing failed: ${error instanceof Error ? error.message : String(error)}; response=${trimmed.slice(0, 500)}`);
  }
}

export function parseJsonResponse<T>(response: OpenRouterResponse): OpenRouterResult<T> {
  const metadata = responseMetadata(response);
  try {
    return { value: parseJsonContent<T>(extractContent(response), responseProviderLabel(response)), metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new StructuredResponseError(message, metadata);
  }
}

export function responseMetadata(response: OpenRouterResponse): LlmResponseMetadata {
  const usage = response.usage;
  return {
    responseId: stringOrNull(response.id),
    model: stringOrNull(response.model),
    provider: stringOrNull(response.provider),
    usage: usage ? {
      promptTokens: finiteOrNull(usage.prompt_tokens),
      completionTokens: finiteOrNull(usage.completion_tokens),
      totalTokens: finiteOrNull(usage.total_tokens),
      cost: finiteOrNull(usage.cost),
    } : null,
  };
}

export function responseProviderLabel(response: OpenRouterResponse): string {
  if (response.provider === 'zai') return 'Z.AI';
  if (response.provider === 'openrouter') return 'OpenRouter';
  return 'LLM';
}

export function isInvalidModelError(status: number, message: string): boolean {
  return status === 400 && /(?:not a valid model ID|invalid model(?: ID)?|model ID .*not found)/i.test(message);
}

export function formatInvalidModelError(
  message: string,
  availableModels: string[],
  providerLabel: string,
): string {
  const heading = `Available ${providerLabel} models (${availableModels.length}):`;
  if (!availableModels.length) return `${message}\n${heading}\n(none returned)`;
  return `${message}\n${heading}\n${availableModels.map((model) => `- ${model}`).join('\n')}`;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
