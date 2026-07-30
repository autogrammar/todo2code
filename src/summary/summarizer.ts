import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { createConclusionId, sha256, stableStringify } from '../core/id.js';
import { pathExists } from '../core/io.js';
import { assertConclusions } from '../core/schema.js';
import type {
  Conclusion,
  ConclusionKind,
  DiagnosticReport,
  DiagnosticSeverity,
  GroundedGenerationMetadata,
  IntentGraph,
  IntentRecord,
  LlmResponseMetadata,
  LlmExtractionMode,
} from '../core/types.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { T2C_VERSION } from '../version.js';

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
      markdown: renderSummary(
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
      markdown: renderSummary(graph, conclusions),
      llmUsed: false,
      warnings: ['OPENROUTER_API_KEY is not configured; generated deterministic fallback summary'],
      responses: [],
    };
  }

  const systemPrompt = await readPrompt('summarize.system.md');
  const payload = compactPayload(graph, diagnostics);
  try {
    const completion = await client.chatJsonWithMetadata<unknown>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(payload) },
    ], 't2c_grounded_summary', responseSchema(), config.openRouter.summaryModel);
    let conclusions: Conclusion[];
    try {
      conclusions = materializeConclusions(
        completion.value,
        graph,
        diagnostics,
        generationMetadata(config, mode, completion.metadata),
      );
    } catch (error) {
      throw new Error(`Invalid structured summary response: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
      conclusions,
      markdown: renderSummary(
        graph,
        conclusions,
        'Wnioski modelu zostały zmaterializowane i zwalidowane jako `t2c.conclusion/v1` przed renderowaniem raportu.',
      ),
      llmUsed: true,
      warnings: [],
      responses: [completion.metadata],
    };
  } catch (error) {
    if (mode === 'require-llm') throw error;
    const reason = 'LLM_UNAVAILABLE';
    const conclusions = deterministicConclusions(
      graph,
      diagnostics,
      generationMetadata(config, mode, undefined, reason),
    );
    return {
      conclusions,
      markdown: renderSummary(graph, conclusions),
      llmUsed: false,
      warnings: [`OpenRouter summary failed; generated deterministic fallback: ${error instanceof Error ? error.message : String(error)}`],
      responses: [],
    };
  }
}

function compactPayload(graph: IntentGraph, diagnostics: DiagnosticReport): Record<string, unknown> {
  const maxRecords = 400;
  const maxRelations = 800;
  const maxDiagnostics = 250;
  const referenced = new Set(diagnostics.diagnostics.flatMap((item) => item.recordIds));
  // Documentation and other declared/claimed evidence must survive the payload
  // budget even in AST-heavy repositories. Previously a large block of
  // diagnostic-referenced AST facts could consume the first 1200 slots before
  // the model saw any documentation records.
  const nonAst = graph.records.filter((record) => record.source.kind !== 'ast');
  const moduleAst = graph.records.filter((record) => (
    record.source.kind === 'ast' && record.statement.kind === 'module_fact'
  ));
  const relevantAst = graph.records.filter((record) => record.source.kind === 'ast'
    && record.statement.kind !== 'module_fact' && (
    referenced.has(record.id)
    || record.statement.kind === 'symbol_fact'
    || record.statement.kind === 'python_symbol_fact'
  ));
  const selected = [...nonAst, ...moduleAst, ...relevantAst].slice(0, maxRecords);
  const ids = new Set(selected.map((record) => record.id));
  const selectedRelations = graph.relations
    .filter((relation) => ids.has(relation.from) && ids.has(relation.to))
    .slice(0, maxRelations);
  const severityRank: Record<string, number> = { blocking: 0, review_required: 1, warning: 2, info: 3 };
  const selectedDiagnostics = [...diagnostics.diagnostics]
    .sort((left, right) => (severityRank[left.severity] ?? 4) - (severityRank[right.severity] ?? 4)
      || left.code.localeCompare(right.code)
      || left.id.localeCompare(right.id))
    .slice(0, maxDiagnostics);
  return {
    graph: {
      schemaVersion: graph.schemaVersion,
      fingerprint: graph.fingerprint,
      stats: graph.stats,
      records: selected.map(compactRecord),
      relations: selectedRelations,
    },
    diagnostics: { ...diagnostics, diagnostics: selectedDiagnostics },
    truncation: {
      originalRecords: graph.records.length,
      includedRecords: selected.length,
      originalRelations: graph.relations.length,
      includedRelations: selectedRelations.length,
      originalDiagnostics: diagnostics.diagnostics.length,
      includedDiagnostics: selectedDiagnostics.length,
      includedBySource: Object.fromEntries(Object.entries(
        selected.reduce<Record<string, number>>((counts, record) => {
          counts[record.source.kind] = (counts[record.source.kind] ?? 0) + 1;
          return counts;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right))),
    },
  };
}

function compactRecord(record: IntentRecord): Record<string, unknown> {
  return {
    id: record.id,
    statement: record.statement,
    lifecycle: record.lifecycle,
    source: {
      kind: record.source.kind,
      path: record.source.path,
      lines: record.source.lines,
      revision: record.source.revision,
      symbol: record.source.symbol,
      commitIndex: record.source.commitIndex,
    },
    epistemic: record.epistemic,
    observedAt: record.observedAt,
  };
}

function renderSummary(
  graph: IntentGraph,
  conclusions: Conclusion[],
  provenance = 'Wygenerowano deterministycznie, ponieważ podsumowanie OpenRouter nie było dostępne.',
): string {
  const plans = graph.records.filter((record) => ['nl', 'todo', 'document'].includes(record.source.kind));
  const git = graph.records.filter((record) => record.source.kind === 'git');
  const moduleFacts = graph.records.filter((record) => (
    record.source.kind === 'ast' && record.statement.kind === 'module_fact'
  ));
  const facts = moduleFacts.length > 0 ? moduleFacts : graph.records.filter((record) => (
    record.source.kind === 'ast' && ['symbol_fact', 'python_symbol_fact'].includes(record.statement.kind)
  ));
  const releases = graph.records.filter((record) => record.source.kind === 'changelog');
  const communication = graph.records.filter((record) => record.source.kind === 'agent_log');
  const lines: string[] = [
    '# Podsumowanie todo2code',
    '',
    `> ${provenance} Raport jest projekcją ${conclusions.length} zwalidowanych wniosków; rekordy LLM z dokumentacji pozostają oznaczone jako \`llm_inference\`.`,
    '',
    '## Cel',
    '',
    ...renderRecords(plans.filter((record) => record.source.kind === 'nl' || record.source.kind === 'document'), 12, 'Brak wyodrębnionej deklaracji celu.'),
    '',
    '## Plan',
    '',
    ...renderRecords(plans.filter((record) => record.source.kind === 'todo'), 20, 'Brak pozycji TODO.'),
    '',
    '## Zmiany deklarowane w Git',
    '',
    ...renderRecords(git, 10, 'Brak dostępnej historii Git.'),
    '',
    '## Stan rzeczywisty kodu',
    '',
    ...renderRecords(facts, 25, 'Brak publicznych faktów AST.'),
    '',
    '## Dokumentacja i wydania',
    '',
    ...renderRecords(releases, 20, 'Brak wpisów changelogu.'),
    '',
    '## Komunikacja ludzi i agentów',
    '',
    ...renderRecords(communication, 30, 'Brak wersjonowanych rekordów komunikacji.'),
    '',
    '## Rozbieżności',
    '',
  ];
  const ordered = [...conclusions].sort(compareConclusions);
  if (ordered.length === 0) {
    lines.push('- Nie wykryto rozbieżności blokujących. Nie oznacza to automatycznego zatwierdzenia `DONE`.');
  } else {
    for (const conclusion of ordered.slice(0, 30)) {
      lines.push(renderConclusion(conclusion));
    }
  }
  lines.push('', '## Następne działania', '');
  const actions = ordered.filter((item) => item.kind === 'recommendation' || item.severity !== 'info').slice(0, 20);
  if (actions.length === 0) lines.push('- Przeprowadzić przegląd człowieka i zatwierdzić albo odrzucić wynik.');
  for (const conclusion of actions) {
    lines.push(`- Zweryfikować: **${conclusion.title}** — ${conclusion.detail} ${recordCitations(conclusion.recordIds)}`);
  }
  lines.push('', 'Graf: `' + graph.fingerprint + '`.');
  return `${lines.join('\n')}\n`;
}

function renderRecords(records: IntentRecord[], limit: number, empty: string): string[] {
  if (records.length === 0) return [`- ${empty}`];
  return records.slice(0, limit).map((record) => {
    const confidence = Math.round(record.epistemic.confidence * 100);
    return `- ${record.statement.text} — ${record.source.kind}/${record.epistemic.class}, ${confidence}% [${record.id}]`;
  });
}

const CONCLUSION_KINDS: ConclusionKind[] = ['finding', 'risk', 'decision', 'recommendation'];
const CONCLUSION_SEVERITIES: DiagnosticSeverity[] = ['info', 'warning', 'review_required', 'blocking'];

/**
 * Checks the envelope before any field is read.
 *
 * A provider that does not honour `response_format.json_schema` returns
 * well-formed JSON of an entirely different shape. Naming the keys it did
 * return turns an unexplained fallback into a one-line diagnosis — measured
 * against `qwen/qwen3.7-flash`, which answered `{conclusion, status}` and made
 * every summary degrade silently.
 */
function assertRawSummaryShape(response: unknown): asserts response is RawSummaryResponse {
  if (!response || typeof response !== 'object') {
    throw new Error(`response must be an object, received ${response === null ? 'null' : typeof response}`);
  }
  const candidate = response as Record<string, unknown>;
  if (!Array.isArray(candidate.conclusions)) {
    const keys = Object.keys(response).sort();
    throw new Error(
      'conclusions must be an array; the model did not honour the t2c_grounded_summary schema'
      + ` (returned keys: ${keys.length ? keys.join(', ') : 'none'})`,
    );
  }
}

/** Validates one conclusion so a bad field is named instead of throwing a TypeError. */
function assertRawConclusion(raw: unknown, index: number): asserts raw is RawConclusion {
  const at = `conclusions[${index}]`;
  if (!raw || typeof raw !== 'object') throw new Error(`${at} must be an object`);
  const candidate = raw as Record<string, unknown>;
  requireText(candidate.title, `${at}.title`);
  requireText(candidate.detail, `${at}.detail`);
  if (!CONCLUSION_KINDS.includes(candidate.kind as ConclusionKind)) {
    throw new Error(`${at}.kind must be one of ${CONCLUSION_KINDS.join(', ')} (received ${describe(candidate.kind)})`);
  }
  if (!CONCLUSION_SEVERITIES.includes(candidate.severity as DiagnosticSeverity)) {
    throw new Error(`${at}.severity must be one of ${CONCLUSION_SEVERITIES.join(', ')} (received ${describe(candidate.severity)})`);
  }
  requireIdArray(candidate.diagnosticIds, `${at}.diagnosticIds`);
  requireIdArray(candidate.recordIds, `${at}.recordIds`);
  if (typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence)
    || candidate.confidence < 0 || candidate.confidence > 1) {
    throw new Error(`${at}.confidence must be a number between 0 and 1 (received ${describe(candidate.confidence)})`);
  }
}

function requireText(value: unknown, at: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${at} must be a non-empty string (received ${describe(value)})`);
  }
}

function requireIdArray(value: unknown, at: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${at} must be a non-empty array (received ${describe(value)})`);
  }
  const bad = value.find((item) => typeof item !== 'string' || !item.trim());
  if (bad !== undefined) throw new Error(`${at} must contain only non-empty strings (received ${describe(bad)})`);
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function materializeConclusions(
  response: unknown,
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  generation: GroundedGenerationMetadata,
): Conclusion[] {
  assertRawSummaryShape(response);
  const conclusions = response.conclusions.map((raw, index): Conclusion => {
    assertRawConclusion(raw, index);
    const content: Omit<Conclusion, 'id'> = {
      schemaVersion: 't2c.conclusion/v1',
      kind: raw.kind,
      title: raw.title,
      detail: raw.detail,
      severity: raw.severity,
      diagnosticIds: sortedUnique(raw.diagnosticIds),
      recordIds: sortedUnique(raw.recordIds),
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
    generatorVersion: '1',
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

function compareConclusions(left: Conclusion, right: Conclusion): number {
  const severity: Record<DiagnosticSeverity, number> = { blocking: 0, review_required: 1, warning: 2, info: 3 };
  return severity[left.severity] - severity[right.severity] || left.id.localeCompare(right.id);
}

function renderConclusion(conclusion: Conclusion): string {
  const confidence = Math.round(conclusion.confidence * 100);
  return `- **${conclusion.title}** (${conclusion.kind}/${conclusion.severity}, ${confidence}%) — ${conclusion.detail} ${recordCitations(conclusion.recordIds)} _[${conclusion.diagnosticIds.join('] [')}]_`;
}

function recordCitations(recordIds: string[]): string {
  return `[${recordIds.join('] [')}]`;
}

function sortedUnique(values: string[]): string[] {
  if (!Array.isArray(values)) throw new Error('Conclusion citations must be arrays');
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function responseSchema(): Record<string, unknown> {
  const idArray = (pattern: string): Record<string, unknown> => ({
    type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', pattern },
  });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['conclusions'],
    properties: {
      conclusions: {
        type: 'array',
        maxItems: 100,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'title', 'detail', 'severity', 'diagnosticIds', 'recordIds', 'confidence'],
          properties: {
            kind: { enum: ['finding', 'risk', 'decision', 'recommendation'] },
            title: { type: 'string', minLength: 1 },
            detail: { type: 'string', minLength: 1 },
            severity: { enum: ['info', 'warning', 'review_required', 'blocking'] },
            diagnosticIds: idArray('^DIAG-[a-f0-9]{20}$'),
            recordIds: idArray('^INT-[A-Z]+-[a-f0-9]{20}$'),
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
  };
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}
