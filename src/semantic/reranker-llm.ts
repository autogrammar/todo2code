import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { T2CConfig } from '../config/env.js';
import { sha256, stableStringify } from '../core/id.js';
import type { IntentGraph, IntentRecord } from '../core/types.js';
import { OpenRouterClient } from '../llm/openrouter.js';
import { StructuredResponseError } from '../llm/structured-schema.js';
import {
  assertSemanticCandidateSet,
  assertSemanticRerankResult,
  createSemanticRerankResult,
  type SemanticCandidateSet,
  type SemanticRerankResult,
} from './reranker.js';
import {
  assertSemanticRerankerResponse,
  type SemanticRerankerResponse,
  SEMANTIC_RERANK_RESPONSE_CONTRACT,
} from './reranker-response.js';

export interface SemanticRerankerOptions {
  model?: string;
  modelRevision: string;
  cachedResult?: SemanticRerankResult | null;
  trackedSnapshot?: {
    root: string;
    revision: string;
  };
}

export class SemanticRerankerRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticRerankerRequiredError';
  }
}

export async function rerankSemanticCandidates(
  graph: IntentGraph,
  candidateSet: SemanticCandidateSet,
  config: T2CConfig,
  options: SemanticRerankerOptions,
): Promise<SemanticRerankResult> {
  assertSemanticCandidateSet(candidateSet, graph);
  validateCandidateSetSize(candidateSet);
  const model = resolveRerankerModel(config, options.model);
  const modelRevision = resolveModelRevision(options.modelRevision);
  const cached = resolveCachedResult(options.cachedResult, candidateSet, graph, model, modelRevision);
  if (cached) return cached;

  const client = assertRerankerClient(config);
  await assertTrackedSnapshotAvailable(graph, candidateSet, options.trackedSnapshot);
  const payload = buildRerankerPayload(graph, candidateSet);
  const response = await callReranker(client, messagesForCandidates(graph, candidateSet, payload), model);
  return buildRerankResult(graph, candidateSet, response, model, modelRevision);
}

function validateCandidateSetSize(candidateSet: SemanticCandidateSet): void {
  if (!candidateSet.candidates.length) {
    throw new Error('Semantic reranker requires at least one candidate');
  }
  if (candidateSet.candidates.length > 100) {
    throw new Error('Semantic reranker payload is limited to 100 candidates');
  }
}

function resolveRerankerModel(config: T2CConfig, modelOverride?: string): string {
  return modelOverride?.trim() || config.openRouter.taskModel;
}

function resolveModelRevision(modelRevision: string): string {
  const revision = modelRevision?.trim();
  if (!revision) throw new Error('Semantic reranker requires an explicit modelRevision');
  return revision;
}

function resolveCachedResult(
  cachedResult: SemanticRerankResult | null | undefined,
  candidateSet: SemanticCandidateSet,
  graph: IntentGraph,
  model: string,
  modelRevision: string,
): SemanticRerankResult | null {
  if (!cachedResult) return null;
  assertSemanticRerankResult(cachedResult, candidateSet, graph);
  if (cachedResult.generation.requestedModel !== model || cachedResult.generation.modelRevision !== modelRevision) {
    throw new Error('Cached semantic rerank result has a different model identity');
  }
  return cachedResult;
}

function assertRerankerClient(config: T2CConfig): OpenRouterClient {
  const client = new OpenRouterClient(config.openRouter);
  if (!client.isConfigured()) {
    throw new SemanticRerankerRequiredError(
      'Cross-language reranking requires OpenRouter; no deterministic or embedding-only fallback is allowed',
    );
  }
  return client;
}

function assertTrackedSnapshotAvailable(
  graph: IntentGraph,
  candidateSet: SemanticCandidateSet,
  trackedSnapshot: { root: string; revision: string } | undefined,
): Promise<void> {
  if (!trackedSnapshot) throw new Error('Cross-language reranking requires a verified trackedSnapshot');
  return assertTrackedSnapshot(graph, candidateSet, trackedSnapshot);
}

function buildRerankerPayload(graph: IntentGraph, candidateSet: SemanticCandidateSet): Array<{
  candidateId: string;
  retrieval: { score: number; rank: number };
  declaration: Record<string, unknown>;
  module: Record<string, unknown>;
}> {
  const records = new Map(graph.records.map((record) => [record.id, record]));
  return candidateSet.candidates.map((candidate) => ({
    candidateId: candidate.id,
    retrieval: { score: candidate.score, rank: candidate.rank },
    declaration: projectRecord(records.get(candidate.declarationRecordId), candidate.declarationRecordId),
    module: projectRecord(records.get(candidate.moduleRecordId), candidate.moduleRecordId),
  }));
}

function messagesForCandidates(graph: IntentGraph, candidateSet: SemanticCandidateSet, payload: ReturnType<typeof buildRerankerPayload>): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    {
      role: 'system' as const,
      content: [
        'You are a precision-first cross-language repository evidence reranker.',
        'Return one JSON object with exactly one top-level property named decisions; never rename it to judgment or judgments.',
        'Retrieval score is only a shortlist signal and never proves a match.',
        'Decide every candidate with accept, reject, or abstain.',
        'Accept only when the supplied repository records themselves support one unambiguous module.',
        'Use abstain for insufficient evidence, ambiguity, or multi-module requirements.',
        'citedRecordIds must contain exactly the declaration and module record IDs.',
        'Every evidence quote must be copied exactly from the corresponding supplied record.',
        'Do not invent paths, symbols, capabilities, record IDs, or human decisions.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        graphFingerprint: graph.fingerprint,
        candidateSetHash: candidateSet.candidateSetHash,
        candidates: payload,
      }),
    },
  ];
}

async function callReranker(
  client: OpenRouterClient,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  model: string,
): Promise<{
  value: SemanticRerankerResponse;
  metadata: {
    provider?: string | null;
    model?: string | null;
    responseId?: string | null;
  };
}> {
  try {
    return await client.chatStructuredWithMetadata(
      messages,
      't2c_cross_language_rerank_v1',
      SEMANTIC_RERANK_RESPONSE_CONTRACT,
      model,
    );
  } catch (error: unknown) {
    const metadata = error instanceof StructuredResponseError ? error.responseMetadata : undefined;
    const identity = [metadata?.provider, metadata?.model, metadata?.responseId].filter(Boolean).join('/');
    throw new Error(
      `Invalid semantic reranker response${identity ? ` from ${identity}` : ''}: `
      + `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildRerankResult(
  graph: IntentGraph,
  candidateSet: SemanticCandidateSet,
  response: {
    value: SemanticRerankerResponse;
    metadata: {
      provider?: string | null;
      model?: string | null;
      responseId?: string | null;
    };
  },
  model: string,
  modelRevision: string,
): SemanticRerankResult {
  try {
    assertSemanticRerankerResponse(response.value);
  } catch (error) {
    const identity = [
      response.metadata.provider,
      response.metadata.model,
      response.metadata.responseId,
    ].filter(Boolean).join('/');
    throw new Error(
      `Invalid semantic reranker response${identity ? ` from ${identity}` : ''}: `
      + `${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return createSemanticRerankResult(graph, candidateSet, response.value.decisions, {
    provider: response.metadata.provider ?? 'openrouter',
    requestedModel: model,
    model: response.metadata.model ?? model,
    modelRevision,
    responseId: response.metadata.responseId,
  });
}

const execFileAsync = promisify(execFile);

async function assertTrackedSnapshot(
  graph: IntentGraph,
  candidateSet: SemanticCandidateSet,
  snapshot: { root: string; revision: string },
): Promise<void> {
  const root = path.resolve(snapshot.root);
  const revision = snapshot.revision.trim();
  if (!revision) throw new Error('trackedSnapshot.revision must be non-blank');
  const [{ stdout: headOutput }, { stdout: revisionOutput }, { stdout: statusOutput }, { stdout: filesOutput }] =
    await Promise.all([
      execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }),
      execFileAsync('git', ['rev-parse', revision], { cwd: root, encoding: 'utf8' }),
      execFileAsync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }),
      execFileAsync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }),
    ]);
  const head = String(headOutput).trim();
  const resolvedRevision = String(revisionOutput).trim();
  if (!head || head !== resolvedRevision) {
    throw new Error('trackedSnapshot revision must resolve to the clean worktree HEAD');
  }
  if (String(statusOutput).trim()) {
    throw new Error('trackedSnapshot worktree must be clean; uncommitted or untracked content cannot be transmitted');
  }
  const tracked = new Set(
    (filesOutput as Buffer).toString('utf8').split('\0').filter(Boolean).map((item) => item.replace(/\\/g, '/')),
  );
  const records = new Map(graph.records.map((record) => [record.id, record]));
  const recordIds = new Set(candidateSet.candidates.flatMap((candidate) => [
    candidate.declarationRecordId,
    candidate.moduleRecordId,
  ]));
  for (const recordId of recordIds) {
    const record = records.get(recordId);
    const sourcePath = record?.source.path?.replace(/\\/g, '/');
    if (!record || !sourcePath || path.isAbsolute(sourcePath)
      || sourcePath.split('/').includes('..')
      || !tracked.has(sourcePath)) {
      throw new Error(`Semantic reranker record ${recordId} is not owned by the tracked snapshot`);
    }
  }
}

export function semanticRerankCacheKey(
  candidateSet: SemanticCandidateSet,
  model: string,
  modelRevision: string,
): string {
  return sha256(stableStringify({
    schemaVersion: 't2c.semantic-rerank-cache/v1',
    candidateSetHash: candidateSet.candidateSetHash,
    model: model.trim(),
    modelRevision: modelRevision.trim(),
  }));
}

function projectRecord(record: IntentRecord | undefined, expectedId: string): Record<string, unknown> {
  if (!record) throw new Error(`Semantic candidate cites unknown record ${expectedId}`);
  return {
    id: record.id,
    kind: record.statement.kind,
    sourceKind: record.source.kind,
    text: record.statement.text,
    object: record.statement.object,
    action: record.statement.action,
    paths: record.statement.target.paths,
    symbols: record.statement.target.symbols,
    capabilities: Array.isArray(record.metadata.capabilities)
      ? record.metadata.capabilities.filter((item): item is string => typeof item === 'string')
      : [],
  };
}
