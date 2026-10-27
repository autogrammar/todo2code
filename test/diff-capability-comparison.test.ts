import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord } from '../src/core/record.js';
import type { IntentAction, IntentRecord } from '../src/core/types.js';
import {
  compareCapabilityEvidenceBundles,
  type RepositoryCapabilityBundle,
} from '../src/diff/capability-comparison.js';
import { linkIntentRecords } from '../src/graph/linker.js';

const GENERATED_AT = '2026-10-27T21:00:00.000Z';

function declaredRecord(
  capability: string,
  opts: {
    inputs?: string[];
    outputs?: string[];
    effects?: string[];
    forbidden?: string[];
    behavior?: string[];
    intentionalDivergence?: boolean;
  } = {},
): IntentRecord {
  const [, object = capability] = capability.split('.');
  return buildRecord({
    kind: 'declared_intent',
    action: 'validate',
    object,
    text: `Declare ${capability}`,
    target: { paths: ['src/auth.ts'], symbols: ['verifyPermission'], tickets: [], versions: [] },
    lifecycle: 'proposed',
    sourceKind: 'nl',
    sourcePath: 'TASK.md',
    sourceLines: { start: 1, end: 1 },
    extractor: 'test',
    epistemicClass: 'declaration',
    confidence: 1,
    basis: ['test'],
    metadata: {
      capabilities: [capability],
      inputs: opts.inputs ?? ['user', 'token'],
      outputs: opts.outputs ?? ['bool'],
      effects: opts.effects ?? ['read'],
      forbidden: opts.forbidden ?? ['network'],
      ...(opts.behavior ? { behavior: opts.behavior } : {}),
      ...(opts.intentionalDivergence ? { intentionalDivergence: true } : {}),
    },
  });
}

function codeFactRecord(
  capability: string,
  opts: {
    inputs?: string[];
    outputs?: string[];
    effects?: string[];
    forbidden?: string[];
    behavior?: string[];
  } = {},
): IntentRecord {
  const [, object = capability] = capability.split('.');
  return buildRecord({
    kind: 'implemented_fact',
    action: 'validate',
    object,
    text: `Implement ${capability}`,
    target: { paths: ['src/auth.ts'], symbols: ['verifyPermission'], tickets: [], versions: [] },
    lifecycle: 'implemented',
    sourceKind: 'ast',
    sourcePath: 'src/auth.ts',
    sourceLines: { start: 10, end: 25 },
    extractor: 'test',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['test'],
    metadata: {
      capabilities: [capability],
      inputs: opts.inputs ?? ['user', 'token'],
      outputs: opts.outputs ?? ['bool'],
      effects: opts.effects ?? ['read'],
      forbidden: opts.forbidden ?? ['network'],
      ...(opts.behavior ? { behavior: opts.behavior } : {}),
    },
  });
}

function configFactRecord(capability: string): IntentRecord {
  const [, object = capability] = capability.split('.');
  return buildRecord({
    kind: 'configuration_file_fact',
    action: 'configure',
    object,
    text: `Configure ${capability}`,
    target: { paths: ['config/policy.json'], symbols: [], tickets: [], versions: [] },
    lifecycle: 'implemented',
    sourceKind: 'system',
    sourcePath: 'config/policy.json',
    sourceLines: { start: 1, end: 5 },
    extractor: 'test',
    epistemicClass: 'fact',
    confidence: 1,
    basis: ['test'],
    metadata: {
      aggregate: 'configuration-file',
      capabilities: [capability],
      inputs: ['config'],
      outputs: ['policy'],
      effects: ['none'],
    },
  });
}

function makeBundle(
  repository: string,
  records: IntentRecord[],
  overrides: Partial<RepositoryCapabilityBundle> = {},
): RepositoryCapabilityBundle {
  const marker = repository.includes('alpha') ? 'a' : 'b';
  return {
    repository,
    revision: marker.repeat(40),
    sourceHash: marker.repeat(64),
    extractionComplete: true,
    runtimeVerified: true,
    platform: 'linux-node',
    graph: linkIntentRecords(records, GENERATED_AT),
    ...overrides,
  };
}

test('compares capability pairs across distinct repositories with explicit provenance and states', () => {
  const left = makeBundle(
    'owner/alpha',
    [
      declaredRecord('validate.permission'),
      codeFactRecord('validate.permission'),
      configFactRecord('configure.policy'),
    ],
    {
      intractScanRows: [
        {
          file: 'src/auth.ts',
          line: 10,
          end_line: 25,
          scope: 'function',
          intent: 'validate.permission',
          inputs: ['token', 'user'],
          outputs: ['bool'],
          effects: ['read'],
          forbidden: ['network'],
          symbol_id: 'fn.src.auth.ts.verify.permission',
          contract_hash: '1'.repeat(64),
          source_hash: '2'.repeat(64),
          basis: 'declared',
          source_binding: { status: 'verified', verified: true },
        },
      ],
    },
  );
  const right = makeBundle(
    'owner/beta',
    [
      declaredRecord('validate.permission'),
      codeFactRecord('validate.permission'),
      declaredRecord('configure.policy', { inputs: ['config'], outputs: ['policy'], effects: ['none'] }),
    ],
  );

  const report = compareCapabilityEvidenceBundles([left, right], GENERATED_AT);

  assert.equal(report.schemaVersion, 't2c.capability-comparison/v1');
  assert.equal(report.realitySchemaVersion, 't2c.reality/v1');
  assert.equal(report.truthMapSchemaVersion, 't2c.truth-map/v1');
  assert.equal(report.pairs.length, 2);

  const permPair = report.pairs.find((p) => p.capability === 'validate.permission');
  assert.ok(permPair);
  assert.equal(permPair.compatibility, 'compatible_verified');
  assert.equal(permPair.interchangeable, true);
  assert.equal(permPair.leftState, 'observed');
  assert.equal(permPair.rightState, 'observed');
  assert.equal(permPair.leftGrade, 'runtime_verified_code');
  assert.equal(permPair.rightGrade, 'runtime_verified_code');
  assert.deepEqual(permPair.leftProvenance.citations.intractSymbolIds, ['fn.src.auth.ts.verify.permission']);
  assert.ok(permPair.leftProvenance.citations.recordIds.length >= 2);
  assert.ok(permPair.leftProvenance.citations.assertionIds.length >= 1);

  const configPair = report.pairs.find((p) => p.capability === 'configure.policy');
  assert.ok(configPair);
  assert.equal(configPair.leftState, 'configuration-only');
  assert.equal(configPair.rightState, 'declared');
  assert.equal(configPair.compatibility, 'configuration_only');
  assert.equal(configPair.interchangeable, false);

  assert.equal(report.reviewProposal.mutatesSource, false);
  assert.equal(report.reviewProposal.createsTickets, false);
  assert.equal(report.reviewProposal.claimsEquivalenceFromSimilarityAlone, false);
  assert.equal(report.reviewProposal.proposalHash.length, 64);
});

test('negative fixtures: behavior mismatch, effects/platform mismatch, missing extraction, stale hash, intentional divergence, and unverified runtime', () => {
  // 1. Same word ("validate.permission") but different behavior / I/O contract
  const behaviorLeft = makeBundle('owner/alpha', [
    codeFactRecord('validate.permission', { inputs: ['user', 'token'], outputs: ['bool'], behavior: ['rbac_strict'] }),
  ]);
  const behaviorRight = makeBundle('owner/beta', [
    codeFactRecord('validate.permission', { inputs: ['session_cookie'], outputs: ['claims_map'], behavior: ['cookie_lenient'] }),
  ]);
  const behaviorReport = compareCapabilityEvidenceBundles([behaviorLeft, behaviorRight], GENERATED_AT);
  assert.equal(behaviorReport.pairs[0]?.compatibility, 'behavior_mismatch');
  assert.equal(behaviorReport.pairs[0]?.interchangeable, false);
  assert.equal(behaviorReport.gapCandidates[0]?.kind, 'BEHAVIOR_CONTRACT_MISMATCH');

  // 2. Different effects / platforms (left forbids network; right uses network effect and different platform)
  const effectLeft = makeBundle(
    'owner/alpha',
    [codeFactRecord('sync.state', { effects: ['read'], forbidden: ['network'] })],
    { platform: 'linux-python' },
  );
  const effectRight = makeBundle(
    'owner/beta',
    [codeFactRecord('sync.state', { effects: ['network'], forbidden: [] })],
    { platform: 'browser-wasm' },
  );
  const effectReport = compareCapabilityEvidenceBundles([effectLeft, effectRight], GENERATED_AT);
  assert.equal(effectReport.pairs[0]?.compatibility, 'effect_or_platform_mismatch');
  assert.equal(effectReport.pairs[0]?.interchangeable, false);
  assert.equal(effectReport.gapCandidates[0]?.kind, 'EFFECT_OR_PLATFORM_INCOMPATIBLE');

  // 3. Missing extraction
  const missingLeft = makeBundle('owner/alpha', [codeFactRecord('index.intents')]);
  const missingRight = makeBundle('owner/beta', [], { extractionComplete: false });
  const missingReport = compareCapabilityEvidenceBundles([missingLeft, missingRight], GENERATED_AT);
  assert.equal(missingReport.pairs[0]?.rightState, 'unknown');
  assert.equal(missingReport.pairs[0]?.rightGrade, 'missing_extraction');
  assert.equal(missingReport.pairs[0]?.compatibility, 'missing_extraction');
  assert.equal(missingReport.gapCandidates[0]?.kind, 'EXTRACTION_INCOMPLETE');

  // 4. Stale hash
  const staleLeft = makeBundle('owner/alpha', [codeFactRecord('index.intents')]);
  const staleRight = makeBundle('owner/beta', [codeFactRecord('index.intents')], {
    sourceHash: 'b'.repeat(64),
    expectedSourceHash: 'f'.repeat(64),
  });
  const staleReport = compareCapabilityEvidenceBundles([staleLeft, staleRight], GENERATED_AT);
  assert.equal(staleReport.pairs[0]?.rightGrade, 'stale');
  assert.equal(staleReport.pairs[0]?.compatibility, 'stale_evidence');
  assert.equal(staleReport.gapCandidates[0]?.kind, 'STALE_EVIDENCE_HASH');

  // 5. Intentionally divergent requirement (preserved without remediation gap)
  const divLeft = makeBundle('owner/alpha', [codeFactRecord('audit.retention')]);
  const divRight = makeBundle(
    'owner/beta',
    [codeFactRecord('audit.retention', { outputs: ['ephemeral_summary'] })],
    { intentionalDivergences: ['audit.retention'] },
  );
  const divReport = compareCapabilityEvidenceBundles([divLeft, divRight], GENERATED_AT);
  assert.equal(divReport.pairs[0]?.compatibility, 'intentional_divergence');
  assert.equal(divReport.pairs[0]?.preservedIntentionalDivergence, true);
  assert.equal(divReport.pairs[0]?.interchangeable, false);
  assert.equal(divReport.gapCandidates.length, 0);

  // 6. Code present without runtime verification
  const unverifiedLeft = makeBundle('owner/alpha', [codeFactRecord('validate.permission')], {
    runtimeVerified: true,
  });
  const unverifiedRight = makeBundle('owner/beta', [codeFactRecord('validate.permission')], {
    runtimeVerified: false,
  });
  const unverifiedReport = compareCapabilityEvidenceBundles([unverifiedLeft, unverifiedRight], GENERATED_AT);
  assert.equal(unverifiedReport.pairs[0]?.rightState, 'observed');
  assert.equal(unverifiedReport.pairs[0]?.rightGrade, 'code');
  assert.equal(unverifiedReport.pairs[0]?.compatibility, 'code_without_runtime_verification');
  assert.equal(unverifiedReport.pairs[0]?.interchangeable, false);
  assert.equal(unverifiedReport.gapCandidates[0]?.kind, 'RUNTIME_VERIFICATION_MISSING');
});
