import type { T2CConfig } from '../config/env.js';

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
  choices?: OpenRouterChoice[];
  error?: { message?: string };
}

export class OpenRouterClient {
  constructor(private readonly config: T2CConfig['openRouter']) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async chatText(messages: ChatMessage[], model = this.config.model): Promise<string> {
    const response = await this.request({
      model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });
    const content = extractContent(response);
    if (!content.trim()) throw new Error('OpenRouter returned an empty response');
    return content.trim();
  }

  async chatJson<T>(messages: ChatMessage[], schemaName: string, schema: Record<string, unknown>, model = this.config.model): Promise<T> {
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
      return parseJsonContent<T>(extractContent(response));
    } catch (firstError) {
      if (!this.config.requireStructuredOutput) throw firstError;
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
      return parseJsonContent<T>(extractContent(fallback));
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

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
