// Capability-scoped intent and implementation comparison across repository evidence bundles.
//
// Extends existing `t2c.reality/v1` and `t2c.truth-map/v1` / `t2c.diff/v1` contracts
// by reusing `IntentGraph` records, `TruthMap` assertions, `IntentRealityView` rows,
// and optional `intract.scan/v1` scan artifacts without introducing a second intent parser.

import { sha256, stableStringify } from '../core/id.js';
import { assertIntentGraph } from '../core/schema.js';
import { projectTruthMap, type TruthMap } from '../core/truth-map.js';
import type {
  DiagnosticReport,
  IntentGraph,
  IntentRecord,
} from '../core/types.js';
import { diagnoseGraph } from '../graph/diagnostics.js';
import {
  buildRealityView,
  DECLARED_KINDS,
  OBSERVED_KINDS,
  type IntentRealityView,
} from './reality.js';

export type CapabilityEvidenceState =
  | 'declared'
  | 'observed'
  | 'configuration-only'
  | 'unknown';

export type CapabilityEvidenceGrade =
  | 'runtime_verified_code'
  | 'code'
  | 'configuration'
  | 'declared_only'
  | 'stale'
  | 'missing_extraction'
  | 'unknown';

export type CapabilityCompatibility =
  | 'compatible_verified'
  | 'code_without_runtime_verification'
  | 'configuration_only'
  | 'behavior_mismatch'
  | 'effect_or_platform_mismatch'
  | 'missing_extraction'
  | 'stale_evidence'
  | 'intentional_divergence'
  | 'declared_not_implemented'
  | 'unknown';

export type CapabilityGapKind =
  | 'BEHAVIOR_CONTRACT_MISMATCH'
  | 'EFFECT_OR_PLATFORM_INCOMPATIBLE'
  | 'EXTRACTION_INCOMPLETE'
  | 'STALE_EVIDENCE_HASH'
  | 'RUNTIME_VERIFICATION_MISSING'
  | 'IMPLEMENTATION_MISSING'
  | 'CONFIGURATION_ONLY_EVIDENCE';

export interface IntractScanEvidenceRow {
  file: string;
  line: number;
  end_line?: number;
  span?: { start_line: number; end_line: number };
  scope: string;
  intent: string;
  priority?: number;
  domain?: string;
  inputs?: string[];
  outputs?: string[];
  effects?: string[];
  forbidden?: string[];
  preconditions?: string[];
  validators?: string[];
  symbol_id?: string;
  symbol?: string | null;
  symbol_kind?: string;
  contract_hash?: string;
  source_hash?: string | null;
  basis?: 'declared' | 'inferred';
  source_verified?: boolean;
  source_binding?: {
    status: 'verified' | 'stale' | 'missing' | 'unknown';
    verified: boolean;
    symbol?: string | null;
    symbol_id?: string;
    span?: { start_line: number; end_line: number };
    source_hash?: string | null;
  };
}

export interface RepositoryCapabilityBundle {
  repository: string;
  revision: string;
  sourceHash: string;
  expectedSourceHash?: string;
  extractionComplete?: boolean;
  runtimeVerified?: boolean;
  platform?: string;
  graph: IntentGraph;
  diagnostics?: DiagnosticReport;
  reality?: IntentRealityView;
  truthMap?: TruthMap;
  intractScanRows?: IntractScanEvidenceRow[];
  intentionalDivergences?: string[];
}

export interface CapabilityCitations {
  recordIds: string[];
  assertionIds: string[];
  relationIds: string[];
  realityRowKeys: string[];
  intractSymbolIds: string[];
}

export interface CapabilityProvenance {
  repository: string;
  revision: string;
  sourceHash: string;
  graphFingerprint: string;
  realityFingerprint: string;
  truthMapFingerprint: string;
  citations: CapabilityCitations;
}

export interface CapabilityContractDescriptor {
  capability: string;
  action: string;
  object: string;
  domain: string;
  inputs: string[];
  outputs: string[];
  effects: string[];
  forbidden: string[];
  preconditions: string[];
  platform: string;
  behaviorSignature: string;
}

export interface CapabilityComparisonPair {
  capability: string;
  leftRepository: string;
  rightRepository: string;
  contractMapping: {
    left: CapabilityContractDescriptor;
    right: CapabilityContractDescriptor;
    inputsMatch: boolean;
    outputsMatch: boolean;
    effectsCompatible: boolean;
    platformsCompatible: boolean;
    behaviorMatches: boolean;
  };
  leftProvenance: CapabilityProvenance;
  rightProvenance: CapabilityProvenance;
  leftState: CapabilityEvidenceState;
  rightState: CapabilityEvidenceState;
  leftGrade: CapabilityEvidenceGrade;
  rightGrade: CapabilityEvidenceGrade;
  compatibility: CapabilityCompatibility;
  interchangeable: boolean;
  preservedIntentionalDivergence: boolean;
}

export interface TypedCapabilityGapCandidate {
  id: string;
  kind: CapabilityGapKind;
  capability: string;
  sourceRepository: string;
  targetRepository: string;
  sourceRevision: string;
  targetRevision: string;
  sourceHash: string;
  targetHash: string;
  evidenceState: CapabilityEvidenceState;
  evidenceGrade: CapabilityEvidenceGrade;
  citations: {
    source: CapabilityCitations;
    target: CapabilityCitations;
  };
  explanation: string;
  preservedIntentionalDivergence: boolean;
}

export interface HashBoundReviewProposal {
  schemaVersion: 't2c.capability-review-proposal/v1';
  proposalId: string;
  proposalHash: string;
  boundBundleHashes: Record<string, string>;
  boundGraphFingerprints: Record<string, string>;
  requiresHumanOrControllerApproval: true;
  mutatesSource: false;
  createsTickets: false;
  claimsEquivalenceFromSimilarityAlone: false;
  candidateGapIds: string[];
}

export interface CrossRepoCapabilityComparisonReport {
  schemaVersion: 't2c.capability-comparison/v1';
  realitySchemaVersion: 't2c.reality/v1';
  truthMapSchemaVersion: 't2c.truth-map/v1';
  generatedAt: string;
  bundleFingerprints: Record<string, string>;
  pairs: CapabilityComparisonPair[];
  gapCandidates: TypedCapabilityGapCandidate[];
  reviewProposal: HashBoundReviewProposal;
}

interface ExtractedCapabilitySide {
  capability: string;
  contract: CapabilityContractDescriptor;
  provenance: CapabilityProvenance;
  state: CapabilityEvidenceState;
  grade: CapabilityEvidenceGrade;
  stale: boolean;
  missingExtraction: boolean;
  intentionallyDivergent: boolean;
}

interface ResolveStateParams {
  isMissingExtraction: boolean;
  isStale: boolean;
  hasCodeFact: boolean;
  hasConfigFact: boolean;
  hasDeclared: boolean;
  runtimeVerified: boolean;
}

interface ExtractSideParams {
  capability: string;
  records: IntentRecord[];
  rows: IntractScanEvidenceRow[];
  bundle: RepositoryCapabilityBundle;
  reality: IntentRealityView;
  truthMap: TruthMap;
  divergentSet: Set<string>;
  bundleStale: boolean;
  bundleMissingExtraction: boolean;
}

interface CreateGapParams {
  kind: CapabilityGapKind;
  capability: string;
  source: ExtractedCapabilitySide;
  target: ExtractedCapabilitySide;
  explanation: string;
  preservedIntentionalDivergence: boolean;
}

interface ClassifyCompatParams {
  left: ExtractedCapabilitySide;
  right: ExtractedCapabilitySide;
  effectsCompatible: boolean;
  platformsCompatible: boolean;
  behaviorMatches: boolean;
  preservedIntentionalDivergence: boolean;
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '.').replace(/^\.+|\.+$/g, '');
}

function uniqueSorted(values: Iterable<string>) {
  return [...new Set([...values].map((item) => item.trim()).filter(Boolean))].sort();
}

function stringListFromMetadata(record: IntentRecord, key: string) {
  const raw = record.metadata?.[key];
  if (Array.isArray(raw)) {
    return uniqueSorted(raw.filter((item): item is string => typeof item === 'string'));
  }
  if (typeof raw === 'string' && raw.trim()) {
    return uniqueSorted(raw.split(','));
  }
  const empty: string[] = [];
  return empty;
}

function capabilityNamesForRecord(record: IntentRecord) {
  const explicit = stringListFromMetadata(record, 'capabilities');
  if (explicit.length > 0) {
    return explicit.map(normalizeToken).filter(Boolean);
  }
  const intentMeta = record.metadata?.intent;
  if (typeof intentMeta === 'string' && intentMeta.trim()) {
    return [normalizeToken(intentMeta)];
  }
  const action = normalizeToken(record.statement.action);
  const obj = normalizeToken(record.statement.object);
  if (action && obj) {
    return [`${action}.${obj}`];
  }
  const empty: string[] = [];
  return empty;
}

function isConfigurationRecord(record: IntentRecord) {
  return (
    record.source.kind === 'system'
    || record.statement.kind === 'configuration_file_fact'
    || record.metadata?.aggregate === 'configuration-file'
  );
}

function resolveEvidenceStateAndGrade(params: ResolveStateParams) {
  let state: CapabilityEvidenceState = 'unknown';
  if (!params.isMissingExtraction) {
    if (params.hasCodeFact) state = 'observed';
    else if (params.hasConfigFact) state = 'configuration-only';
    else if (params.hasDeclared) state = 'declared';
  }
  let grade: CapabilityEvidenceGrade = 'unknown';
  if (params.isMissingExtraction) grade = 'missing_extraction';
  else if (params.isStale) grade = 'stale';
  else if (params.hasCodeFact) grade = params.runtimeVerified ? 'runtime_verified_code' : 'code';
  else if (params.hasConfigFact) grade = 'configuration';
  else if (params.hasDeclared) grade = 'declared_only';
  return { state, grade };
}

function collectContractField(
  records: IntentRecord[],
  rows: IntractScanEvidenceRow[],
  key: 'inputs' | 'outputs' | 'effects' | 'forbidden' | 'preconditions',
) {
  return uniqueSorted([
    ...records.flatMap((r) => stringListFromMetadata(r, key)),
    ...rows.flatMap((r) => r[key] ?? []),
  ]);
}

function buildCapabilityContract(
  capability: string,
  records: IntentRecord[],
  rows: IntractScanEvidenceRow[],
  platformRaw?: string,
) {
  const inputs = collectContractField(records, rows, 'inputs');
  const outputs = collectContractField(records, rows, 'outputs');
  const primaryRecord = records[0];
  const parts = capability.split('.');
  const action = parts.length >= 2 && parts[0]
    ? parts[0]
    : (primaryRecord ? normalizeToken(primaryRecord.statement.action) : 'implement');
  const obj = parts.length >= 2 && parts.slice(1).join('.')
    ? parts.slice(1).join('.')
    : (primaryRecord ? normalizeToken(primaryRecord.statement.object) : capability);
  const domain = uniqueSorted([
    ...records.flatMap((r) => stringListFromMetadata(r, 'domain')),
    ...rows.map((r) => r.domain ?? ''),
  ])[0] ?? 'general';
  const explicitBehavior = uniqueSorted(records.flatMap((r) => stringListFromMetadata(r, 'behavior')));
  const behaviorSignature = explicitBehavior.length > 0
    ? explicitBehavior.join('|')
    : `${action}:${obj}:in(${inputs.join(',')})->out(${outputs.join(',')})`;
  const contract: CapabilityContractDescriptor = {
    capability,
    action,
    object: obj,
    domain,
    inputs,
    outputs,
    effects: collectContractField(records, rows, 'effects'),
    forbidden: collectContractField(records, rows, 'forbidden'),
    preconditions: collectContractField(records, rows, 'preconditions'),
    platform: (platformRaw ?? 'agnostic').trim().toLowerCase(),
    behaviorSignature,
  };
  return contract;
}

function extractSingleCapabilitySide(params: ExtractSideParams) {
  const { capability, records, rows, bundle, reality, truthMap } = params;
  const recordIdSet = new Set(records.map((r) => r.id));
  const assertionIds = truthMap.assertions
    .filter((assertion) => assertion.recordIds.some((id) => recordIdSet.has(id)))
    .map((assertion) => assertion.id)
    .sort();
  const relationIds = bundle.graph.relations
    .filter((rel) => recordIdSet.has(rel.from) || recordIdSet.has(rel.to))
    .map((rel) => rel.id)
    .sort();
  const realityRowKeys = reality.rows
    .filter((row) => row.recordIds.some((id) => recordIdSet.has(id)))
    .map((row) => row.key)
    .sort();
  const intractSymbolIds = uniqueSorted(rows.map((r) => r.symbol_id ?? '').filter(Boolean));
  const hasCodeFact = records.some(
    (r) => OBSERVED_KINDS.includes(r.source.kind) && !isConfigurationRecord(r),
  ) || rows.some((r) => r.basis !== 'inferred' && r.source_binding?.status === 'verified');
  const hasConfigFact = records.some((r) => isConfigurationRecord(r));
  const hasDeclared = records.some((r) => DECLARED_KINDS.includes(r.source.kind))
    || rows.some((r) => r.basis === 'declared');
  const isStale = params.bundleStale || rows.some((r) => r.source_binding?.status === 'stale');
  const isMissingExtraction = params.bundleMissingExtraction
    || rows.some((r) => r.source_binding?.status === 'missing');
  const { state, grade } = resolveEvidenceStateAndGrade({
    isMissingExtraction,
    isStale,
    hasCodeFact,
    hasConfigFact,
    hasDeclared,
    runtimeVerified: Boolean(bundle.runtimeVerified),
  });
  const intentionallyDivergent = params.divergentSet.has(capability)
    || records.some((r) => r.metadata?.intentionalDivergence === true);

  const side: ExtractedCapabilitySide = {
    capability,
    contract: buildCapabilityContract(capability, records, rows, bundle.platform),
    provenance: {
      repository: bundle.repository,
      revision: bundle.revision,
      sourceHash: bundle.sourceHash,
      graphFingerprint: bundle.graph.fingerprint,
      realityFingerprint: reality.fingerprint,
      truthMapFingerprint: truthMap.fingerprint,
      citations: {
        recordIds: [...recordIdSet].sort(),
        assertionIds,
        relationIds,
        realityRowKeys,
        intractSymbolIds,
      },
    },
    state,
    grade,
    stale: isStale,
    missingExtraction: isMissingExtraction,
    intentionallyDivergent,
  };
  return side;
}

function resolveBundleProjections(bundle: RepositoryCapabilityBundle, generatedAt: string) {
  const diagnostics = bundle.diagnostics ? bundle.diagnostics : diagnoseGraph(bundle.graph, generatedAt);
  const reality = bundle.reality ? bundle.reality : buildRealityView(bundle.graph, diagnostics, generatedAt);
  const truthMap = bundle.truthMap ? bundle.truthMap : projectTruthMap(bundle.graph, generatedAt);
  const divergentList = bundle.intentionalDivergences ? bundle.intentionalDivergences : [];
  const divergentSet = new Set(divergentList.map(normalizeToken));
  const bundleStale = Boolean(bundle.expectedSourceHash && bundle.expectedSourceHash !== bundle.sourceHash);
  const bundleMissingExtraction = bundle.extractionComplete === false;
  return { reality, truthMap, divergentSet, bundleStale, bundleMissingExtraction };
}

function groupRecordsByCapability(records: IntentRecord[]) {
  const grouped = new Map<string, IntentRecord[]>();
  for (const record of records) {
    for (const cap of capabilityNamesForRecord(record)) {
      const list = grouped.get(cap);
      if (list) list.push(record);
      else grouped.set(cap, [record]);
    }
  }
  return grouped;
}

function groupScanRowsByCapability(scanRows?: IntractScanEvidenceRow[]) {
  const grouped = new Map<string, IntractScanEvidenceRow[]>();
  for (const row of scanRows ? scanRows : []) {
    const cap = normalizeToken(row.intent);
    if (!cap) continue;
    const list = grouped.get(cap);
    if (list) list.push(row);
    else grouped.set(cap, [row]);
  }
  return grouped;
}

function extractCapabilitiesFromBundle(bundle: RepositoryCapabilityBundle, generatedAt: string) {
  assertIntentGraph(bundle.graph);
  const projections = resolveBundleProjections(bundle, generatedAt);
  const groupedRecords = groupRecordsByCapability(bundle.graph.records);
  const groupedScanRows = groupScanRowsByCapability(bundle.intractScanRows);
  const allCapabilities = uniqueSorted([...groupedRecords.keys(), ...groupedScanRows.keys()]);
  const output = new Map<string, ExtractedCapabilitySide>();
  for (const capability of allCapabilities) {
    const records = groupedRecords.get(capability);
    const rows = groupedScanRows.get(capability);
    output.set(
      capability,
      extractSingleCapabilitySide({
        capability,
        records: records ? records : [],
        rows: rows ? rows : [],
        bundle,
        ...projections,
      }),
    );
  }
  return output;
}

function unknownSide(capability: string, bundle: RepositoryCapabilityBundle, generatedAt: string) {
  const projections = resolveBundleProjections(bundle, generatedAt);
  const missingExtraction = projections.bundleMissingExtraction || bundle.graph.records.length === 0;
  const stale = projections.bundleStale;
  const parts = capability.split('.');
  const grade: CapabilityEvidenceGrade = missingExtraction ? 'missing_extraction' : stale ? 'stale' : 'unknown';
  const side: ExtractedCapabilitySide = {
    capability,
    contract: {
      capability,
      action: parts[0] ? parts[0] : 'unknown',
      object: parts.slice(1).join('.') || capability,
      domain: 'unknown',
      inputs: [],
      outputs: [],
      effects: [],
      forbidden: [],
      preconditions: [],
      platform: (bundle.platform ? bundle.platform : 'agnostic').trim().toLowerCase(),
      behaviorSignature: 'unknown',
    },
    provenance: {
      repository: bundle.repository,
      revision: bundle.revision,
      sourceHash: bundle.sourceHash,
      graphFingerprint: bundle.graph.fingerprint,
      realityFingerprint: projections.reality.fingerprint,
      truthMapFingerprint: projections.truthMap.fingerprint,
      citations: {
        recordIds: [],
        assertionIds: [],
        relationIds: [],
        realityRowKeys: [],
        intractSymbolIds: [],
      },
    },
    state: 'unknown',
    grade,
    stale,
    missingExtraction,
    intentionallyDivergent: projections.divergentSet.has(capability),
  };
  return side;
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((val, idx) => val === right[idx]);
}

function effectsAreCompatible(left: CapabilityContractDescriptor, right: CapabilityContractDescriptor) {
  const leftViolatesRight = left.effects.some((fx) => right.forbidden.includes(fx));
  const rightViolatesLeft = right.effects.some((fx) => left.forbidden.includes(fx));
  if (leftViolatesRight || rightViolatesLeft) return false;
  if (left.effects.length > 0 && right.effects.length > 0 && !arraysEqual(left.effects, right.effects)) {
    return false;
  }
  return true;
}

function platformsAreCompatible(leftPlatform: string, rightPlatform: string) {
  if (leftPlatform === 'agnostic' || rightPlatform === 'agnostic') return true;
  return leftPlatform === rightPlatform;
}

function createGapCandidate(params: CreateGapParams) {
  const payload = {
    kind: params.kind,
    capability: params.capability,
    sourceRepository: params.source.provenance.repository,
    targetRepository: params.target.provenance.repository,
    sourceRevision: params.source.provenance.revision,
    targetRevision: params.target.provenance.revision,
    sourceHash: params.source.provenance.sourceHash,
    targetHash: params.target.provenance.sourceHash,
  };
  const candidate: TypedCapabilityGapCandidate = {
    id: `GAP-${sha256(stableStringify(payload)).slice(0, 16)}`,
    ...payload,
    evidenceState: params.target.state,
    evidenceGrade: params.target.grade,
    citations: {
      source: params.source.provenance.citations,
      target: params.target.provenance.citations,
    },
    explanation: params.explanation,
    preservedIntentionalDivergence: params.preservedIntentionalDivergence,
  };
  return candidate;
}

const COMPATIBILITY_TO_GAP_KIND: Partial<Record<CapabilityCompatibility, CapabilityGapKind>> = {
  behavior_mismatch: 'BEHAVIOR_CONTRACT_MISMATCH',
  effect_or_platform_mismatch: 'EFFECT_OR_PLATFORM_INCOMPATIBLE',
  missing_extraction: 'EXTRACTION_INCOMPLETE',
  stale_evidence: 'STALE_EVIDENCE_HASH',
  code_without_runtime_verification: 'RUNTIME_VERIFICATION_MISSING',
  declared_not_implemented: 'IMPLEMENTATION_MISSING',
  configuration_only: 'CONFIGURATION_ONLY_EVIDENCE',
};

function validateDistinctBundles(bundles: RepositoryCapabilityBundle[]) {
  if (bundles.length < 2) {
    throw new Error('At least two distinct repository evidence bundles are required for comparison.');
  }
  const seenRepos = new Set<string>();
  for (const bundle of bundles) {
    if (!bundle.repository.trim()) {
      throw new Error('Repository identity must not be blank.');
    }
    if (seenRepos.has(bundle.repository)) {
      throw new Error(`Duplicate repository identity in cross-project comparison: ${bundle.repository}`);
    }
    seenRepos.add(bundle.repository);
  }
}

function classifyNonStructuralState(left: ExtractedCapabilitySide, right: ExtractedCapabilitySide) {
  if (left.state === 'configuration-only' || right.state === 'configuration-only') {
    const res: CapabilityCompatibility = 'configuration_only';
    return res;
  }
  if (left.state === 'declared' || right.state === 'declared') {
    const res: CapabilityCompatibility = 'declared_not_implemented';
    return res;
  }
  if (left.state === 'unknown' || right.state === 'unknown') {
    const res: CapabilityCompatibility = 'unknown';
    return res;
  }
  if (left.grade !== 'runtime_verified_code' || right.grade !== 'runtime_verified_code') {
    const res: CapabilityCompatibility = 'code_without_runtime_verification';
    return res;
  }
  const res: CapabilityCompatibility = 'compatible_verified';
  return res;
}

function classifyCapabilityCompatibility(params: ClassifyCompatParams) {
  const { left, right } = params;
  if (params.preservedIntentionalDivergence) return 'intentional_divergence' as const;
  if (left.missingExtraction || right.missingExtraction) return 'missing_extraction' as const;
  if (left.stale || right.stale) return 'stale_evidence' as const;
  if (!params.effectsCompatible || !params.platformsCompatible) return 'effect_or_platform_mismatch' as const;
  if (!params.behaviorMatches) return 'behavior_mismatch' as const;
  return classifyNonStructuralState(left, right);
}

function compareCapabilityPair(
  capability: string,
  left: ExtractedCapabilitySide,
  right: ExtractedCapabilitySide,
) {
  const inputsMatch = arraysEqual(left.contract.inputs, right.contract.inputs);
  const outputsMatch = arraysEqual(left.contract.outputs, right.contract.outputs);
  const effectsCompatible = effectsAreCompatible(left.contract, right.contract);
  const platformsCompatible = platformsAreCompatible(left.contract.platform, right.contract.platform);
  const behaviorMatches =
    left.contract.behaviorSignature !== 'unknown'
    && left.contract.behaviorSignature === right.contract.behaviorSignature
    && inputsMatch
    && outputsMatch;
  const preservedIntentionalDivergence = left.intentionallyDivergent || right.intentionallyDivergent;
  const compatibility = classifyCapabilityCompatibility({
    left,
    right,
    effectsCompatible,
    platformsCompatible,
    behaviorMatches,
    preservedIntentionalDivergence,
  });
  const pair: CapabilityComparisonPair = {
    capability,
    leftRepository: left.provenance.repository,
    rightRepository: right.provenance.repository,
    contractMapping: {
      left: left.contract,
      right: right.contract,
      inputsMatch,
      outputsMatch,
      effectsCompatible,
      platformsCompatible,
      behaviorMatches,
    },
    leftProvenance: left.provenance,
    rightProvenance: right.provenance,
    leftState: left.state,
    rightState: right.state,
    leftGrade: left.grade,
    rightGrade: right.grade,
    compatibility,
    interchangeable: compatibility === 'compatible_verified',
    preservedIntentionalDivergence,
  };
  const gapKind = !preservedIntentionalDivergence ? COMPATIBILITY_TO_GAP_KIND[compatibility] : undefined;
  if (!gapKind) return { pair, gap: undefined };
  const target = right.grade === 'runtime_verified_code' ? left : right;
  const source = target === right ? left : right;
  const gap = createGapCandidate({
    kind: gapKind,
    capability,
    source,
    target,
    explanation: `Capability '${capability}' between ${left.provenance.repository} and ${right.provenance.repository} classified as '${compatibility}' (left=${left.state}/${left.grade}, right=${right.state}/${right.grade}).`,
    preservedIntentionalDivergence: false,
  });
  return { pair, gap };
}

export function compareCapabilityEvidenceBundles(
  bundles: RepositoryCapabilityBundle[],
  generatedAt = new Date().toISOString(),
) {
  validateDistinctBundles(bundles);
  const extractedByRepo = new Map<string, Map<string, ExtractedCapabilitySide>>();
  const bundleFingerprints: Record<string, string> = {};
  const boundBundleHashes: Record<string, string> = {};
  const boundGraphFingerprints: Record<string, string> = {};

  for (const bundle of bundles) {
    extractedByRepo.set(bundle.repository, extractCapabilitiesFromBundle(bundle, generatedAt));
    boundBundleHashes[bundle.repository] = bundle.sourceHash;
    boundGraphFingerprints[bundle.repository] = bundle.graph.fingerprint;
    bundleFingerprints[bundle.repository] = sha256(
      stableStringify({
        repository: bundle.repository,
        revision: bundle.revision,
        sourceHash: bundle.sourceHash,
        graphFingerprint: bundle.graph.fingerprint,
      }),
    );
  }

  const pairs: CapabilityComparisonPair[] = [];
  const gapCandidates: TypedCapabilityGapCandidate[] = [];

  for (let i = 0; i < bundles.length; i += 1) {
    for (let j = i + 1; j < bundles.length; j += 1) {
      const leftBundle = bundles[i]!;
      const rightBundle = bundles[j]!;
      const leftMap = extractedByRepo.get(leftBundle.repository)!;
      const rightMap = extractedByRepo.get(rightBundle.repository)!;
      const capabilities = uniqueSorted([...leftMap.keys(), ...rightMap.keys()]);
      for (const capability of capabilities) {
        const left = leftMap.get(capability) ?? unknownSide(capability, leftBundle, generatedAt);
        const right = rightMap.get(capability) ?? unknownSide(capability, rightBundle, generatedAt);
        const { pair, gap } = compareCapabilityPair(capability, left, right);
        pairs.push(pair);
        if (gap) gapCandidates.push(gap);
      }
    }
  }

  const candidateGapIds = gapCandidates.map((gap) => gap.id);
  const proposalHash = sha256(
    stableStringify({
      boundBundleHashes,
      boundGraphFingerprints,
      candidateGapIds,
      pairs: pairs.map((p) => [p.capability, p.leftRepository, p.rightRepository, p.compatibility, p.interchangeable]),
    }),
  );

  const report: CrossRepoCapabilityComparisonReport = {
    schemaVersion: 't2c.capability-comparison/v1',
    realitySchemaVersion: 't2c.reality/v1',
    truthMapSchemaVersion: 't2c.truth-map/v1',
    generatedAt,
    bundleFingerprints,
    pairs,
    gapCandidates,
    reviewProposal: {
      schemaVersion: 't2c.capability-review-proposal/v1',
      proposalId: `PROP-${proposalHash.slice(0, 16)}`,
      proposalHash,
      boundBundleHashes,
      boundGraphFingerprints,
      requiresHumanOrControllerApproval: true,
      mutatesSource: false,
      createsTickets: false,
      claimsEquivalenceFromSimilarityAlone: false,
      candidateGapIds,
    },
  };
  return report;
}
