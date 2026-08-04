import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { compareWorkspaceIntent } from '../comparison/workspace.js';
import { pathExists, readJson, readJsonl, readText, writeJson, writeText } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import type { DiagnosticReport, IntentGraph, IntentRecord, LlmExtractionMode, NlExtractionMode, PipelineManifest, PipelineOptions, PipelineStageAudit } from '../core/types.js';
import { analyzeCommunication, renderCommunicationMarkdown } from '../communication/analyzer.js';
import { extractCommunicationIntentAudited, type ParticipantCommunicationSynthesis } from '../communication/llm.js';
import { collectGitDiff } from '../diff/git.js';
import { buildRealityView, renderRealityMarkdown, renderRealitySvg } from '../diff/reality.js';
import {
  diffText,
  renderTextDiffHtml,
  renderTextDiffSvg,
  renderUnifiedDiff,
  type FileDiff,
} from '../diff/text.js';
import { extractAstIntent } from '../extractors/ast.js';
import { extractConfigurationIntent } from '../extractors/configuration.js';
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntentAudited } from '../extractors/markdown-llm.js';
import { extractNlIntentAudited } from '../extractors/nl-llm.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { diffIntentGraphs, renderGraphDiffSvg } from '../graph/diff.js';
import { linkIntentRecords } from '../graph/linker.js';
import { runPipeline } from '../pipeline/run.js';
import { summarizeGraph } from '../summary/summarizer.js';
import type { CodeChangePlan, CodeChangeSourcePatch, Conclusion, TodoProposal } from '../core/types.js';
import {
  applyCodeChangeSourcePatch,
  createCodeChangeReviewPatch,
  createCodeChangeSourcePatch,
  createCodeChangeSourcePatchSet,
  createRepositoryPathProbe,
  closeCodeChanges,
  evaluateCodeChangeAcceptance,
  proposeCodeChangePlans,
  type ProposeCodeChangePlansResult,
} from '../synthesis/code-change-plan.js';
import { synthesizeTodoProposals, type AuditedTaskSynthesisResult, type TaskSynthesisMode } from '../synthesis/tasks-llm.js';
import { applyTodoPatch, createTodoPatch } from '../synthesis/todo-patch.js';

export type T2CAction =
  | 'extract_nl'
  | 'extract_git'
  | 'extract_ast'
  | 'extract_config'
  | 'extract_markdown'
  | 'extract_docs'
  | 'extract_communication'
  | 'analyze_communication'
  | 'link'
  | 'diagnose'
  | 'summarize'
  | 'diff'
  | 'diff_files'
  | 'diff_git'
  | 'reality'
  | 'pipeline'
  | 'compare_workspace'
  | 'propose_todo'
  | 'render_todo'
  | 'apply_todo'
  | 'propose_code_change'
  | 'render_code_change'
  | 'propose_source_patch'
  | 'apply_source_patch'
  | 'evaluate_code_change'
  | 'close_code_change';

export async function executeAction(action: T2CAction, input: Record<string, unknown>, config: T2CConfig): Promise<unknown> {
  const root = await resolveRoot(input.root, config);
  switch (action) {
    case 'extract_nl':
      return executeExtractNlAction(input, root, config);
    case 'extract_git':
      return executeExtractGitAction(root, input, config);
    case 'extract_ast':
      return executeExtractAstAction(root, config);
    case 'extract_config':
      return executeExtractConfigAction(root, config);
    case 'extract_markdown':
      return executeExtractMarkdownAction(input, root, config);
    case 'extract_docs':
      return executeExtractDocsAction(input, root, config);
    case 'extract_communication':
      return executeExtractCommunicationAction(input, root, config);
    case 'analyze_communication':
      return executeAnalyzeCommunicationAction(input, root, config);
    case 'link':
      return executeLinkAction(input, root, config);
    case 'diagnose':
      return executeDiagnoseAction(input);
    case 'summarize':
      return executeSummarizeAction(input, root, config);
    case 'propose_todo':
      return executeProposeTodoAction(input, root, config);
    case 'render_todo':
      return executeRenderTodoAction(input, root, config);
    case 'apply_todo':
      return executeApplyTodoAction(input, root, config);
    case 'propose_code_change':
      return executeProposeCodeChangeAction(input, root, config);
    case 'render_code_change':
      return executeRenderCodeChangeAction(input, root, config);
    case 'propose_source_patch':
      return executeProposeSourcePatchAction(input, root, config);
    case 'apply_source_patch':
      return executeApplySourcePatchAction(input, root, config);
    case 'evaluate_code_change':
      return executeEvaluateCodeChangeAction(input, root, config);
    case 'close_code_change':
      return executeCloseCodeChangeAction(input, root, config);
    case 'diff':
      return executeDiffAction(input, root, config);
    case 'diff_files':
      return executeDiffFilesAction(input, root, config);
    case 'diff_git':
      return executeDiffGitAction(input, root, config);
    case 'reality':
      return executeRealityAction(input, config);
    case 'pipeline':
      return executePipelineAction(input, root, config);
    case 'compare_workspace':
      return executeCompareWorkspaceAction(input, root, config);
  }
}

async function executeExtractNlAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const file = await scopedPath(input.file, 'TASK.md', root, config);
  const text = typeof input.text === 'string' ? input.text : undefined;
  return extractNlIntentAudited(
    { root, sourcePath: file, ...(text !== undefined ? { text } : {}) },
    config,
    nlModeValue(input.nlMode, config.nlMode),
  );
}

function executeExtractGitAction(root: string, input: Record<string, unknown>, config: T2CConfig): Promise<unknown> {
  return extractGitIntent({ root, count: numberValue(input.count, config.gitCommitCount, 1, 100) }, config);
}

function executeExtractAstAction(root: string, config: T2CConfig): Promise<unknown> {
  return extractAstIntent({ root }, config);
}

function executeExtractConfigAction(root: string, config: T2CConfig): Promise<unknown> {
  return extractConfigurationIntent(root, config);
}

async function executeExtractMarkdownAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  return extractMarkdownIntentAudited({
    root,
    todoPath: await nullableScopedPath(input.todo, 'TODO.md', root, config),
    changelogPath: await nullableScopedPath(input.changelog, 'CHANGELOG.md', root, config),
  }, config, llmModeValue(input.markdownMode, config.markdownMode, 'markdownMode'));
}

async function executeExtractDocsAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  return extractDocumentationIntent({
    root,
    patterns: stringList(input.patterns, config.documentPatterns),
    excludes: stringList(input.excludes, config.documentExcludes),
  }, config);
}

async function executeExtractCommunicationAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  return extractCommunicationIntentAudited({
    root,
    projectDir: await scopedPath(input.projectDir, 'project', root, config),
    ticket: nullableString(input.ticket, null),
  }, config, llmModeValue(input.communicationMode, config.communicationMode, 'communicationMode'));
}

async function executeAnalyzeCommunicationAction(
  input: Record<string, unknown>,
  root: string,
  config: T2CConfig,
): Promise<unknown> {
  let graph: IntentGraph;
  const warnings: string[] = [];
  let communicationSyntheses: ParticipantCommunicationSynthesis[] = [];
  let communicationAudit: PipelineStageAudit | null = null;
  if (input.graph !== undefined) {
    graph = objectValue<IntentGraph>(input.graph, 'graph');
  } else {
    const [communication, git, ast] = await Promise.all([
      extractCommunicationIntentAudited({
        root,
        projectDir: await scopedPath(input.projectDir, 'project', root, config),
        ticket: nullableString(input.ticket, null),
      }, config, llmModeValue(input.communicationMode, config.communicationMode, 'communicationMode')),
      extractGitIntent({ root, count: numberValue(input.gitCount, config.gitCommitCount, 1, 100) }, config),
      booleanValue(input.includeAst, true) ? extractAstIntent({ root }, config) : Promise.resolve({ records: [], warnings: [] }),
    ]);
    warnings.push(...communication.warnings, ...git.warnings, ...ast.warnings);
    communicationSyntheses = communication.participants;
    communicationAudit = communication.audit;
    graph = linkIntentRecords([...communication.records, ...git.records, ...ast.records]);
  }
  const analysis = analyzeCommunication(graph, new Date().toISOString(), communicationSyntheses);
  return {
    analysis,
    markdown: renderCommunicationMarkdown(analysis),
    warnings: [...new Set(warnings)].sort(),
    audit: communicationAudit,
    ...(booleanValue(input.includeGraph, false) ? { graph } : {}),
  };
}

async function executeLinkAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const records = await readRecords(input, root, config);
  return linkIntentRecords(records);
}

function executeDiagnoseAction(input: Record<string, unknown>): unknown {
  const graph = objectValue<IntentGraph>(input.graph, 'graph');
  return diagnoseGraph(graph);
}

function executeSummarizeAction(input: Record<string, unknown>, root: string, config: T2CConfig): unknown {
  const graph = objectValue<IntentGraph>(input.graph, 'graph');
  const diagnostics = input.diagnostics
    ? objectValue<DiagnosticReport>(input.diagnostics, 'diagnostics')
    : diagnoseGraph(graph);
  return summarizeGraph(graph, diagnostics, config, {
    mode: summaryModeValue(input.mode, input.fallback),
  });
}

async function executeProposeTodoAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const graph = await readActionObject<IntentGraph>(input.graph, input.graphPath, 'graph', root, config);
  const diagnostics = input.diagnostics !== undefined || input.diagnosticsPath !== undefined
    ? await readActionObject<DiagnosticReport>(input.diagnostics, input.diagnosticsPath, 'diagnostics', root, config)
    : diagnoseGraph(graph);
  const result = await synthesizeTodoProposals(graph, diagnostics, config, taskSynthesisMode(input.mode));
  if (input.output !== undefined) {
    const output = await scopedPath(input.output, '', root, config);
    await writeJson(output, result);
    await registerRunArtifacts(root, { taskSynthesis: output });
  }
  return result;
}

async function executeRenderTodoAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const graph = await readActionObject<IntentGraph>(input.graph, input.graphPath, 'graph', root, config);
  const diagnostics = await readActionObject<DiagnosticReport>(
    input.diagnostics, input.diagnosticsPath, 'diagnostics', root, config,
  );
  const synthesis = await readActionObject<AuditedTaskSynthesisResult>(
    input.synthesis, input.synthesisPath, 'synthesis', root, config,
  );
  const todoPath = await scopedPath(input.todo, 'TODO.md', root, config);
  const patchPath = await scopedPath(input.patch, 'TODO.patch', root, config);
  const auditPath = await scopedPath(input.audit, 'TODO.patch.json', root, config);
  const todoContent = await readText(todoPath, config.maxFileBytes);
  const rendered = createTodoPatch({
    todoPath: path.relative(root, todoPath).replace(/\\/g, '/'),
    todoContent,
    graph,
    diagnostics,
    conclusions: synthesis.conclusions,
    proposals: synthesis.proposals,
    validation: synthesis.validation,
    synthesisAudit: synthesis.audit,
  });
  await Promise.all([writeText(patchPath, rendered.markdown), writeJson(auditPath, rendered.artifact)]);
  await registerRunArtifacts(root, { todoPatch: patchPath, todoPatchAudit: auditPath });
  return {
    schemaVersion: 't2c.todo-render-result/v1',
    patchPath: path.relative(root, patchPath).replace(/\\/g, '/'),
    auditPath: path.relative(root, auditPath).replace(/\\/g, '/'),
    artifact: rendered.artifact,
  };
}

async function executeApplyTodoAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const todoPath = await scopedPath(input.todo, 'TODO.md', root, config);
  const patchPath = await scopedPath(input.patch, 'TODO.patch', root, config);
  const auditPath = await scopedPath(input.audit, 'TODO.patch.json', root, config);
  const receiptPath = await scopedPath(input.receipt, 'TODO.patch.receipt.json', root, config);
  const result = await applyTodoPatch({
    todoPath,
    patchPath,
    auditPath,
    receiptPath,
    approval: {
      actor: stringValue(input.actor, ''),
      patchHash: stringValue(input.approvalHash, ''),
    },
  });
  await registerRunArtifacts(root, { todoApplyReceipt: receiptPath });
  return result;
}

async function executeProposeCodeChangeAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const graph = await readActionObject<IntentGraph>(input.graph, input.graphPath, 'graph', root, config);
  const diagnostics = hasInputValue(input.diagnostics) || hasInputValue(input.diagnosticsPath)
    ? await readActionObject<DiagnosticReport>(input.diagnostics, input.diagnosticsPath, 'diagnostics', root, config)
    : diagnoseGraph(graph);
  const conclusions = hasInputValue(input.conclusions) || hasInputValue(input.conclusionsPath)
    ? await readActionObject<Conclusion[]>(input.conclusions, input.conclusionsPath, 'conclusions', root, config)
    : undefined;
  const proposals = hasInputValue(input.proposals) || hasInputValue(input.proposalsPath)
    ? await readActionObject<TodoProposal[]>(input.proposals, input.proposalsPath, 'proposals', root, config)
    : undefined;
  const result = proposeCodeChangePlans({
    graph,
    diagnostics,
    ...(conclusions !== undefined ? { conclusions } : {}),
    ...(proposals !== undefined ? { proposals } : {}),
    maxPlans: numberValue(input.maxPlans, 50, 1, 500),
    pathExists: createRepositoryPathProbe(root),
  });
  if (input.output !== undefined) {
    const output = await scopedPath(input.output, '', root, config);
    await writeJson(output, result);
  }
  return result;
}

async function executeRenderCodeChangeAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const planSet = await readActionObject<ProposeCodeChangePlansResult>(
    input.plans, input.plansPath, 'plans', root, config,
  );
  if (planSet.schemaVersion !== 't2c.code-change-plan-set/v1') {
    throw new Error('render_code_change requires a t2c.code-change-plan-set/v1 object');
  }
  const review = createCodeChangeReviewPatch({
    plans: planSet.plans,
    graphFingerprint: planSet.graphFingerprint,
  });
  const patchPath = input.patch !== undefined
    ? await scopedPath(input.patch, 'CODE_CHANGE.review.md', root, config)
    : null;
  const auditPath = input.audit !== undefined
    ? await scopedPath(input.audit, 'CODE_CHANGE.review.json', root, config)
    : null;
  if (patchPath) await writeText(patchPath, review.markdown);
  if (auditPath) await writeJson(auditPath, review.artifact);
  return {
    schemaVersion: 't2c.code-change-render-result/v1',
    markdown: review.markdown,
    artifact: review.artifact,
    ...(patchPath ? { patchPath: path.relative(root, patchPath).replace(/\\/g, '/') } : {}),
    ...(auditPath ? { auditPath: path.relative(root, auditPath).replace(/\\/g, '/') } : {}),
  };
}

async function executeProposeSourcePatchAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  if (hasInputValue(input.plan) || hasInputValue(input.planPath)) {
    const plan = await readActionObject<CodeChangePlan>(input.plan, input.planPath, 'plan', root, config);
    const unifiedDiffs = objectMapOfStrings(input.unifiedDiffs);
    const patch = createCodeChangeSourcePatch({
      plan,
      ...(unifiedDiffs ? { unifiedDiffs } : {}),
    });
    if (input.output !== undefined) {
      const output = await scopedPath(input.output, '', root, config);
      await writeJson(output, patch);
    }
    return patch;
  }
  const planSet = await readActionObject<ProposeCodeChangePlansResult>(
    input.plans, input.plansPath, 'plans', root, config,
  );
  if (planSet.schemaVersion !== 't2c.code-change-plan-set/v1') {
    throw new Error('propose_source_patch requires a plan or t2c.code-change-plan-set/v1');
  }
  const result = createCodeChangeSourcePatchSet({
    plans: planSet.plans,
    graphFingerprint: planSet.graphFingerprint,
  });
  if (input.output !== undefined) {
    const output = await scopedPath(input.output, '', root, config);
    await writeJson(output, result);
  }
  return result;
}

async function executeApplySourcePatchAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const patch = await readActionObject<CodeChangeSourcePatch>(input.patch, input.patchPath, 'patch', root, config);
  const receiptPath = await scopedPath(input.receipt, 'CODE_CHANGE.source.receipt.json', root, config);
  const result = await applyCodeChangeSourcePatch({
    root,
    patch,
    approval: {
      actor: stringValue(input.actor, ''),
      patchHash: stringValue(input.approvalHash, ''),
    },
    receiptPath,
  });
  return {
    ...result,
    receiptPath: path.relative(root, receiptPath).replace(/\\/g, '/'),
  };
}

async function executeEvaluateCodeChangeAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const plan = await readActionObject<CodeChangePlan>(input.plan, input.planPath, 'plan', root, config);
  const beforeGraph = await readActionObject<IntentGraph>(
    input.beforeGraph, input.beforeGraphPath, 'beforeGraph', root, config,
  );
  const beforeDiagnostics = hasInputValue(input.beforeDiagnostics) || hasInputValue(input.beforeDiagnosticsPath)
    ? await readActionObject<DiagnosticReport>(
      input.beforeDiagnostics, input.beforeDiagnosticsPath, 'beforeDiagnostics', root, config,
    )
    : diagnoseGraph(beforeGraph);
  const afterGraph = await readActionObject<IntentGraph>(
    input.afterGraph, input.afterGraphPath, 'afterGraph', root, config,
  );
  const afterDiagnostics = hasInputValue(input.afterDiagnostics) || hasInputValue(input.afterDiagnosticsPath)
    ? await readActionObject<DiagnosticReport>(
      input.afterDiagnostics, input.afterDiagnosticsPath, 'afterDiagnostics', root, config,
    )
    : undefined;
  const result = evaluateCodeChangeAcceptance({
    plan,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph,
    ...(afterDiagnostics !== undefined ? { afterDiagnostics } : {}),
  });
  if (input.output !== undefined) {
    const output = await scopedPath(input.output, '', root, config);
    await writeJson(output, result);
  }
  return result;
}

async function executeCloseCodeChangeAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const beforeGraph = await readActionObject<IntentGraph>(
    input.beforeGraph, input.beforeGraphPath, 'beforeGraph', root, config,
  );
  const beforeDiagnostics = hasInputValue(input.beforeDiagnostics) || hasInputValue(input.beforeDiagnosticsPath)
    ? await readActionObject<DiagnosticReport>(
      input.beforeDiagnostics, input.beforeDiagnosticsPath, 'beforeDiagnostics', root, config,
    )
    : diagnoseGraph(beforeGraph);
  const afterGraph = await readActionObject<IntentGraph>(
    input.afterGraph, input.afterGraphPath, 'afterGraph', root, config,
  );
  const afterDiagnostics = hasInputValue(input.afterDiagnostics) || hasInputValue(input.afterDiagnosticsPath)
    ? await readActionObject<DiagnosticReport>(
      input.afterDiagnostics, input.afterDiagnosticsPath, 'afterDiagnostics', root, config,
    )
    : diagnoseGraph(afterGraph);

  let plans: CodeChangePlan[];
  if (hasInputValue(input.input) || hasInputValue(input.inputPath)) {
    const value = await readActionObject<CodeChangePlan | ProposeCodeChangePlansResult>(
      input.input, input.inputPath, 'input', root, config,
    );
    if (value.schemaVersion === 't2c.code-change-plan/v1') plans = [value];
    else if (value.schemaVersion === 't2c.code-change-plan-set/v1') plans = value.plans;
    else throw new Error('close_code_change input must be a code-change plan or plan set');
  } else if (hasInputValue(input.plan) || hasInputValue(input.planPath)) {
    plans = [await readActionObject<CodeChangePlan>(input.plan, input.planPath, 'plan', root, config)];
  } else {
    const planSet = await readActionObject<ProposeCodeChangePlansResult>(
      input.plans, input.plansPath, 'plans', root, config,
    );
    if (planSet.schemaVersion !== 't2c.code-change-plan-set/v1') {
      throw new Error('close_code_change requires a plan or t2c.code-change-plan-set/v1');
    }
    plans = planSet.plans;
  }

  const result = closeCodeChanges({
    plans,
    before: { graph: beforeGraph, diagnostics: beforeDiagnostics },
    afterGraph,
    afterDiagnostics,
  });
  if (input.output !== undefined) {
    const output = await scopedPath(input.output, '', root, config);
    await writeJson(output, result);
  }
  return result;
}

async function executeDiffAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const beforeInput = await readGraphInput(input.beforeGraph, input.before, 'before', root, config);
  const afterInput = await readGraphInput(input.afterGraph, input.after, 'after', root, config);
  const before = filterCommunicationGraph(beforeInput, input);
  const after = filterCommunicationGraph(afterInput, input);
  const diff = diffIntentGraphs(before, after);
  const svg = booleanValue(input.includeSvg, true)
    ? renderGraphDiffSvg(diff, { maxItems: numberValue(input.maxItems, 18, 1, 100) })
    : undefined;
  if (booleanValue(input.compact, false)) {
    return {
      compact: true,
      diff: {
        generatedAt: diff.generatedAt,
        fingerprint: diff.fingerprint,
        beforeFingerprint: diff.beforeFingerprint,
        afterFingerprint: diff.afterFingerprint,
        summary: diff.summary,
      },
      ...(svg === undefined ? {} : { svg }),
    };
  }
  return {
    diff,
    ...(svg === undefined ? {} : { svg }),
  };
}

async function executeDiffFilesAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const beforePath = await scopedPath(input.before, '', root, config);
  const afterPath = await scopedPath(input.after, '', root, config);
  const [before, after] = await Promise.all([
    readText(beforePath, config.maxFileBytes),
    readText(afterPath, config.maxFileBytes),
  ]);
  const diff = diffText(before, after, {
    path: stringValue(input.path, path.relative(root, afterPath)),
    beforePath: path.relative(root, beforePath),
    afterPath: path.relative(root, afterPath),
    context: numberValue(input.context, 3, 0, 100),
  });
  return withTextDiffViews([diff], input);
}

async function executeDiffGitAction(input: Record<string, unknown>, root: string): Promise<unknown> {
  const result = await collectGitDiff({
    root,
    revision: stringValue(input.revision, 'HEAD'),
    staged: booleanValue(input.staged, false),
    context: numberValue(input.context, 3, 0, 100),
    maxFiles: numberValue(input.maxFiles, 50, 1, 500),
  });
  return { ...withTextDiffViews(result.diffs, input), revision: result.revision, staged: result.staged, warnings: result.warnings };
}

function executeRealityAction(input: Record<string, unknown>, config: T2CConfig): unknown {
  const graph = objectValue<IntentGraph>(input.graph, 'graph');
  const diagnostics = input.diagnostics
    ? objectValue<DiagnosticReport>(input.diagnostics, 'diagnostics')
    : diagnoseGraph(graph);
  const view = buildRealityView(graph, diagnostics);
  return {
    view,
    markdown: renderRealityMarkdown(view),
    ...(booleanValue(input.includeSvg, true)
      ? {
        svg: renderRealitySvg(view, {
          maxRows: numberValue(input.maxRows, 30, 1, 500),
          gapsOnly: booleanValue(input.gapsOnly, false),
        }),
      }
      : {}),
  };
}

async function executeCompareWorkspaceAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  return compareWorkspaceIntent({
    root,
    baseRef: stringValue(input.base, 'origin/main'),
    taskFile: nullableString(input.task, null),
    todoFile: nullableString(input.todo, 'TODO.md'),
    changelogFile: nullableString(input.changelog, 'CHANGELOG.md'),
    documentPatterns: stringList(input.docs, config.documentPatterns),
    documentExcludes: stringList(input.docExcludes, config.documentExcludes),
    includeDocumentationLlm: booleanValue(input.includeDocsLlm, false),
    markdownMode: llmModeValue(input.markdownMode, config.markdownMode, 'markdownMode'),
    communicationMode: llmModeValue(input.communicationMode, config.communicationMode, 'communicationMode'),
    outputDir: stringValue(input.output, config.outputDir),
    gitCommitCount: numberValue(input.gitCount, config.gitCommitCount, 1, 100),
  }, config);
}

async function executePipelineAction(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<unknown> {
  const options: PipelineOptions = {
    root,
    taskFile: await nullableScopedPath(input.task, null, root, config),
    todoFile: await nullableScopedPath(input.todo, 'TODO.md', root, config),
    changelogFile: await nullableScopedPath(input.changelog, 'CHANGELOG.md', root, config),
    documentPatterns: stringList(input.docs, config.documentPatterns),
    includeDocumentationLlm: booleanValue(input.includeDocsLlm, true),
    outputDir: await scopedPath(input.output, config.outputDir, root, config),
    gitCommitCount: numberValue(input.gitCount, config.gitCommitCount, 1, 100),
    allowSummaryFallback: booleanValue(input.summaryFallback, false),
    includeSummaryLlm: booleanValue(input.includeSummaryLlm, true),
    nlMode: nlModeValue(input.nlMode, config.nlMode),
    markdownMode: llmModeValue(input.markdownMode, config.markdownMode, 'markdownMode'),
    communicationMode: llmModeValue(input.communicationMode, config.communicationMode, 'communicationMode'),
    documentExcludes: stringList(input.docExcludes, config.documentExcludes),
    taskSynthesisMode: pipelineTaskMode(input.taskMode),
    includeCommunication: booleanValue(input.includeCommunication, true),
    projectDirectory: stringValue(input.projectDir, 'project'),
    communicationTicket: nullableString(input.communicationTicket, null),
  };
  return runPipeline(options, config);
}

function filterCommunicationGraph(graph: IntentGraph, input: Record<string, unknown>): IntentGraph {
  const filter = parseCommunicationGraphFilter(input);
  if (!filter.hasFilters) return graph;
  const records = graph.records.filter((record) => matchesCommunicationFilter(record, filter));
  return linkIntentRecords(records, graph.generatedAt);
}

interface CommunicationGraphFilter {
  hasFilters: boolean;
  participant: string;
  role: string;
  ticket: string;
  communicationOnly: boolean;
}

function parseCommunicationGraphFilter(input: Record<string, unknown>): CommunicationGraphFilter {
  const participant = stringValue(input.participant, '').toLowerCase();
  const role = stringValue(input.role, '').toLowerCase();
  const ticket = stringValue(input.ticket, '').toLowerCase();
  const communicationOnly = booleanValue(input.communicationOnly, false);
  return {
    participant,
    role,
    ticket,
    communicationOnly,
    hasFilters: participant !== '' || role !== '' || ticket !== '' || communicationOnly,
  };
}

function matchesCommunicationFilter(record: IntentRecord, filter: CommunicationGraphFilter): boolean {
  if (filter.communicationOnly && record.source.kind !== 'agent_log') return false;
  if (!matchesParticipant(record, filter.participant)) return false;
  if (!matchesRole(record, filter.role)) return false;
  if (!matchesTicket(record, filter.ticket)) return false;
  return true;
}

function matchesParticipant(record: IntentRecord, participant: string): boolean {
  if (!participant) return true;
  if (record.source.kind !== 'agent_log') return false;
  return String(record.metadata.participant ?? '').toLowerCase() === participant;
}

function matchesRole(record: IntentRecord, role: string): boolean {
  if (!role) return true;
  if (record.source.kind !== 'agent_log') return false;
  return String(record.metadata.participantRole ?? '').toLowerCase() === role;
}

function matchesTicket(record: IntentRecord, ticket: string): boolean {
  if (!ticket) return true;
  return record.statement.target.tickets.some((value) => value.toLowerCase() === ticket);
}

function nlModeValue(value: unknown, fallback: NlExtractionMode): NlExtractionMode {
  return llmModeValue(value, fallback, 'nlMode');
}

function llmModeValue(value: unknown, fallback: LlmExtractionMode, name: string): LlmExtractionMode {
  if (value === undefined) return fallback;
  if (value === 'deterministic' || value === 'prefer-llm' || value === 'require-llm') return value;
  throw new Error(`${name} must be deterministic, prefer-llm or require-llm`);
}

function taskSynthesisMode(value: unknown): TaskSynthesisMode {
  if (value === undefined || value === 'require-llm') return 'require-llm';
  if (value === 'prefer-llm') return 'prefer-llm';
  throw new Error('mode must be prefer-llm or require-llm');
}

function summaryModeValue(value: unknown, legacyFallback: unknown): LlmExtractionMode {
  if (value !== undefined) return llmModeValue(value, 'require-llm', 'mode');
  if (legacyFallback !== undefined) return booleanValue(legacyFallback, false) ? 'prefer-llm' : 'require-llm';
  return 'require-llm';
}

function pipelineTaskMode(value: unknown): 'disabled' | 'prefer-llm' | 'require-llm' {
  if (value === undefined || value === 'disabled') return 'disabled';
  if (value === 'prefer-llm' || value === 'require-llm') return value;
  throw new Error('taskMode must be disabled, prefer-llm or require-llm');
}

function withTextDiffViews(diffs: FileDiff[], input: Record<string, unknown>): Record<string, unknown> {
  const title = stringValue(input.title, 'todo2code File Diff');
  return {
    diffs,
    unified: diffs.map(renderUnifiedDiff).join(''),
    ...(booleanValue(input.includeSvg, true)
      ? { svg: renderTextDiffSvg(diffs, { title, maxRows: numberValue(input.maxRows, 400, 1, 4000) }) }
      : {}),
    ...(booleanValue(input.includeHtml, false) ? { html: renderTextDiffHtml(diffs, { title }) } : {}),
  };
}

async function readGraphInput(
  graphValue: unknown,
  pathValue: unknown,
  name: string,
  root: string,
  config: T2CConfig,
): Promise<IntentGraph> {
  if (graphValue !== undefined) return objectValue<IntentGraph>(graphValue, `${name}Graph`);
  if (typeof pathValue !== 'string' || !pathValue.trim()) {
    throw new Error(`diff requires ${name}Graph object or ${name} graph path`);
  }
  const safePath = await assertPathWithinRoot(root, path.resolve(root, pathValue), config.allowOutsideRoot);
  return readJson<IntentGraph>(safePath);
}

async function readActionObject<T>(
  objectInput: unknown,
  pathInput: unknown,
  name: string,
  root: string,
  config: T2CConfig,
): Promise<T> {
  if (objectInput !== undefined) return objectValue<T>(objectInput, name);
  if (typeof pathInput !== 'string' || !pathInput.trim()) {
    throw new Error(`${name} object or ${name}Path is required`);
  }
  const safePath = await assertPathWithinRoot(root, path.resolve(root, pathInput), config.allowOutsideRoot);
  return readJson<T>(safePath);
}

async function resolveRoot(value: unknown, config: T2CConfig): Promise<string> {
  const requested = path.resolve(config.root, typeof value === 'string' && value.trim() ? value : '.');
  return assertPathWithinRoot(config.root, requested, config.allowOutsideRoot);
}

async function scopedPath(
  value: unknown,
  fallback: string,
  root: string,
  config: T2CConfig,
): Promise<string> {
  const selected = stringValue(value, fallback);
  return assertPathWithinRoot(root, path.resolve(root, selected), config.allowOutsideRoot);
}

async function nullableScopedPath(
  value: unknown,
  fallback: string | null,
  root: string,
  config: T2CConfig,
): Promise<string | null> {
  const selected = nullableString(value, fallback);
  if (selected === null) return null;
  return assertPathWithinRoot(root, path.resolve(root, selected), config.allowOutsideRoot);
}

async function readRecords(input: Record<string, unknown>, root: string, config: T2CConfig): Promise<IntentRecord[]> {
  if (Array.isArray(input.records)) return input.records as IntentRecord[];
  const files = stringList(input.files, []);
  if (files.length === 0) throw new Error('link requires records[] or files[]');
  const output: IntentRecord[] = [];
  for (const file of files) {
    const safeFile = await assertPathWithinRoot(root, path.resolve(root, file), config.allowOutsideRoot);
    output.push(...await readJsonl(safeFile));
  }
  return output;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown, fallback: string | null): string | null {
  if (value === null || value === false) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback;
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Expected number between ${min} and ${max}`);
  return Math.trunc(number);
}

function hasInputValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/** Optional map of relative path → string (used for unified diffs). */
function objectMapOfStrings(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('unifiedDiffs must be an object of path to string');
  }
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== 'string') throw new Error(`unifiedDiffs.${key} must be a string`);
    output[key] = item;
  }
  return output;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
}

function objectValue<T>(value: unknown, name: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as T;
}

async function registerRunArtifacts(root: string, artifacts: Record<string, string>): Promise<void> {
  const directories = [...new Set(Object.values(artifacts).map((file) => path.dirname(file)))];
  for (const directory of directories) {
    const manifestPath = path.join(directory, 'manifest.json');
    if (!(await pathExists(manifestPath))) continue;
    const manifest = await readJson<PipelineManifest>(manifestPath, 2 * 1024 * 1024);
    if (path.resolve(manifest.root) !== path.resolve(root) || manifest.status === 'failed') {
      throw new Error('Refusing to register TODO artifacts in an unrelated or failed run manifest');
    }
    for (const [name, file] of Object.entries(artifacts)) {
      if (path.dirname(file) === directory) manifest.files[name] = path.relative(root, file).replace(/\\/g, '/');
    }
    await writeJson(manifestPath, manifest);
  }
}
