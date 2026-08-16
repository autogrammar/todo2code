import path from 'node:path';

import type { T2CConfig } from '../config/env.js';
import { pathExists, readText, relativePosix, walkFiles } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import { assertPathWithinRoot } from '../core/security.js';
import {
  detectModality,
  detectPolarity,
  extractPaths,
  extractSymbols,
  extractTickets,
  extractVersions,
  inferObject,
} from '../core/text.js';
import type { ExtractionResult, JsonValue } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';
import {
  loadParticipantIdentityRegistry,
  type LoadedParticipantIdentityRegistry,
} from '../communication/identity.js';
import {
  attributionWarnings,
  resolveAttribution,
  semanticsFor,
} from './communication-attribution.js';
import {
  communicationSegments,
  hasExplicitCommunicationEnvelope,
  inferIdentity,
  isTicketEvidenceFile,
  looksLikeTicket,
  parseEnvelope,
} from './communication-envelope.js';
import type {
  CommunicationAttribution,
  CommunicationCandidate,
  CommunicationExtractionOptions,
  CommunicationRole,
  CommunicationSegment,
  CommunicationType,
} from './communication-types.js';

export type {
  CommunicationExtractionOptions,
  CommunicationRole,
  CommunicationType,
} from './communication-types.js';

/**
 * Converts append-only human/agent communication under project/<ticket>/ to
 * canonical agent_log records. Front matter is intentionally parsed without a
 * YAML dependency: the contract is a flat key/value envelope, not arbitrary
 * YAML.
 */
export async function extractCommunicationIntent(
  options: CommunicationExtractionOptions,
  config: T2CConfig,
): Promise<ExtractionResult> {
  const root = path.resolve(options.root);
  const projectRoot = await assertPathWithinRoot(
    root,
    path.resolve(root, options.projectDir ?? 'project'),
    config.allowOutsideRoot,
  );
  if (!(await pathExists(projectRoot))) {
    return { records: [], warnings: [`Communication directory not found: ${relativePosix(root, projectRoot)}`] };
  }

  const files = await walkFiles(projectRoot, { extensions: ['.md', '.txt'], maxFiles: 20_000 });
  const identityRegistry = await loadParticipantIdentityRegistry(
    root, projectRoot, config.maxFileBytes, config.allowOutsideRoot,
  );
  const records: ExtractionResult['records'] = [];
  const warnings: string[] = [];
  let communicationFiles = 0;

  for (const file of files) {
    const loaded = await loadCommunicationCandidate(
      file, projectRoot, options.ticket ?? null, config.maxFileBytes, Boolean(identityRegistry),
    );
    warnings.push(...loaded.warnings);
    if (!loaded.candidate) continue;
    communicationFiles += 1;
    const extracted = await convertCommunicationCandidate(
      root, loaded.candidate, identityRegistry, config,
    );
    records.push(...extracted.records);
    warnings.push(...extracted.warnings);
  }

  if (records.length === 0 && communicationFiles > 0) warnings.push('No intent-like communication statements were found');
  return { records, warnings: [...new Set(warnings)].sort() };
}

async function loadCommunicationCandidate(
  file: string,
  projectRoot: string,
  requestedTicket: string | null,
  maxFileBytes: number,
  hasIdentityRegistry: boolean,
): Promise<{ candidate: CommunicationCandidate | null; warnings: string[] }> {
  const relativeToProject = relativePosix(projectRoot, file);
  const parts = relativeToProject.split('/');
  const pathTicket = parts.length > 1 ? parts[0] ?? '' : '';
  if (!matchesRequestedTicket(pathTicket, requestedTicket)) {
    return { candidate: null, warnings: [] };
  }

  const loaded = await readCommunicationFile(file, relativeToProject, maxFileBytes);
  if (loaded.body === null) return { candidate: null, warnings: loaded.warnings };
  const envelope = parseEnvelope(loaded.body);
  if (envelope.malformed) {
    return {
      candidate: null,
      warnings: [`${relativeToProject}: malformed communication front matter; closing --- is missing`],
    };
  }
  const inferred = inferIdentity(relativeToProject);
  const explicitEnvelope = hasExplicitCommunicationEnvelope(envelope.metadata);
  if (shouldIgnoreCommunicationCandidate(
    relativeToProject, pathTicket, requestedTicket, hasIdentityRegistry, inferred, explicitEnvelope,
  )) {
    return { candidate: null, warnings: [] };
  }
  return {
    candidate: { file, relativeToProject, pathTicket, envelope, inferred },
    warnings: [],
  };
}

function matchesRequestedTicket(pathTicket: string, requestedTicket: string | null): boolean {
  if (!pathTicket) return false;
  if (!requestedTicket) return true;
  return pathTicket.toLowerCase() === requestedTicket.toLowerCase();
}

async function readCommunicationFile(
  file: string,
  relativeToProject: string,
  maxFileBytes: number,
): Promise<{ body: string | null; warnings: string[] }> {
  try {
    return { body: await readText(file, maxFileBytes), warnings: [] };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { body: null, warnings: [`${relativeToProject}: ${detail}`] };
  }
}

function shouldIgnoreCommunicationCandidate(
  relativeToProject: string,
  pathTicket: string,
  requestedTicket: string | null,
  hasIdentityRegistry: boolean,
  inferred: CommunicationCandidate['inferred'],
  explicitEnvelope: boolean,
): boolean {
  if (explicitEnvelope) return false;
  if (isTicketEvidenceFile(relativeToProject)) return true;
  if (requestedTicket || hasIdentityRegistry || looksLikeTicket(pathTicket)) return false;
  return !inferred.role;
}

async function convertCommunicationCandidate(
  root: string,
  candidate: CommunicationCandidate,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
  config: T2CConfig,
): Promise<ExtractionResult> {
  const attribution = resolveAttribution(candidate, identityRegistry);
  const warnings = attributionWarnings(candidate, attribution, identityRegistry);
  const governanceRole = candidate.inferred.governanceParticipantFile
    && !attribution.explicitMessageType ? attribution.role : null;
  const segments = communicationSegments(
    candidate.envelope.body, attribution.messageType, governanceRole,
  );
  if (!segments.length && candidate.inferred.governanceParticipantFile
    && candidate.envelope.body.trim()) {
    warnings.push(
      `${candidate.relativeToProject}: no recognized intent sections for `
      + `${attribution.role}:${attribution.participant}; ${attribution.role} participant must `
      + 'classify the content under a supported heading or add explicit type front matter',
    );
  }
  const records = await Promise.all(segments.map((segment) => buildCommunicationIntentRecord(
    root, candidate, attribution, identityRegistry, segment, config,
  )));
  return { records, warnings };
}

async function buildCommunicationIntentRecord(
  root: string,
  candidate: CommunicationCandidate,
  attribution: CommunicationAttribution,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
  segment: CommunicationSegment,
  config: T2CConfig,
): Promise<ExtractionResult['records'][number]> {
  const semantics = semanticsFor(segment.type, attribution.role);
  const classified = await classifyAction(segment.text, config);
  const action = segment.type === 'decision' && classified.action === 'unknown'
    ? 'approve' : classified.action;
  const tickets = [...new Set([attribution.ticket.toUpperCase(), ...extractTickets(segment.text)])];
  const symbols = [...new Set([...attribution.explicitSymbols, ...extractSymbols(segment.text)])]
    .filter((symbol) => !tickets.some((ticket) =>
      ticket === symbol.toUpperCase() || ticket.startsWith(`${symbol.toUpperCase()}-`)));
  const line = candidate.envelope.bodyStartLine + segment.line - 1;
  return buildRecord({
    kind: `communication_${segment.type}`,
    actor: attribution.participant,
    action,
    subject: attribution.recipient ? `to:${attribution.recipient}` : `ticket:${attribution.ticket}`,
    object: inferObject(segment.text, action),
    target: {
      paths: [...new Set([...attribution.explicitPaths, ...extractPaths(segment.text)])],
      symbols,
      tickets,
      versions: extractVersions(segment.text),
    },
    modality: ['report', 'result', 'claim'].includes(segment.type)
      ? 'claimed' : detectModality(segment.text),
    polarity: detectPolarity(segment.text),
    text: segment.text,
    lifecycle: semantics.lifecycle,
    sourceKind: 'agent_log',
    sourcePath: relativePosix(root, candidate.file),
    sourceLines: { start: line, end: line },
    extractor: 't2c/project-communication@1',
    epistemicClass: semantics.epistemicClass,
    confidence: attribution.role === 'unknown' || attribution.participant.startsWith('unknown:') ? 0.55 : 0.88,
    basis: ['project_ticket_path', 'communication_front_matter', classified.basis],
    observedAt: attribution.timestamp,
    metadata: communicationMetadata(root, attribution, identityRegistry, segment.type),
  });
}

function communicationMetadata(
  root: string,
  attribution: CommunicationAttribution,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
  messageType: CommunicationType,
): Record<string, JsonValue> {
  const { entry, participant, role } = attribution;
  return {
    participant,
    participantId: entry?.id ?? null,
    displayName: attribution.displayName,
    participantRole: role,
    messageType,
    ticket: attribution.ticket,
    recipient: attribution.recipient,
    gitAuthors: attribution.gitAuthors,
    a2aAgentIds: entry?.a2aAgentIds ?? [],
    humanAliases: entry?.humanAliases ?? [],
    identityResolved: identityRegistry ? Boolean(entry) : role !== 'unknown' && !participant.startsWith('unknown:'),
    identitySource: entry ? 'registry' : identityRegistry ? 'unresolved' : 'legacy',
    participantRegistry: identityRegistry ? relativePosix(root, identityRegistry.path) : null,
    llmUsed: false,
  };
}
