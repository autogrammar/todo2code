import { summarizeGraph } from '../summary/summarizer.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { T2C_VERSION } from '../version.js';
import type { PipelineOptions, PipelineStageAudit } from '../core/types.js';
import type { DiagnosticReport } from '../core/types.js';
import type { T2CConfig } from '../config/env.js';
import { hasOpenRouter } from '../config/env.js';

export interface SummaryResult {
  summary: Awaited<ReturnType<typeof summarizeGraph>>;
  audit: PipelineStageAudit;
}

export async function collectSummary(
  graph: Parameters<typeof summarizeGraph>[0],
  diagnostics: DiagnosticReport,
  config: T2CConfig,
  options: PipelineOptions,
): Promise<SummaryResult> {
  const summaryStartedAt = Date.now();
  const includeSummaryLlm = options.includeSummaryLlm !== false;
  const summary = await summarizeGraph(graph, diagnostics, config, {
    allowDeterministicFallback: options.allowSummaryFallback,
    preferLlm: includeSummaryLlm,
  });
  const summaryAudit: PipelineStageAudit = !includeSummaryLlm
    ? {
        runtimeVersion: T2C_VERSION,
        configuration: openRouterAuditConfiguration(config, null),
        status: 'skipped', requestedMode: 'deterministic', effectiveMode: 'deterministic', degraded: false,
        recordCount: summary.conclusions.length, warningCount: 0, model: null,
        durationMs: Date.now() - summaryStartedAt,
        reason: { code: 'LLM_DISABLED', message: 'LLM summary was disabled; generated the deterministic report' },
        responses: [],
      }
    : summary.llmUsed
      ? {
          runtimeVersion: T2C_VERSION,
          configuration: openRouterAuditConfiguration(config, config.openRouter.summaryModel),
          status: 'succeeded', requestedMode: 'llm', effectiveMode: 'llm', degraded: false,
          recordCount: summary.conclusions.length, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
          durationMs: Date.now() - summaryStartedAt, reason: null, responses: summary.responses,
        }
      : {
          runtimeVersion: T2C_VERSION,
          configuration: openRouterAuditConfiguration(config, config.openRouter.summaryModel),
          status: 'fallback', requestedMode: 'llm', effectiveMode: 'deterministic', degraded: true,
          recordCount: summary.conclusions.length, warningCount: summary.warnings.length, model: config.openRouter.summaryModel,
          durationMs: Date.now() - summaryStartedAt,
          reason: {
            code: hasOpenRouter(config) ? 'LLM_UNAVAILABLE' : 'LLM_NOT_CONFIGURED',
            message: summary.warnings[0] ?? 'Deterministic summary fallback was used',
          },
          responses: [],
        };

  return { summary, audit: summaryAudit };
}
