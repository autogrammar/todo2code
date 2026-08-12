import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYSIS_POLICY_CACHE_MODE,
  ANALYSIS_POLICY_LLM_POLICY,
  ANALYSIS_POLICY_SCHEMA,
  analysisPolicyFingerprint,
  assertAnalysisPolicy,
  calculateAnalysisUsageCeiling,
  createAnalysisCacheKey,
  estimateAnalysisCostUsd,
  parseAnalysisPolicy,
  renderAnalysisPolicy,
  selectAnalysisStages,
  type AnalysisPolicy,
  type AnalysisTrigger,
} from '../src/evaluation/analysis-policy.js';

const policy = (): AnalysisPolicy => ({
  schema: ANALYSIS_POLICY_SCHEMA,
  profileId: 'intent-refactor-deep',
  llmPolicy: ANALYSIS_POLICY_LLM_POLICY,
  cacheMode: ANALYSIS_POLICY_CACHE_MODE,
  onProviderUnavailable: 'FAIL',
  onBudgetExhausted: 'REPORT_INCOMPLETE',
  budget: {
    maxRequests: 6, maxInputTokens: 60_000, maxOutputTokens: 12_000, maxDurationMs: 900_000,
  },
  stages: [
    {
      id: 'baseline', purpose: 'intent', activation: 'ALWAYS', triggers: [],
      context: ['changed_files', 'intent_evidence'], minSeverity: 'warning',
      budget: {
        maxRequests: 1, maxInputTokens: 10_000, maxOutputTokens: 2_000, maxDurationMs: 120_000,
      },
    },
    {
      id: 'documentation-depth', purpose: 'documentation', activation: 'ON_TRIGGER',
      triggers: ['documentation_drift', 'public_contract_change'],
      context: ['changed_files', 'documentation'], minSeverity: 'info',
      budget: {
        maxRequests: 2, maxInputTokens: 20_000, maxOutputTokens: 4_000, maxDurationMs: 300_000,
      },
    },
    {
      id: 'intent-depth', purpose: 'refactoring', activation: 'ON_TRIGGER',
      triggers: ['high_change_risk', 'intent_conflict', 'scope_ambiguity'],
      context: ['changed_symbols', 'dependency_graph', 'diagnostics', 'intent_evidence', 'tests'],
      minSeverity: 'warning',
      budget: {
        maxRequests: 3, maxInputTokens: 30_000, maxOutputTokens: 6_000, maxDurationMs: 480_000,
      },
    },
  ],
});

const canonical = `DOCUMENT "T2C_ANALYSIS_POLICY"
VERSION 1
SCHEMA "t2c.analysis-policy/v1"
PROFILE_ID "intent-refactor-deep"
LLM_POLICY "REQUIRE_FOR_SELECTED_STAGES"
CACHE_MODE "EXACT_EVIDENCE"
ON_PROVIDER_UNAVAILABLE "FAIL"
ON_BUDGET_EXHAUSTED "REPORT_INCOMPLETE"
MAX_REQUESTS 6
MAX_INPUT_TOKENS 60000
MAX_OUTPUT_TOKENS 12000
MAX_DURATION_MS 900000
STAGE_COUNT 3
STAGE
ID "baseline"
PURPOSE "intent"
ACTIVATION "ALWAYS"
TRIGGERS []
CONTEXT ["changed_files","intent_evidence"]
MIN_SEVERITY "warning"
MAX_REQUESTS 1
MAX_INPUT_TOKENS 10000
MAX_OUTPUT_TOKENS 2000
MAX_DURATION_MS 120000
END_STAGE
STAGE
ID "documentation-depth"
PURPOSE "documentation"
ACTIVATION "ON_TRIGGER"
TRIGGERS ["documentation_drift","public_contract_change"]
CONTEXT ["changed_files","documentation"]
MIN_SEVERITY "info"
MAX_REQUESTS 2
MAX_INPUT_TOKENS 20000
MAX_OUTPUT_TOKENS 4000
MAX_DURATION_MS 300000
END_STAGE
STAGE
ID "intent-depth"
PURPOSE "refactoring"
ACTIVATION "ON_TRIGGER"
TRIGGERS ["high_change_risk","intent_conflict","scope_ambiguity"]
CONTEXT ["changed_symbols","dependency_graph","diagnostics","intent_evidence","tests"]
MIN_SEVERITY "warning"
MAX_REQUESTS 3
MAX_INPUT_TOKENS 30000
MAX_OUTPUT_TOKENS 6000
MAX_DURATION_MS 480000
END_STAGE
`;

test('analysis policy renders and parses one canonical byte representation', () => {
  const document = policy();
  assert.equal(renderAnalysisPolicy(document), canonical);
  assert.deepEqual(parseAnalysisPolicy(canonical), document);
  assert.equal(renderAnalysisPolicy(parseAnalysisPolicy(canonical)), canonical);
});

test('deterministic triggers select required LLM stages and exact usage ceilings', () => {
  const document = policy();
  assert.deepEqual(selectAnalysisStages(document, []).map((stage) => stage.id), ['baseline']);
  assert.deepEqual(calculateAnalysisUsageCeiling(document, []), {
    stageIds: ['baseline'], maxRequests: 1, maxInputTokens: 10_000,
    maxOutputTokens: 2_000, maxDurationMs: 120_000,
  });
  assert.deepEqual(calculateAnalysisUsageCeiling(document, ['documentation_drift']), {
    stageIds: ['baseline', 'documentation-depth'],
    maxRequests: 3, maxInputTokens: 30_000, maxOutputTokens: 6_000, maxDurationMs: 420_000,
  });
  assert.deepEqual(calculateAnalysisUsageCeiling(document, ['high_change_risk', 'scope_ambiguity']), {
    stageIds: ['baseline', 'intent-depth'],
    maxRequests: 4, maxInputTokens: 40_000, maxOutputTokens: 8_000, maxDurationMs: 600_000,
  });
  assert.deepEqual(calculateAnalysisUsageCeiling(document, [
    'documentation_drift', 'high_change_risk', 'intent_conflict',
    'public_contract_change', 'scope_ambiguity', 'security_sensitive', 'test_gap',
  ]), { stageIds: ['baseline', 'documentation-depth', 'intent-depth'], ...document.budget });
});

test('selection rejects unknown, duplicate and non-canonical trigger input', () => {
  const document = policy();
  assert.throws(
    () => selectAnalysisStages(document, ['unknown'] as unknown as AnalysisTrigger[]),
    /observed trigger must be one of/,
  );
  assert.throws(
    () => selectAnalysisStages(document, ['intent_conflict', 'intent_conflict']),
    /observed triggers must be sorted and unique/,
  );
  assert.throws(
    () => selectAnalysisStages(document, ['scope_ambiguity', 'intent_conflict']),
    /observed triggers must be sorted and unique/,
  );
  assert.throws(
    () => selectAnalysisStages(document, [1, 2] as unknown as AnalysisTrigger[]),
    /observed triggers must contain only strings/,
  );
});

test('policy and exact-evidence cache fingerprints bind every semantic input', () => {
  const document = policy();
  const identity = {
    stageId: 'baseline', evidenceFingerprint: 'a'.repeat(64),
    model: 'openrouter/z-ai/glm-5.2', promptContract: 'intent-review/v1',
  };
  const fingerprint = analysisPolicyFingerprint(document);
  const key = createAnalysisCacheKey(document, identity);
  assert.match(fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.match(key, /^sha256:[a-f0-9]{64}$/);
  assert.equal(analysisPolicyFingerprint(structuredClone(document)), fingerprint);
  assert.notEqual(createAnalysisCacheKey(document, { ...identity, evidenceFingerprint: 'b'.repeat(64) }), key);
  assert.notEqual(createAnalysisCacheKey(document, { ...identity, model: 'openrouter/other' }), key);
  assert.notEqual(createAnalysisCacheKey(document, { ...identity, promptContract: 'intent-review/v2' }), key);
  assert.throws(() => createAnalysisCacheKey(document, { ...identity, stageId: 'missing' }), /Unknown cache stage/);
  assert.throws(() => createAnalysisCacheKey(document, { ...identity, evidenceFingerprint: 'short' }), /SHA-256/);
});

test('token ceilings convert to a deterministic provider-rate cost bound', () => {
  const document = policy();
  assert.equal(estimateAnalysisCostUsd(document.budget, {
    inputUsdPerMillion: 2, outputUsdPerMillion: 8,
  }), 0.216);
  const baseline = calculateAnalysisUsageCeiling(document, []);
  assert.equal(estimateAnalysisCostUsd(baseline, {
    inputUsdPerMillion: 2, outputUsdPerMillion: 8,
  }), 0.036);
  assert.throws(
    () => estimateAnalysisCostUsd(document.budget, { inputUsdPerMillion: -1, outputUsdPerMillion: 8 }),
    /inputUsdPerMillion must be a non-negative number/,
  );
});

test('policy rejects semantic fallback and non-exact cache modes', () => {
  const document = policy();
  assert.throws(
    () => assertAnalysisPolicy({ ...document, llmPolicy: 'DETERMINISTIC' } as unknown as AnalysisPolicy),
    /LLM_POLICY must be REQUIRE_FOR_SELECTED_STAGES/,
  );
  assert.throws(
    () => assertAnalysisPolicy({ ...document, cacheMode: 'LATEST' } as unknown as AnalysisPolicy),
    /CACHE_MODE must be EXACT_EVIDENCE/,
  );
  assert.throws(
    () => assertAnalysisPolicy({ ...document, onProviderUnavailable: 'FALLBACK' } as unknown as AnalysisPolicy),
    /ON_PROVIDER_UNAVAILABLE must be FAIL/,
  );
  assert.doesNotThrow(() => assertAnalysisPolicy({ ...document, onBudgetExhausted: 'FAIL' }));
});

test('stage topology and nested budgets fail closed', () => {
  const document = policy();
  const noAlways = structuredClone(document);
  noAlways.stages[0]!.activation = 'ON_TRIGGER';
  noAlways.stages[0]!.triggers = ['test_gap'];
  assert.throws(() => assertAnalysisPolicy(noAlways), /at least one ALWAYS semantic stage/);

  const triggeredAlways = structuredClone(document);
  triggeredAlways.stages[0]!.triggers = ['intent_conflict'];
  assert.throws(() => assertAnalysisPolicy(triggeredAlways), /ALWAYS stage baseline cannot declare triggers/);

  const emptyConditional = structuredClone(document);
  emptyConditional.stages[1]!.triggers = [];
  assert.throws(() => assertAnalysisPolicy(emptyConditional), /ON_TRIGGER stage documentation-depth requires/);

  const excessive = structuredClone(document);
  excessive.budget.maxRequests = 5;
  assert.throws(() => assertAnalysisPolicy(excessive), /Combined stage budgets exceeds/);

  const insufficientDeadline = structuredClone(document);
  insufficientDeadline.budget.maxDurationMs = 899_999;
  assert.throws(() => assertAnalysisPolicy(insufficientDeadline), /Combined stage budgets exceeds/);

  const unboundedDeadline = structuredClone(document);
  unboundedDeadline.stages[0]!.budget.maxDurationMs = 0;
  assert.throws(() => assertAnalysisPolicy(unboundedDeadline), /maxDurationMs must be an integer between/);

  const duplicate = structuredClone(document);
  duplicate.stages[1]!.id = 'baseline';
  assert.throws(() => assertAnalysisPolicy(duplicate), /stage IDs must be sorted and unique/);

  const unknown = structuredClone(document);
  unknown.stages[2]!.triggers = ['unknown'] as unknown as AnalysisTrigger[];
  assert.throws(() => assertAnalysisPolicy(unknown), /TRIGGERS must be one of/);

  const malformedStages = { ...document, stages: [null] } as unknown as AnalysisPolicy;
  assert.throws(() => assertAnalysisPolicy(malformedStages), /must contain only stage objects/);
});

test('parser rejects non-canonical and structurally ambiguous text', () => {
  assert.throws(() => parseAnalysisPolicy(`\uFEFF${canonical}`), /BOM-free/);
  assert.throws(() => parseAnalysisPolicy(canonical.replaceAll('\n', '\r\n')), /canonical LF/);
  assert.throws(() => parseAnalysisPolicy(canonical.slice(0, -1)), /canonical LF/);
  assert.throws(() => parseAnalysisPolicy(canonical.replace('VERSION 1\n', 'VERSION 1\n\n')), /canonical LF/);
  assert.throws(() => parseAnalysisPolicy(canonical.replace('STAGE_COUNT 3', 'STAGE_COUNT 2')), /Trailing policy/);
  assert.throws(() => parseAnalysisPolicy(canonical.replace('STAGE_COUNT 3', 'STAGE_COUNT 0')), /between 1 and 16/);
  assert.throws(() => parseAnalysisPolicy(canonical.replace(
    '["changed_files","intent_evidence"]', '["changed_files", "intent_evidence"]',
  )), /canonical JSON string array/);
  assert.throws(() => parseAnalysisPolicy(`${canonical}UNEXPECTED true\n`), /Trailing policy/);
});
