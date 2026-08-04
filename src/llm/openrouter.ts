import type { T2CConfig } from '../config/env.js';
import type { LlmResponseMetadata } from '../core/types.js';
import { StructuredResponseError, type StructuredSchema } from './structured-schema.js';
import {
  OpenRouterResponse,
  OpenRouterRequestContext,
  requestOpenRouter,
  shouldRetryRequestWithoutSchema,
} from './openrouter-request.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResult<T> {
  value: T;
  metadata: LlmResponseMetadata;
}

interface OpenRouterModelsResponse {
  data?: Array<{ id?: string }>;
  error?: { message?: string };
}

export class OpenRouterModelError extends Error {
  constructor(
    message: string,
    readonly model: string,
    readonly availableModels: string[],
  ) {
    super(message);
    this.name = 'OpenRouterModelError';
  }
}

export class OpenRouterClient {
  constructor(private readonly config: T2CConfig['openRouter']) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async listAvailableModels(): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;
      if (this.config.siteUrl) headers['HTTP-Referer'] = this.config.siteUrl;
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers,
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed: OpenRouterModelsResponse;
      try {
        parsed = JSON.parse(text) as OpenRouterModelsResponse;
      } catch {
        throw new Error(`OpenRouter models endpoint returned non-JSON HTTP ${response.status}: ${text.slice(0, 500)}`);
      }
      if (!response.ok || parsed.error) {
        throw new Error(`OpenRouter models HTTP ${response.status}: ${parsed.error?.message ?? text.slice(0, 500)}`);
      }
      return [...new Set((parsed.data ?? [])
        .map((model) => model.id?.trim())
        .filter((id): id is string => Boolean(id)))]
        .sort((left, right) => left.localeCompare(right));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`OpenRouter models request timed out after ${this.config.timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async chatText(messages: ChatMessage[], model = this.config.model): Promise<string> {
    return (await this.chatTextWithMetadata(messages, model)).value;
  }

  async chatTextWithMetadata(messages: ChatMessage[], model = this.config.model): Promise<OpenRouterResult<string>> {
    const response = await this.request({
      model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });
    const content = extractContent(response);
    if (!content.trim()) throw new Error('OpenRouter returned an empty response');
    return { value: content.trim(), metadata: responseMetadata(response) };
  }

  async chatJson<T>(messages: ChatMessage[], schemaName: string, schema: Record<string, unknown>, model = this.config.model): Promise<T> {
    return (await this.chatJsonWithMetadata<T>(messages, schemaName, schema, model)).value;
  }

  async chatStructuredWithMetadata<T>(
    messages: ChatMessage[],
    schemaName: string,
    contract: StructuredSchema<T>,
    model = this.config.model,
  ): Promise<OpenRouterResult<T>> {
    const result = await this.chatJsonWithMetadata<unknown>(messages, schemaName, contract.jsonSchema, model);
    try {
      return { ...result, value: contract.parse(result.value) };
    } catch (error) {
      if (error instanceof StructuredResponseError) {
        throw new StructuredResponseError(error.message, result.metadata);
      }
      throw error;
    }
  }

  async chatJsonWithMetadata<T>(messages: ChatMessage[], schemaName: string, schema: Record<string, unknown>, model = this.config.model): Promise<OpenRouterResult<T>> {
    const structuredBody = {
      model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: this.config.requireStructuredOutput
        ? {
            type: 'json_schema',
            json_schema: { name: schemaName, strict: true, schema },
          }
        : { type: 'json_object' },
      provider: this.config.requireStructuredOutput ? { require_parameters: true } : undefined,
      plugins: this.config.responseHealing ? [{ id: 'response-healing' }] : undefined,
    };

    try {
      const response = await this.request(structuredBody);
      return parseJsonResponse<T>(response);
    } catch (firstError) {
      if (firstError instanceof OpenRouterModelError) throw firstError;
      if (!this.config.requireStructuredOutput) throw firstError;
      // Retrying without JSON Schema can repair a provider capability or output
      // formatting problem. It cannot repair a timeout/network/server failure,
      // and repeating those failures used to double the worst-case chunk time.
      if (!shouldRetryWithoutJsonSchema(firstError)) throw firstError;
      const fallback = await this.request({
        model,
        messages: [
          ...messages,
          { role: 'system' as const, content: 'Return one valid JSON object only. Do not wrap it in Markdown.' },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
        plugins: this.config.responseHealing ? [{ id: 'response-healing' }] : undefined,
      });
      return parseJsonResponse<T>(fallback);
    }
  }

  private async request(body: Record<string, unknown>): Promise<OpenRouterResponse> {
    const context: OpenRouterRequestContext = {
      apiKey: this.config.apiKey ?? '',
      baseUrl: this.config.baseUrl,
      appName: this.config.appName,
      timeoutMs: this.config.timeoutMs,
      siteUrl: this.config.siteUrl ?? undefined,
      signal: this.config.signal,
    };
    return requestOpenRouter(context, body, () => this.listAvailableModels(), createModelError);
  }
}

function responseMetadata(response: OpenRouterResponse): LlmResponseMetadata {
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

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function createModelError(message: string, model: string, availableModels: string[]): Error {
  return new OpenRouterModelError(formatInvalidModelError(message, availableModels), model, availableModels);
}

function formatInvalidModelError(message: string, availableModels: string[]): string {
  const heading = `Available OpenRouter models (${availableModels.length}):`;
  if (!availableModels.length) return `${message}\n${heading}\n(none returned)`;
  return `${message}\n${heading}\n${availableModels.map((model) => `- ${model}`).join('\n')}`;
}

function extractContent(response: OpenRouterResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  throw new Error('OpenRouter response does not contain choices[0].message.content');
}

function parseJsonContent<T>(content: string): T {
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
    throw new Error(`OpenRouter JSON parsing failed: ${error instanceof Error ? error.message : String(error)}; response=${trimmed.slice(0, 500)}`);
  }
}

function parseJsonResponse<T>(response: OpenRouterResponse): OpenRouterResult<T> {
  const metadata = responseMetadata(response);
  try {
    return { value: parseJsonContent<T>(extractContent(response)), metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new StructuredResponseError(message, metadata);
  }
}

function shouldRetryWithoutJsonSchema(error: unknown): boolean {
  return shouldRetryRequestWithoutSchema(error);
}
