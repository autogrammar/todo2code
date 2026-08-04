import path from 'node:path';

import { writeJson, writeText } from '../core/io.js';
import { renderCommunicationMarkdown } from '../communication/analyzer.js';
import type { PipelineExecutionOutput } from './run-types.js';

type OptionalArtifactPaths = {
  taskSynthesisPath: string | null;
  todoValidationPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
  communicationAnalysisPath: string | null;
  communicationMarkdownPath: string | null;
};

type PersistOptionalArtifactsResult = {
  files: Record<string, string>;
  taskSynthesisPath: string | null;
  todoPatchPath: string | null;
  todoPatchAuditPath: string | null;
  communicationAnalysisPath: string | null;
};

function relativeArtifactPath(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function buildOptionalArtifactPaths(
  runDirectory: string,
  taskSynthesis: PipelineExecutionOutput['taskSynthesis'],
  todoPatch: PipelineExecutionOutput['todoPatch'],
  communicationAnalysis: PipelineExecutionOutput['communicationAnalysis'],
): OptionalArtifactPaths {
  return {
    taskSynthesisPath: taskSynthesis ? path.join(runDirectory, 'task-synthesis.json') : null,
    todoValidationPath: taskSynthesis ? path.join(runDirectory, 'todo-validation.json') : null,
    todoPatchPath: todoPatch ? path.join(runDirectory, 'TODO.patch') : null,
    todoPatchAuditPath: todoPatch ? path.join(runDirectory, 'TODO.patch.json') : null,
    communicationAnalysisPath: communicationAnalysis ? path.join(runDirectory, 'communication-analysis.json') : null,
    communicationMarkdownPath: communicationAnalysis ? path.join(runDirectory, 'communication-analysis.md') : null,
  };
}

async function persistCommunicationArtifacts(
  root: string,
  files: Record<string, string>,
  communicationAnalysisPath: string | null,
  communicationMarkdownPath: string | null,
  communicationAnalysis: PipelineExecutionOutput['communicationAnalysis'],
): Promise<void> {
  if (!communicationAnalysisPath || !communicationMarkdownPath || !communicationAnalysis) {
    return;
  }

  await Promise.all([
    writeJson(communicationAnalysisPath, communicationAnalysis),
    writeText(communicationMarkdownPath, renderCommunicationMarkdown(communicationAnalysis)),
  ]);

  files.communicationAnalysis = relativeArtifactPath(root, communicationAnalysisPath);
  files.communicationAnalysisMarkdown = relativeArtifactPath(root, communicationMarkdownPath);
}

async function persistTaskSynthesisArtifacts(
  root: string,
  files: Record<string, string>,
  taskSynthesisPath: string | null,
  todoValidationPath: string | null,
  todoPatchPath: string | null,
  todoPatchAuditPath: string | null,
  taskSynthesis: PipelineExecutionOutput['taskSynthesis'],
  todoPatch: PipelineExecutionOutput['todoPatch'],
): Promise<void> {
  if (!taskSynthesisPath || !todoValidationPath || !todoPatchPath || !todoPatchAuditPath || !taskSynthesis || !todoPatch) {
    return;
  }

  await Promise.all([
    writeJson(taskSynthesisPath, taskSynthesis),
    writeJson(todoValidationPath, taskSynthesis.validation),
    writeText(todoPatchPath, todoPatch.markdown),
    writeJson(todoPatchAuditPath, todoPatch.artifact),
  ]);

  files.taskSynthesis = relativeArtifactPath(root, taskSynthesisPath);
  files.todoValidation = relativeArtifactPath(root, todoValidationPath);
  files.todoPatch = relativeArtifactPath(root, todoPatchPath);
  files.todoPatchAudit = relativeArtifactPath(root, todoPatchAuditPath);
}

export async function persistOptionalArtifacts(
  runDirectory: string,
  root: string,
  taskSynthesis: PipelineExecutionOutput['taskSynthesis'],
  todoPatch: PipelineExecutionOutput['todoPatch'],
  communicationAnalysis: PipelineExecutionOutput['communicationAnalysis'],
): Promise<PersistOptionalArtifactsResult> {
  const files: Record<string, string> = {};
  const paths = buildOptionalArtifactPaths(runDirectory, taskSynthesis, todoPatch, communicationAnalysis);

  await Promise.all([
    persistTaskSynthesisArtifacts(
      root,
      files,
      paths.taskSynthesisPath,
      paths.todoValidationPath,
      paths.todoPatchPath,
      paths.todoPatchAuditPath,
      taskSynthesis,
      todoPatch,
    ),
    persistCommunicationArtifacts(
      root,
      files,
      paths.communicationAnalysisPath,
      paths.communicationMarkdownPath,
      communicationAnalysis,
    ),
  ]);

  return {
    files,
    taskSynthesisPath: paths.taskSynthesisPath,
    todoPatchPath: paths.todoPatchPath,
    todoPatchAuditPath: paths.todoPatchAuditPath,
    communicationAnalysisPath: paths.communicationAnalysisPath,
  };
}
