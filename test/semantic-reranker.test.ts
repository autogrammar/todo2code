import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path, { resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { buildRecord } from '../src/core/record.js';
import { linkIntentRecords } from '../src/graph/linker.js';
import {
  applyAcceptedSemanticRelations,
  assertSemanticRerankResult,
  createSemanticCandidateSet,
  createSemanticRerankResult,
} from '../src/semantic/reranker.js';
import {
  rerankSemanticCandidates,
  SemanticRerankerRequiredError,
  semanticRerankCacheKey,
} from '../src/semantic/reranker-llm.js';
import {
  assertSemanticRerankerResponse,
  SEMANTIC_RERANK_RESPONSE_SCHEMA,
} from '../src/semantic/reranker-response.js';
import { makeConfig } from './helpers.js';

const FIXED_TIME = '2026-07-31T09:00:00.000Z';
const exec = promisify(execFile);

function fixtureGraph() {
  const declaration = buildRecord({
    kind: 'documentation_statement',
    action: 'validate',
    object: 'Abgelaufene Authentifizierungs-Token ablehnen',
    target: {},
    text: 'Abgelaufene Authentifizierungs-Token müssen vor dem Zugriff abgelehnt werden',
    modality: 'required',
    lifecycle: 'proposed',
    sourceKind: 'document',
    sourcePath: 'docs/security.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 0.9,
    basis: ['fixture'],
  });
  const correct = buildRecord({
    kind: 'module_fact',
    action: 'declare',
    object: 'src/security/auth-token-expiry-validator.ts',
    target: { paths: ['src/security/auth-token-expiry-validator.ts'] },
    text: 'declare src/security/auth-token-expiry-validator.ts',
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: 'src/security/auth-token-expiry-validator.ts',
    sourceLines: { start: 1, end: 20 },
    extractor: 'test',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['fixture'],
    metadata: { aggregate: 'module' },
  });
  const wrong = buildRecord({
    kind: 'module_fact',
    action: 'declare',
    object: 'src/security/user-role-permission-registry.ts',
    target: { paths: ['src/security/user-role-permission-registry.ts'] },
    text: 'declare src/security/user-role-permission-registry.ts',
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: 'src/security/user-role-permission-registry.ts',
    sourceLines: { start: 1, end: 20 },
    extractor: 'test',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['fixture'],
    metadata: { aggregate: 'module' },
  });
  return {
    declaration,
    correct,
    wrong,
    graph: linkIntentRecords([declaration, correct, wrong], FIXED_TIME),
  };
}

test('bounded retrieval cannot create a relation until a grounded reranker accepts it', () => {
  const { declaration, correct, wrong, graph } = fixtureGraph();
  assert.equal(graph.relations.length, 0);
  const candidates = createSemanticCandidateSet(graph, [
    { declarationRecordId: declaration.id, moduleRecordId: wrong.id, score: 0.79 },
    { declarationRecordId: declaration.id, moduleRecordId: correct.id, score: 0.83 },
  ], {
    provider: 'sentence-transformers',
    model: 'intfloat/multilingual-e5-base',
    revision: '18fcae5',
    metric: 'cosine',
  }, 2, FIXED_TIME);
  assert.deepEqual(candidates.candidates.map((candidate) => candidate.moduleRecordId), [correct.id, wrong.id]);
  assert.deepEqual(candidates.candidates.map((candidate) => candidate.rank), [1, 2]);
  assert.equal(graph.relations.length, 0, 'candidate generation must not mutate the graph');

  const [correctCandidate, wrongCandidate] = candidates.candidates;
  assert.ok(correctCandidate);
  assert.ok(wrongCandidate);
  const rerank = createSemanticRerankResult(graph, candidates, [
    {
      candidateId: correctCandidate.id,
      verdict: 'accept',
      confidence: 0.91,
      reasonCode: 'repository_evidence_supports_match',
      rationale: 'The requirement and the module both concern expiry validation.',
      citedRecordIds: [declaration.id, correct.id],
      evidence: [
        { recordId: declaration.id, quote: 'Authentifizierungs-Token' },
        { recordId: correct.id, quote: 'auth-token-expiry-validator.ts' },
      ],
    },
    {
      candidateId: wrongCandidate.id,
      verdict: 'reject',
      confidence: 0.96,
      reasonCode: 'wrong_target',
      rationale: 'The module concerns role permissions, not token expiry.',
      citedRecordIds: [declaration.id, wrong.id],
      evidence: [
        { recordId: declaration.id, quote: 'abgelehnt werden' },
        { recordId: wrong.id, quote: 'user-role-permission-registry.ts' },
      ],
    },
  ], {
    provider: 'openrouter',
    model: 'test/reranker',
    modelRevision: '2026-07-31',
    responseId: 'response-1',
  }, FIXED_TIME);

  const augmented = applyAcceptedSemanticRelations(graph, candidates, rerank, FIXED_TIME);
  assert.equal(augmented.relations.length, 1);
  assert.equal(augmented.relations[0]?.from, declaration.id);
  assert.equal(augmented.relations[0]?.to, correct.id);
  assert.ok(augmented.relations[0]?.basis.includes('cross_language_reranker'));
  assert.ok(!augmented.relations.some((relation) => relation.to === wrong.id));
});

test('reranker fails closed on ungrounded quotes and more than one accepted module', () => {
  const { declaration, correct, wrong, graph } = fixtureGraph();
  const candidates = createSemanticCandidateSet(graph, [
    { declarationRecordId: declaration.id, moduleRecordId: correct.id, score: 0.82 },
    { declarationRecordId: declaration.id, moduleRecordId: wrong.id, score: 0.81 },
  ], {
    provider: 'fixture',
    model: 'retrieval',
    revision: '1',
    metric: 'cosine',
  }, 2, FIXED_TIME);
  const decisions = candidates.candidates.map((candidate) => ({
    candidateId: candidate.id,
    verdict: 'accept' as const,
    confidence: 0.8,
    reasonCode: 'repository_evidence_supports_match' as const,
    rationale: 'Captured fixture response.',
    citedRecordIds: [declaration.id, candidate.moduleRecordId],
    evidence: [
      { recordId: declaration.id, quote: 'Authentifizierungs-Token' },
      {
        recordId: candidate.moduleRecordId,
        quote: candidate.moduleRecordId === correct.id
          ? 'auth-token-expiry-validator.ts'
          : 'user-role-permission-registry.ts',
      },
    ],
  }));
  assert.throws(() => createSemanticRerankResult(graph, candidates, decisions, {
    provider: 'fixture',
    model: 'reranker',
    modelRevision: '1',
  }, FIXED_TIME), /more than one module/);

  const [first, second] = decisions;
  assert.ok(first);
  assert.ok(second);
  const valid = createSemanticRerankResult(graph, candidates, [
    first,
    { ...second, verdict: 'abstain', reasonCode: 'ambiguous' },
  ], {
    provider: 'fixture',
    model: 'reranker',
    modelRevision: '1',
  }, FIXED_TIME);
  const tampered = structuredClone(valid);
  tampered.decisions[0]!.evidence[0]!.quote = 'invented repository evidence';
  assert.throws(
    () => assertSemanticRerankResult(tampered, candidates, graph),
    /quote is not grounded/,
  );
});

test('OpenRouter reranking is required, structured and reusable only through an identity-bound cache', async () => {
  const { declaration, correct, graph } = fixtureGraph();
  const candidates = createSemanticCandidateSet(graph, [
    { declarationRecordId: declaration.id, moduleRecordId: correct.id, score: 0.84 },
  ], {
    provider: 'fixture',
    model: 'retrieval',
    revision: '1',
    metric: 'cosine',
  }, 1, FIXED_TIME);
  const config = makeConfig(process.cwd());
  await assert.rejects(
    () => rerankSemanticCandidates(graph, candidates, config, { modelRevision: 'rev-1' }),
    SemanticRerankerRequiredError,
  );

  config.openRouter.apiKey = 'test-secret';
  config.openRouter.taskModel = 'test/reranker';
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-reranker-tracked-'));
  await Promise.all([
    fs.mkdir(path.join(repository, 'docs'), { recursive: true }),
    fs.mkdir(path.join(repository, 'src', 'security'), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(repository, 'docs', 'security.md'), declaration.statement.text),
    fs.writeFile(path.join(repository, 'src', 'security', 'auth-token-expiry-validator.ts'), correct.statement.text),
    fs.writeFile(path.join(repository, 'src', 'security', 'user-role-permission-registry.ts'), 'fixture'),
  ]);
  await exec('git', ['init', '-q'], { cwd: repository });
  await exec('git', ['config', 'user.name', 'Fixture'], { cwd: repository });
  await exec('git', ['config', 'user.email', 'fixture@example.test'], { cwd: repository });
  await exec('git', ['add', '.'], { cwd: repository });
  await exec('git', ['commit', '-q', '-m', 'fixture'], { cwd: repository });
  const candidate = candidates.candidates[0]!;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>;
      response_format: { json_schema: { name: string } };
    };
    assert.equal(body.response_format.json_schema.name, 't2c_cross_language_rerank_v1');
    assert.match(body.messages[0]?.content ?? '', /exactly one top-level property named decisions/);
    assert.match(body.messages[0]?.content ?? '', /Retrieval score is only a shortlist signal/);
    assert.match(body.messages[1]?.content ?? '', new RegExp(candidate.id));
    return new Response(JSON.stringify({
      id: 'rerank-response-1',
      model: 'test/reranker-resolved',
      provider: 'FixtureProvider',
      choices: [{
        message: {
          content: JSON.stringify({
            decisions: [{
              candidateId: candidate.id,
              verdict: 'accept',
              confidence: 0.9,
              reasonCode: 'repository_evidence_supports_match',
              rationale: 'The records describe token expiry validation.',
              citedRecordIds: [declaration.id, correct.id],
              evidence: [
                { recordId: declaration.id, quote: 'Authentifizierungs-Token' },
                { recordId: correct.id, quote: 'auth-token-expiry-validator.ts' },
              ],
            }],
          }),
        },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await rerankSemanticCandidates(graph, candidates, config, {
      modelRevision: 'rev-1',
      trackedSnapshot: { root: repository, revision: 'HEAD' },
    });
    assert.equal(calls, 1);
    assert.equal(result.decisions[0]?.verdict, 'accept');
    assert.equal(result.generation.provider, 'FixtureProvider');
    assert.equal(result.generation.requestedModel, 'test/reranker');
    assert.equal(result.generation.model, 'test/reranker-resolved');
    assert.equal(result.generation.modelRevision, 'rev-1');
    assert.equal(semanticRerankCacheKey(candidates, 'test/reranker', 'rev-1').length, 64);

    const cached = await rerankSemanticCandidates(graph, candidates, config, {
      model: 'test/reranker',
      modelRevision: 'rev-1',
      cachedResult: result,
    });
    assert.equal(cached.resultHash, result.resultHash);
    assert.equal(calls, 1);
    await assert.rejects(
      () => rerankSemanticCandidates(graph, candidates, config, {
        model: 'different/model',
        modelRevision: 'rev-1',
        cachedResult: result,
      }),
      /different model identity/,
    );

    globalThis.fetch = async () => new Response(JSON.stringify({
      id: 'rerank-invalid-1',
      model: 'test/reranker-invalid',
      provider: 'FixtureProvider',
      choices: [{ message: { content: JSON.stringify({ judgments: [] }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    await assert.rejects(
      () => rerankSemanticCandidates(graph, candidates, config, {
        modelRevision: 'rev-1',
        trackedSnapshot: { root: repository, revision: 'HEAD' },
      }),
      /FixtureProvider\/test\/reranker-invalid\/rerank-invalid-1: response contains unknown properties: judgments/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('published semantic reranker schemas expose the versioned bounded contracts', async () => {
  const [candidateText, rerankText] = await Promise.all([
    fs.readFile(resolve('schemas/semantic-candidate-set.schema.json'), 'utf8'),
    fs.readFile(resolve('schemas/semantic-rerank.schema.json'), 'utf8'),
  ]);
  const candidate = JSON.parse(candidateText) as {
    properties: {
      schemaVersion: { const: string };
      maxCandidatesPerDeclaration: { maximum: number };
    };
  };
  const rerank = JSON.parse(rerankText) as {
    properties: {
      schemaVersion: { const: string };
      decisions: {
        items: {
          required: string[];
          properties: {
            id: unknown;
            candidateId: { pattern: string };
            verdict: { enum: string[] };
            confidence: { type: string; minimum: number; maximum: number };
            reasonCode: { enum: string[] };
            rationale: unknown;
            citedRecordIds: {
              minItems: number;
              maxItems: number;
              uniqueItems: boolean;
              items: { pattern: string };
            };
            evidence: {
              minItems: number;
              items: {
                required: string[];
                properties: { recordId: { pattern: string }; quote: unknown };
              };
            };
          };
        };
      };
    };
  };
  assert.equal(candidate.properties.schemaVersion.const, 't2c.semantic-candidate-set/v1');
  assert.equal(candidate.properties.maxCandidatesPerDeclaration.maximum, 10);
  assert.equal(rerank.properties.schemaVersion.const, 't2c.semantic-rerank/v1');
  assert.deepEqual(rerank.properties.decisions.items.properties.verdict.enum, ['accept', 'reject', 'abstain']);

  const provider = SEMANTIC_RERANK_RESPONSE_SCHEMA as {
    properties: {
      decisions: {
        items: {
          required: string[];
          properties: {
            candidateId: { pattern: string };
            verdict: { enum: string[] };
            confidence: { type: string; minimum: number; maximum: number };
            reasonCode: { enum: string[] };
            citedRecordIds: {
              minItems: number;
              maxItems: number;
              uniqueItems: boolean;
              items: { pattern: string };
            };
            evidence: {
              minItems: number;
              items: {
                required: string[];
                properties: { recordId: { pattern: string }; quote: unknown };
              };
            };
          };
        };
      };
    };
  };
  const publishedDecision = rerank.properties.decisions.items;
  const providerDecision = provider.properties.decisions.items;
  assert.deepEqual(
    publishedDecision.required.filter((key) => key !== 'id').sort(),
    [...providerDecision.required].sort(),
  );
  assert.equal(publishedDecision.properties.candidateId.pattern, providerDecision.properties.candidateId.pattern);
  assert.deepEqual(publishedDecision.properties.verdict, providerDecision.properties.verdict);
  assert.deepEqual(publishedDecision.properties.confidence, providerDecision.properties.confidence);
  assert.deepEqual(publishedDecision.properties.reasonCode, providerDecision.properties.reasonCode);
  assert.deepEqual(publishedDecision.properties.citedRecordIds, providerDecision.properties.citedRecordIds);
  assert.deepEqual(publishedDecision.properties.evidence, providerDecision.properties.evidence);
});

test('provider response validation diagnoses the exact property without coercion', () => {
  assert.throws(
    () => assertSemanticRerankerResponse({ judgments: [] }),
    /response contains unknown properties: judgments/,
  );
  assert.throws(
    () => assertSemanticRerankerResponse({ decisions: [{
      candidateId: 'SCAND-0123456789abcdef0123',
      verdict: 'accept',
      confidence: '90%',
      reasonCode: 'repository_evidence_supports_match',
      rationale: 'Grounded.',
      citedRecordIds: [
        'INT-DOC-0123456789abcdef0123',
        'INT-AST-0123456789abcdef0123',
      ],
      evidence: [
        { recordId: 'INT-DOC-0123456789abcdef0123', quote: 'requirement' },
        { recordId: 'INT-AST-0123456789abcdef0123', quote: 'module' },
      ],
    }] }),
    /response\.decisions\[0\]\.confidence must be a finite JSON number between 0 and 1/,
  );
  assert.throws(
    () => assertSemanticRerankerResponse({ decisions: [{
      candidateId: 'SCAND-0123456789abcdef0123',
      verdict: 'accept',
      confidence: 0.9,
      reasonCode: 'wrong_target',
      rationale: 'Contradictory combination.',
      citedRecordIds: [
        'INT-DOC-0123456789abcdef0123',
        'INT-AST-0123456789abcdef0123',
      ],
      evidence: [
        { recordId: 'INT-DOC-0123456789abcdef0123', quote: 'requirement' },
        { recordId: 'INT-AST-0123456789abcdef0123', quote: 'module' },
      ],
    }] }),
    /accept requires repository_evidence_supports_match/,
  );
  const schema = SEMANTIC_RERANK_RESPONSE_SCHEMA as {
    properties: {
      decisions: {
        items: {
          properties: {
            verdict: { enum: string[] };
            reasonCode: { enum: string[] };
          };
        };
      };
    };
  };
  assert.deepEqual(schema.properties.decisions.items.properties.verdict.enum, ['accept', 'reject', 'abstain']);
  assert.deepEqual(schema.properties.decisions.items.properties.reasonCode.enum, [
    'repository_evidence_supports_match',
    'wrong_target',
    'contradicted',
    'insufficient_evidence',
    'ambiguous',
    'multi_module',
  ]);
});
