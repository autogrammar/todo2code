#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  applyAcceptedSemanticRelations,
  createSemanticCandidateSet,
} from '../../dist/src/semantic/reranker.js';
import { rerankSemanticCandidates } from '../../dist/src/semantic/reranker-llm.js';
import { getConfig, loadEnvFile } from '../../dist/src/config/env.js';

const options = parseArgs(process.argv.slice(2));
await loadEnvFile(process.cwd());

const [graph, ranking] = await Promise.all([
  readJson(options.graph),
  readJson(options.ranking),
]);
if (ranking.schemaVersion !== 't2c.embedding-ranking-experiment/v1') {
  throw new Error(`Unsupported ranking schemaVersion: ${ranking.schemaVersion}`);
}

const records = new Map(graph.records.map((record) => [record.id, record]));
const selectedRows = ranking.rankings.filter((row) => row.selected === true);
if (selectedRows.length === 0) throw new Error('Ranking contains no selected rows');

const candidateInputs = [];
const provenance = [];
for (const row of selectedRows) {
  const declaration = resolveDeclaration(row, graph.records);
  for (const rankedModule of row.top.slice(0, options.top)) {
    const module = resolveModule(rankedModule, graph.records);
    candidateInputs.push({
      declarationRecordId: declaration.id,
      moduleRecordId: module.id,
      score: rankedModule.score,
    });
    provenance.push({
      declarationRecordId: declaration.id,
      moduleRecordId: module.id,
      sourceRankingDeclarationId: row.recordId,
      sourceRankingModuleId: rankedModule.recordId,
      selectedAddsNewCandidate: Boolean(row.addsNewCandidate),
    });
  }
}

const candidateSet = createSemanticCandidateSet(
  graph,
  candidateInputs,
  {
    provider: 'sentence-transformers',
    model: ranking.model,
    revision: ranking.revision,
    metric: 'cosine',
  },
  options.top,
);
const config = getConfig(process.cwd());
const rerank = await rerankSemanticCandidates(graph, candidateSet, config, {
  model: options.model,
  modelRevision: options.modelRevision,
  trackedSnapshot: {
    root: options.root,
    revision: options.revision,
  },
});
const augmentedGraph = applyAcceptedSemanticRelations(graph, candidateSet, rerank);

const originalRelationIds = new Set(graph.relations.map((relation) => relation.id));
const originallyRelatedPairs = new Set(graph.relations.flatMap((relation) => [
  `${relation.from}|${relation.to}`,
  `${relation.to}|${relation.from}`,
]));
const candidateById = new Map(candidateSet.candidates.map((candidate) => [candidate.id, candidate]));
const accepted = rerank.decisions
  .filter((decision) => decision.verdict === 'accept')
  .map((decision) => {
    const candidate = candidateById.get(decision.candidateId);
    const relation = augmentedGraph.relations.find((item) =>
      item.basis.includes(`decision:${decision.id}`));
    if (!candidate || !relation) throw new Error(`Accepted decision ${decision.id} was not materialized`);
    return {
      decisionId: decision.id,
      declarationRecordId: candidate.declarationRecordId,
      declarationPath: records.get(candidate.declarationRecordId)?.source.path ?? null,
      declarationText: records.get(candidate.declarationRecordId)?.statement.text ?? null,
      moduleRecordId: candidate.moduleRecordId,
      modulePath: records.get(candidate.moduleRecordId)?.source.path ?? null,
      relationId: relation.id,
      pairWasAlreadyRelated: originallyRelatedPairs.has(
        `${candidate.declarationRecordId}|${candidate.moduleRecordId}`,
      ),
      confidence: decision.confidence,
      rationale: decision.rationale,
    };
  });
const verdictCounts = Object.fromEntries(
  ['accept', 'reject', 'abstain'].map((verdict) => [
    verdict,
    rerank.decisions.filter((decision) => decision.verdict === verdict).length,
  ]),
);
const output = {
  schemaVersion: 't2c.semantic-rerank-experiment/v1',
  repository: {
    root: path.resolve(options.root),
    revision: options.revision,
    graphFingerprint: graph.fingerprint,
  },
  sourceRanking: {
    path: path.resolve(options.ranking),
    graphFingerprint: ranking.graphFingerprint,
    model: ranking.model,
    revision: ranking.revision,
    selectedRows: selectedRows.length,
    topPerDeclaration: options.top,
  },
  provenance,
  candidateSet,
  rerank,
  summary: {
    candidates: candidateSet.candidates.length,
    verdictCounts,
    accepted,
    acceptedNewPairs: accepted.filter((item) => !item.pairWasAlreadyRelated).length,
    newRelations: augmentedGraph.relations.filter((relation) => !originalRelationIds.has(relation.id)).length,
    augmentedGraphFingerprint: augmentedGraph.fingerprint,
  },
};
await fs.writeFile(options.output, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output.summary)}\n`);

function resolveDeclaration(row, graphRecords) {
  const exact = graphRecords.find((record) => record.id === row.recordId);
  if (exact) return exact;
  const matches = graphRecords.filter((record) =>
    record.source.kind === row.sourceKind
    && record.source.path === row.sourcePath
    && record.statement.text === row.text);
  if (matches.length !== 1) {
    throw new Error(`Cannot map declaration ${row.recordId}: found ${matches.length} current records`);
  }
  return matches[0];
}

function resolveModule(rankedModule, graphRecords) {
  const exact = graphRecords.find((record) => record.id === rankedModule.recordId);
  if (exact?.statement.kind === 'module_fact') return exact;
  const matches = graphRecords.filter((record) =>
    record.statement.kind === 'module_fact'
    && record.source.kind === 'ast'
    && record.source.path === rankedModule.path);
  if (matches.length !== 1) {
    throw new Error(`Cannot map module ${rankedModule.recordId}: found ${matches.length} current records`);
  }
  return matches[0];
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    values.set(key.slice(2), value);
  }
  const required = (name) => {
    const value = values.get(name)?.trim();
    if (!value) throw new Error(`Missing --${name}`);
    return value;
  };
  const top = Number(values.get('top') ?? '3');
  if (!Number.isInteger(top) || top < 1 || top > 10) {
    throw new Error('--top must be an integer between 1 and 10');
  }
  return {
    graph: path.resolve(required('graph')),
    ranking: path.resolve(required('ranking')),
    root: path.resolve(required('root')),
    revision: required('revision'),
    output: path.resolve(required('output')),
    model: values.get('model')?.trim() || undefined,
    modelRevision: required('model-revision'),
    top,
  };
}
