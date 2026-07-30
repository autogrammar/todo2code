import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { compareWorkspaceIntent } from '../comparison/workspace.js';
import { pathExists, readJson, readJsonl, readText, writeJson, writeText } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import type { DiagnosticReport, IntentGraph, IntentRecord, LlmExtractionMode, NlExtractionMode, PipelineManifest, PipelineOptions } from '../core/types.js';
import { analyzeCommunication, renderCommunicationMarkdown } from '../communication/analyzer.js';
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
import { extractDocumentationIntent } from '../extractors/docs-llm.js';
import { extractCommunicationIntent } from '../extractors/communication.js';
import { extractGitIntent } from '../extractors/git.js';
import { extractMarkdownIntentAudited } from '../extractors/markdown-llm.js';
import { extractNlIntentAudited } from '../extractors/nl-llm.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import { diffIntentGraphs, renderGraphDiffSvg } from '../graph/diff.js';
import { linkIntentRecords } from '../graph/linker.js';
import { runPipeline } from '../pipeline/run.js';
import { summarizeGraph } from '../summary/summarizer.js';
import { synthesizeTodoProposals, type AuditedTaskSynthesisResult, type TaskSynthesisMode } from '../synthesis/tasks-llm.js';
import { applyTodoPatch, createTodoPatch } from '../synthesis/todo-patch.js';

export type T2CAction =
  | 'extract_nl'
  | 'extract_git'
  | 'extract_ast'
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
  | 'apply_todo';

export async function executeAction(action: T2CAction, input: Record<string, unknown>, config: T2CConfig): Promise<unknown> {
  const root = await resolveRoot(input.root, config);
  switch (action) {
    case 'extract_nl': {
      const file = await scopedPath(input.file, 'TASK.md', root, config);
      const text = typeof input.text === 'string' ? input.text : undefined;
      return extractNlIntentAudited(
        { root, sourcePath: file, ...(text !== undefined ? { text } : {}) },
        config,
        nlModeValue(input.nlMode, config.nlMode),
      );
    }
    case 'extract_git':
      return extractGitIntent({ root, count: numberValue(input.count, config.gitCommitCount, 1, 100) }, config);
    case 'extract_ast':
      return extractAstIntent({ root }, config);
    case 'extract_markdown':
      return extractMarkdownIntentAudited({
        root,
        todoPath: await nullableScopedPath(input.todo, 'TODO.md', root, config),
        changelogPath: await nullableScopedPath(input.changelog, 'CHANGELOG.md', root, config),
      }, config, llmModeValue(input.markdownMode, config.markdownMode, 'markdownMode'));
    case 'extract_docs':
      return extractDocumentationIntent({
        root,
        patterns: stringList(input.patterns, config.documentPatterns),
        excludes: stringList(input.excludes, config.documentExcludes),
      }, config);
    case 'extract_communication':
      return extractCommunicationIntent({
        root,
        projectDir: await scopedPath(input.projectDir, 'project', root, config),
        ticket: nullableString(input.ticket, null),
      }, config);
    case 'analyze_communication': {
      let graph: IntentGraph;
      const warnings: string[] = [];
      if (input.graph !== undefined) {
        graph = objectValue<IntentGraph>(input.graph, 'graph');
      } else {
        const [communication, git, ast] = await Promise.all([
          extractCommunicationIntent({
            root,
            projectDir: await scopedPath(input.projectDir, 'project', root, config),
            ticket: nullableString(input.ticket, null),
          }, config),
          extractGitIntent({ root, count: numberValue(input.gitCount, config.gitCommitCount, 1, 100) }, config),
          booleanValue(input.includeAst, true) ? extractAstIntent({ root }, config) : Promise.resolve({ records: [], warnings: [] }),
        ]);
        warnings.push(...communication.warnings, ...git.warnings, ...ast.warnings);
        graph = linkIntentRecords([...communication.records, ...git.records, ...ast.records]);
      }
      const analysis = analyzeCommunication(graph);
      return {
        analysis,
        markdown: renderCommunicationMarkdown(analysis),
        warnings: [...new Set(warnings)].sort(),
        ...(booleanValue(input.includeGraph, false) ? { graph } : {}),
      };
    }
    case 'link': {
      const records = await readRecords(input, root, config);
      return linkIntentRecords(records);
    }
    case 'diagnose': {
      const graph = objectValue<IntentGraph>(input.graph, 'graph');
      return diagnoseGraph(graph);
    }
    case 'summarize': {
      const graph = objectValue<IntentGraph>(input.graph, 'graph');
      const diagnostics = input.diagnostics
        ? objectValue<DiagnosticReport>(input.diagnostics, 'diagnostics')
        : diagnoseGraph(graph);
      return summarizeGraph(graph, diagnostics, config, {
        allowDeterministicFallback: booleanValue(input.fallback, false),
      });
    }
    case 'propose_todo': {
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
    case 'render_todo': {
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
    case 'apply_todo': {
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
    case 'diff': {
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
    case 'diff_files': {
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
    case 'diff_git': {
      const result = await collectGitDiff({
        root,
        revision: stringValue(input.revision, 'HEAD'),
        staged: booleanValue(input.staged, false),
        context: numberValue(input.context, 3, 0, 100),
        maxFiles: numberValue(input.maxFiles, 50, 1, 500),
      });
      return { ...withTextDiffViews(result.diffs, input), revision: result.revision, staged: result.staged, warnings: result.warnings };
    }
    case 'reality': {
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
    case 'compare_workspace':
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
        outputDir: stringValue(input.output, config.outputDir),
        gitCommitCount: numberValue(input.gitCount, config.gitCommitCount, 1, 100),
      }, config);
    case 'pipeline': {
      const options: PipelineOptions = {
        root,
        taskFile: await nullableScopedPath(input.task, null, root, config),
        todoFile: await nullableScopedPath(input.todo, 'TODO.md', root, config),
        changelogFile: await nullableScopedPath(input.changelog, 'CHANGELOG.md', root, config),
        documentPatterns: stringList(input.docs, config.documentPatterns),
        includeDocumentationLlm: booleanValue(input.includeDocsLlm, true),
        outputDir: await scopedPath(input.output, config.outputDir, root, config),
        gitCommitCount: numberValue(input.gitCount, config.gitCommitCount, 1, 100),
        allowSummaryFallback: booleanValue(input.summaryFallback, true),
        includeSummaryLlm: booleanValue(input.includeSummaryLlm, true),
        nlMode: nlModeValue(input.nlMode, config.nlMode),
        markdownMode: llmModeValue(input.markdownMode, config.markdownMode, 'markdownMode'),
        documentExcludes: stringList(input.docExcludes, config.documentExcludes),
        taskSynthesisMode: pipelineTaskMode(input.taskMode),
        includeCommunication: booleanValue(input.includeCommunication, true),
        projectDirectory: stringValue(input.projectDir, 'project'),
        communicationTicket: nullableString(input.communicationTicket, null),
      };
      return runPipeline(options, config);
    }
  }
}

function filterCommunicationGraph(graph: IntentGraph, input: Record<string, unknown>): IntentGraph {
  const participant = stringValue(input.participant, '').toLowerCase();
  const role = stringValue(input.role, '').toLowerCase();
  const ticket = stringValue(input.ticket, '').toLowerCase();
  const communicationOnly = booleanValue(input.communicationOnly, false);
  if (!participant && !role && !ticket && !communicationOnly) return graph;
  const records = graph.records.filter((record) => {
    const isCommunication = record.source.kind === 'agent_log';
    if (communicationOnly && !isCommunication) return false;
    if (participant && (!isCommunication || String(record.metadata.participant ?? '').toLowerCase() !== participant)) return false;
    if (role && (!isCommunication || String(record.metadata.participantRole ?? '').toLowerCase() !== role)) return false;
    if (ticket && !record.statement.target.tickets.some((value) => value.toLowerCase() === ticket)) return false;
    return true;
  });
  return linkIntentRecords(records, graph.generatedAt);
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
  if (value === undefined || value === 'prefer-llm') return 'prefer-llm';
  if (value === 'require-llm') return 'require-llm';
  throw new Error('mode must be prefer-llm or require-llm');
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
