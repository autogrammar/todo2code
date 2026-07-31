import type { T2CConfig } from '../config/env.js';
import type { LlmResponseMetadata } from '../core/types.js';
import { StructuredResponseError, type StructuredSchema } from './structured-schema.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface OpenRouterResponse {
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
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for this operation');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-OpenRouter-Title': this.config.appName,
          };
          if (this.config.siteUrl) headers['HTTP-Referer'] = this.config.siteUrl;
          const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(removeUndefined(body)),
            signal: controller.signal,
          });
          const text = await response.text();
          let parsed: OpenRouterResponse;
          try {
            parsed = JSON.parse(text) as OpenRouterResponse;
          } catch {
            throw new Error(`OpenRouter returned non-JSON HTTP ${response.status}: ${text.slice(0, 500)}`);
          }
          if (!response.ok || parsed.error) {
            const message = parsed.error?.message ?? text.slice(0, 500);
            const error = new Error(`OpenRouter HTTP ${response.status}: ${message}`);
            if ((response.status === 429 || response.status >= 500) && attempt < 2) {
              lastError = error;
              await sleep(300 * (2 ** attempt));
              continue;
            }
            if (isInvalidModelError(response.status, message)) {
              const model = typeof body.model === 'string' ? body.model : '(unknown)';
              try {
                const availableModels = await this.listAvailableModels();
                throw new OpenRouterModelError(
                  formatInvalidModelError(error.message, availableModels),
                  model,
                  availableModels,
                );
              } catch (listError) {
                if (listError instanceof OpenRouterModelError) throw listError;
                throw new OpenRouterModelError(
                  `${error.message}\nAvailable OpenRouter models could not be fetched: ${listError instanceof Error ? listError.message : String(listError)}`,
                  model,
                  [],
                );
              }
            }
            throw error;
          }
          return parsed;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') throw new Error(`OpenRouter request timed out after ${this.config.timeoutMs} ms`);
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < 2 && /fetch failed|ECONNRESET|ETIMEDOUT/i.test(lastError.message)) {
            await sleep(300 * (2 ** attempt));
            continue;
          }
          throw lastError;
        }
      }
      throw lastError ?? new Error('OpenRouter request failed');
    } finally {
      clearTimeout(timeout);
    }
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

function shouldRetryWithoutJsonSchema(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /OpenRouter HTTP 4\d\d:|returned non-JSON|response does not contain choices|returned invalid JSON/i.test(error.message);
}

function isInvalidModelError(status: number, message: string): boolean {
  return status === 400 && /(?:not a valid model ID|invalid model(?: ID)?|model ID .*not found)/i.test(message);
}

function formatInvalidModelError(message: string, availableModels: string[]): string {
  const heading = `Available OpenRouter models (${availableModels.length}):`;
  if (!availableModels.length) return `${message}\n${heading}\n(none returned)`;
  return `${message}\n${heading}\n${availableModels.map((model) => `- ${model}`).join('\n')}`;
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefined(item)]));
  }
  return value;
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

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
