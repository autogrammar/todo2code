import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import { pathExists } from '../core/io.js';
import type { DiagnosticReport, IntentGraph, IntentRecord } from '../core/types.js';
import { OpenRouterClient } from '../llm/openrouter.js';

export interface SummaryResult {
  markdown: string;
  llmUsed: boolean;
  warnings: string[];
}

export interface SummaryOptions {
  allowDeterministicFallback: boolean;
}

export async function summarizeGraph(
  graph: IntentGraph,
  diagnostics: DiagnosticReport,
  config: T2CConfig,
  options: SummaryOptions,
): Promise<SummaryResult> {
  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    if (!options.allowDeterministicFallback) throw new Error('OPENROUTER_API_KEY is required for Intent DSL -> NL summarization');
    return {
      markdown: deterministicSummary(graph, diagnostics),
      llmUsed: false,
      warnings: ['OPENROUTER_API_KEY is not configured; generated deterministic fallback summary'],
    };
  }

  const systemPrompt = await readPrompt('summarize.system.md');
  const payload = compactPayload(graph, diagnostics);
  try {
    const markdown = await client.chatText([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(payload) },
    ], config.openRouter.summaryModel);
    return {
      markdown: validateAndAppendSources(markdown, graph),
      llmUsed: true,
      warnings: [],
    };
  } catch (error) {
    if (!options.allowDeterministicFallback) throw error;
    return {
      markdown: deterministicSummary(graph, diagnostics),
      llmUsed: false,
      warnings: [`OpenRouter summary failed; generated deterministic fallback: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function compactPayload(graph: IntentGraph, diagnostics: DiagnosticReport): Record<string, unknown> {
  const referenced = new Set(diagnostics.diagnostics.flatMap((item) => item.recordIds));
  const selected = graph.records.filter((record) => {
    if (referenced.has(record.id)) return true;
    if (record.source.kind !== 'ast') return true;
    return record.statement.kind === 'symbol_fact' || record.statement.kind === 'python_symbol_fact';
  }).slice(0, 1200);
  const ids = new Set(selected.map((record) => record.id));
  return {
    graph: {
      schemaVersion: graph.schemaVersion,
      fingerprint: graph.fingerprint,
      stats: graph.stats,
      records: selected.map(compactRecord),
      relations: graph.relations.filter((relation) => ids.has(relation.from) && ids.has(relation.to)).slice(0, 3000),
    },
    diagnostics,
    truncation: {
      originalRecords: graph.records.length,
      includedRecords: selected.length,
      originalRelations: graph.relations.length,
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

function deterministicSummary(graph: IntentGraph, diagnostics: DiagnosticReport): string {
  const plans = graph.records.filter((record) => ['nl', 'todo', 'document'].includes(record.source.kind));
  const git = graph.records.filter((record) => record.source.kind === 'git');
  const facts = graph.records.filter((record) => record.source.kind === 'ast' && ['symbol_fact', 'python_symbol_fact'].includes(record.statement.kind));
  const releases = graph.records.filter((record) => record.source.kind === 'changelog');
  const blocking = diagnostics.diagnostics.filter((item) => item.severity === 'blocking' || item.severity === 'review_required');
  const lines: string[] = [
    '# Podsumowanie todo2code',
    '',
    '> Wygenerowano deterministycznie, ponieważ podsumowanie OpenRouter nie było dostępne. Rekordy LLM z dokumentacji, jeśli istnieją w grafie, pozostają oznaczone jako `llm_inference`.',
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
    '## Rozbieżności',
    '',
  ];
  if (blocking.length === 0) {
    lines.push('- Nie wykryto rozbieżności blokujących. Nie oznacza to automatycznego zatwierdzenia `DONE`.');
  } else {
    for (const item of blocking.slice(0, 30)) {
      lines.push(`- **${item.code}** — ${item.detail}${item.recordIds.length ? ` [${item.recordIds.join('] [')}]` : ''}`);
    }
  }
  lines.push('', '## Następne działania', '');
  const actions = diagnostics.diagnostics.filter((item) => item.code !== 'ALIGNED').slice(0, 20);
  if (actions.length === 0) lines.push('- Przeprowadzić przegląd człowieka i zatwierdzić albo odrzucić wynik.');
  for (const item of actions) lines.push(`- ${item.suggestedAction}${item.recordIds.length ? ` [${item.recordIds.join('] [')}]` : ''}`);
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

function validateAndAppendSources(markdown: string, graph: IntentGraph): string {
  const known = new Set(graph.records.map((record) => record.id));
  const cited = [...markdown.matchAll(/\[(INT-[A-Z]+-[a-f0-9]{20})\]/g)].map((match) => match[1]).filter((id): id is string => Boolean(id));
  const unknown = [...new Set(cited.filter((id) => !known.has(id)))];
  const appendix = [
    '',
    '---',
    '',
    'Źródło danych: graf `' + graph.fingerprint + '`.',
  ];
  if (unknown.length) appendix.push(`Nieznane identyfikatory wygenerowane przez model i nieuwzględnione jako źródła: ${unknown.map((id) => `\`${id}\``).join(', ')}.`);
  return `${markdown.trim()}\n${appendix.join('\n')}\n`;
}

async function readPrompt(name: string): Promise<string> {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts', name);
  if (!(await pathExists(promptPath))) throw new Error(`Prompt not found: ${promptPath}`);
  return fs.readFile(promptPath, 'utf8');
}
