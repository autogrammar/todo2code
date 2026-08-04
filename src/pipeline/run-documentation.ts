import { hasOpenRouter } from '../config/env.js';
import type { PipelineOptions, PipelineStageAudit } from '../core/types.js';
import type { T2CConfig } from '../config/env.js';
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractDocumentationBaseline } from '../extractors/docs-deterministic.js';
import { openRouterAuditConfiguration } from '../llm/audit.js';
import { T2C_VERSION } from '../version.js';
import type { PipelineContext } from './run-types.js';
import { collectTargetHints } from './run-helpers.js';
import { skippedAudit } from './run-failed.js';

export async function collectDocumentationExtraction(
  context: PipelineContext,
  options: PipelineOptions,
  config: T2CConfig,
  deterministicDocumentFiles: string[],
): Promise<{ documentationAudit: PipelineStageAudit; deterministicDocsCount: number }> {
  const { root, warnings, bySource } = context;
  const documentationStartedAt = Date.now();
  const deterministicDocs = await extractDocumentationBaseline({ root, files: deterministicDocumentFiles }, config);
  bySource.document = deterministicDocs.records;
  warnings.push(...deterministicDocs.warnings);

  let documentationAudit: PipelineStageAudit = deterministicDocumentFiles.length === 0
    ? skippedAudit('deterministic', 'No documentation files matched the configured patterns')
    : {
        runtimeVersion: T2C_VERSION,
        configuration: { generator: 't2c/markdown-documentation', generatorVersion: '2' },
        status: deterministicDocs.warnings.length ? 'partial' : 'succeeded',
        requestedMode: 'deterministic',
        effectiveMode: 'deterministic',
        degraded: deterministicDocs.warnings.length > 0,
        recordCount: deterministicDocs.records.length,
        warningCount: deterministicDocs.warnings.length,
        model: null,
        durationMs: Date.now() - documentationStartedAt,
        reason: deterministicDocs.warnings.length
          ? { code: 'DOCUMENT_EXTRACTION_PARTIAL', message: `${deterministicDocs.warnings.length} deterministic documentation warning(s)` }
          : null,
        responses: [],
      };

  if (options.includeDocumentationLlm) {
    if (hasOpenRouter(config)) {
      const docs = await extractDocumentationIntent({
        root,
        patterns: options.documentPatterns,
        excludes: options.documentExcludes ?? config.documentExcludes,
        targetHints: collectTargetHints(Object.values(bySource).flat()),
      }, config);
      bySource.document.push(...docs.records);
      warnings.push(...docs.warnings);
      documentationAudit = {
        ...docs.audit,
        recordCount: bySource.document.length,
        configuration: {
          ...docs.audit.configuration,
          deterministicGenerator: 't2c/markdown-documentation@2',
          deterministicRecordCount: deterministicDocs.records.length,
        },
      };
    } else {
      const message = 'OPENROUTER_API_KEY is not configured; documentation -> Intent DSL was skipped';
      warnings.push(message);
      documentationAudit = {
        ...skippedAudit('llm', message),
        configuration: openRouterAuditConfiguration(config, config.openRouter.documentModel, config.documentTimeoutMs),
        status: deterministicDocs.records.length ? 'fallback' : 'failed',
        effectiveMode: deterministicDocs.records.length ? 'deterministic' : 'none',
        degraded: true,
        recordCount: deterministicDocs.records.length,
        model: config.openRouter.documentModel,
        reason: { code: 'LLM_NOT_CONFIGURED', message },
        responses: [],
      };
    }
  }

  return { documentationAudit, deterministicDocsCount: deterministicDocs.records.length };
}
