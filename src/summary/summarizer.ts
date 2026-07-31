import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { createConclusionId, sha256, stableStringify } from '../core/id.js';
import { groundRecordIdsByDiagnostics } from '../core/grounding.js';
import { pathExists } from '../core/io.js';
import { assertConclusions } from '../core/schema.js';
import type {
  Conclusion,
  ConclusionKind,
  DiagnosticReport,
  DiagnosticSeverity,
  GroundedGenerationMetadata,
  IntentGraph,
  LlmResponseMetadata,
  LlmExtractionMode,
} from '../core/types.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { StructuredResponseError, structuredSchema as s, type StructuredSchema } from '../llm/structured-schema.js';
import { T2C_VERSION } from '../version.js';
import { compactSummaryPayload } from './payload.js';
import { compareConclusions, renderSummaryMarkdown } from './render.js';

export interface SummaryResult {
  conclusions: Conclusion[];
  markdown: string;
  llmUsed: boolean;
  warnings: string[];
  responses: LlmResponseMetadata[];
}

export interface SummaryOptions {
  /** Explicit summary mode used by CLI and new integrations. */
  mode?: LlmExtractionMode;
  /** @deprecated Compatibility with callers predating explicit summary modes. */
  allowDeterministicFallback?: boolean;
  /** @deprecated Compatibility with the pipeline's includeSummaryLlm switch. */
  preferLlm?: boolean;
}

interface RawConclusion {
  kind: ConclusionKind;
  title: string;
  detail: string;
  severity: DiagnosticSeverity;
  diagnosticIds: string[];
  recordIds: string[];
  confidence: number;
}

interface RawSummaryResponse {
  conclusions: RawConclusion[];
}

export async function summarizeGraph(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  config: T2CConfig,
  options: SummaryOptions,
): Promise<SummaryResult> {
  // This also proves that diagnostics belong to this exact graph before the
  // provider sees any payload or Markdown is rendered.
  assertConclusions([], { graph, diagnostics });
  const mode = summaryMode(options);
  if (mode === 'deterministic') {
    const conclusions = deterministicConclusions(
      graph,
      diagnostics,
      generationMetadata(config, 'deterministic'),
    );
    return {
      conclusions,
      markdown: renderSummaryMarkdown(
        graph,
        conclusions,
        'Wygenerowano deterministycznie, ponieważ etap podsumowania LLM został świadomie wyłączony dla tego przebiegu.',
      ),
      llmUsed: false,
      warnings: [],
      responses: [],
    };
  }
  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    if (mode === 'require-llm') throw new Error('OPENROUTER_API_KEY is required for Intent DSL -> NL summarization');
    const reason = 'LLM_NOT_CONFIGURED';
    const conclusions = deterministicConclusions(
      graph,
      diagnostics,
      generationMetadata(config, mode, undefined, reason),
    );
    return {
      conclusions,
      markdown: renderSummaryMarkdown(graph, conclusions),
      llmUsed: false,
      warnings: ['OPENROUTER_API_KEY is not configured; generated deterministic fallback summary'],
      responses: [],
    };
  }

  const systemPrompt = await readPrompt('summarize.system.md');
  const payload = compactSummaryPayload(graph, diagnostics);
  try {
    const { conclusions, responses } = await summarizeWithCorrection(
      client, config, mode, systemPrompt, JSON.stringify(payload), graph, diagnostics,
    );
    return {
      conclusions,
      markdown: renderSummaryMarkdown(
        graph,
        conclusions,
        'Wnioski modelu zostały zmaterializowane i zwalidowane jako `t2c.conclusion/v1` przed renderowaniem raportu.',
      ),
      llmUsed: true,
      warnings: [],
      responses,
    };
  } catch (error) {
    if (mode === 'require-llm') throw error;
    const failure = error instanceof SummaryAttemptError ? error.failure : error;
    const responses = error instanceof SummaryAttemptError ? error.responses : [];
    const reason = 'LLM_UNAVAILABLE';
    const conclusions = deterministicConclusions(
      graph,
      diagnostics,
      generationMetadata(config, mode, undefined, reason),
    );
    return {
      conclusions,
      markdown: renderSummaryMarkdown(graph, conclusions),
      llmUsed: false,
      warnings: [`OpenRouter summary failed; generated deterministic fallback: ${failure instanceof Error ? failure.message : String(failure)}`],
      responses,
    };
  }
}

const SUMMARY_CONCLUSION_CONTRACT = s.object({
  kind: s.enum(['finding', 'risk', 'decision', 'recommendation']),
  title: s.string({ minLength: 1, pattern: '.*\\S.*' }),
  detail: s.string({ minLength: 1, pattern: '.*\\S.*' }),
  severity: s.enum(['info', 'warning', 'review_required', 'blocking']),
  diagnosticIds: s.array(s.string({ pattern: '^DIAG-[a-f0-9]{20}$' }), { minItems: 1, uniqueItems: true }),
  recordIds: s.array(s.string({ pattern: '^INT-[A-Z]+-[a-f0-9]{20}$' }), { minItems: 1, uniqueItems: true }),
  confidence: s.number({ minimum: 0, maximum: 1 }),
}) satisfies StructuredSchema<RawConclusion>;
const SUMMARY_RESPONSE_CONTRACT = s.object({
  conclusions: s.array(SUMMARY_CONCLUSION_CONTRACT, { maxItems: 100 }),
}) satisfies StructuredSchema<RawSummaryResponse>;

class SummaryAttemptError extends Error {
  constructor(readonly failure: unknown, readonly responses: LlmResponseMetadata[]) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'SummaryAttemptError';
  }
}

/**
 * Calls the model, and on a grounding rejection gives it exactly one corrective
 * attempt with the specific error quoted back.
 *
 * Mirrors task synthesis, where the same failure mode — a well-formed but
 * non-existent record ID — sank 3 of 6 measured `make demollm` runs. Grounding
 * is not weakened: the same validation runs on the retry, and a second
 * fabrication still fails.
 */
async function summarizeWithCorrection(
  client: OpenRouterClient,
  config: T2CConfig,
  mode: LlmExtractionMode,
  systemPrompt: string,
  payload: string,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
): Promise<{ conclusions: Conclusion[]; responses: LlmResponseMetadata[] }> {
  const responses: LlmResponseMetadata[] = [];
  let correction: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: payload },
      ...(correction
        ? [{
            role: 'user' as const,
            content: `The previous response was rejected: ${correction}\n`
              + 'Correct exactly that violation and re-emit the full object.'
              + ' Every diagnosticIds entry must appear verbatim in the input; recordIds must belong to those diagnostics.',
          }]
        : []),
    ];
    let completion;
    try {
      completion = await client.chatStructuredWithMetadata(
        messages, 't2c_grounded_summary', SUMMARY_RESPONSE_CONTRACT, config.openRouter.summaryModel,
      );
    } catch (error) {
      if (error instanceof StructuredResponseError) {
        if (error.responseMetadata) responses.push(error.responseMetadata);
        if (attempt === 0) {
          correction = error.message;
          continue;
        }
      }
      throw new SummaryAttemptError(error, [...responses]);
    }
    responses.push(completion.metadata);
    try {
      const conclusions = materializeConclusions(
        completion.value,
        graph,
        diagnostics,
        generationMetadata(config, mode, completion.metadata),
      );
      return { conclusions, responses };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 1) {
        throw new SummaryAttemptError(
          new Error(`Invalid structured summary response: ${message}`),
          [...responses],
        );
      }
      correction = message;
    }
  }

  throw new Error('Invalid structured summary response: retry budget exhausted');
}

function materializeConclusions(
  response: unknown,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  generation: GroundedGenerationMetadata,
): Conclusion[] {
  const parsed = SUMMARY_RESPONSE_CONTRACT.parse(response);
  const conclusions = parsed.conclusions.map((raw): Conclusion => {
    const diagnosticIds = sortedUnique(raw.diagnosticIds);
    const content: Omit<Conclusion, 'id'> = {
      schemaVersion: 't2c.conclusion/v1',
      kind: raw.kind,
      title: raw.title,
      detail: raw.detail,
      severity: raw.severity,
      diagnosticIds,
      recordIds: groundRecordIdsByDiagnostics(diagnosticIds, raw.recordIds, diagnostics),
      confidence: raw.confidence,
      generation,
    };
    return { ...content, id: createConclusionId(content) };
  });
  assertConclusions(conclusions, { graph, diagnostics });
  return conclusions.sort(compareConclusions);
}

function deterministicConclusions(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  generation: GroundedGenerationMetadata,
): Conclusion[] {
  const conclusions = diagnostics.diagnostics
    .filter((diagnostic) => diagnostic.code !== 'ALIGNED' && diagnostic.recordIds.length > 0)
    .slice(0, 100)
    .map((diagnostic): Conclusion => {
      const content: Omit<Conclusion, 'id'> = {
        schemaVersion: 't2c.conclusion/v1',
        kind: diagnostic.severity === 'blocking' || diagnostic.severity === 'review_required' ? 'risk' : 'finding',
        title: diagnostic.title,
        detail: `${diagnostic.detail} Następne działanie: ${diagnostic.suggestedAction}`,
        severity: diagnostic.severity,
        diagnosticIds: [diagnostic.id],
        recordIds: sortedUnique(diagnostic.recordIds),
        confidence: 1,
        generation,
      };
      return { ...content, id: createConclusionId(content) };
    });
  assertConclusions(conclusions, { graph, diagnostics });
  return conclusions.sort(compareConclusions);
}

function generationMetadata(
  config: T2CConfig,
  mode: GroundedGenerationMetadata['requestedMode'],
  response?: LlmResponseMetadata,
  reason?: string,
): GroundedGenerationMetadata {
  const effectiveMode = response ? 'llm' : 'deterministic';
  const degraded = mode === 'prefer-llm' && effectiveMode === 'deterministic';
  const configuration = openRouterAuditConfiguration(
    config,
    mode === 'deterministic' ? null : config.openRouter.summaryModel,
  );
  return {
    generator: 't2c/grounded-summary',
    generatorVersion: '2',
    runtimeVersion: T2C_VERSION,
    generatedAt: new Date().toISOString(),
    requestedMode: mode,
    effectiveMode,
    degraded,
    model: response ? response.model ?? config.openRouter.summaryModel : null,
    provider: response ? response.provider ?? 'openrouter' : null,
    responseId: response?.responseId ?? null,
    configurationFingerprint: sha256(stableStringify(configuration)),
    reason: degraded ? reason ?? 'LLM_UNAVAILABLE' : null,
  };
}

function summaryMode(options: SummaryOptions): GroundedGenerationMetadata['requestedMode'] {
  if (options.mode !== undefined) {
    if (options.mode === 'deterministic' || options.mode === 'prefer-llm' || options.mode === 'require-llm') {
      return options.mode;
    }
    throw new Error('Summary mode must be deterministic, prefer-llm or require-llm');
  }
  if (options.preferLlm === false) return 'deterministic';
  return options.allowDeterministicFallback ? 'prefer-llm' : 'require-llm';
}

function sortedUnique(values: string[]): string[] {
  if (!Array.isArray(values)) throw new Error('Conclusion citations must be arrays');
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}
