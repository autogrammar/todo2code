import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { relativePosix } from '../core/io.js';
import type { ExtractionResult } from '../core/types.js';
import type { LoadedParticipantIdentityRegistry, ParticipantIdentityEntry } from '../communication/identity.js';
import {
  buildCommunicationRecords,
  CommunicationType,
  communicationSegments,
  first,
  inferIdentity,
  isTicketEvidenceFile,
  listValue,
  looksLikeTicket,
  normalizeRole,
  normalizeType,
  parseEnvelope,
  resolveIdentity,
  sameStrings,
  validTimestamp,
} from './communication-helpers.js';
import type { CommunicationRole } from './communication-helpers.js';

export interface CommunicationFileOutcome {
  records: ExtractionResult['records'];
  warnings: string[];
  communicationFiles: number;
}

export async function extractCommunicationFile(
  file: string,
  projectRoot: string,
  root: string,
  options: { ticket?: string | null },
  config: T2CConfig,
  readText: (filePath: string, maxBytes: number) => Promise<string>,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): Promise<CommunicationFileOutcome | null> {
  const scope = resolveFileScope(file, projectRoot, options.ticket);
  if (!scope) return null;

  const readResult = await readCommunicationBody(file, config.maxFileBytes, readText);
  if (!readResult.success) {
    return {
      records: [],
      warnings: [`${scope.relativeToProject}: ${readResult.error}`],
      communicationFiles: 0,
    };
  }

  const envelope = parseEnvelope(readResult.body);
  const inferred = inferIdentity(scope.relativeToProject);
  if (shouldSkipCommunicationFile(scope.relativeToProject, options.ticket, scope.pathTicket, envelope, inferred, identityRegistry)) {
    return null;
  }

  const extracted = collectCommunicationMetadata(
    scope.relativeToProject,
    scope.pathTicket,
    inferred,
    envelope,
    identityRegistry,
  );

  const localWarnings = buildLocalWarnings(
    scope.relativeToProject,
    extracted,
    identityRegistry,
    envelope,
  );

  const segmentResult = buildCommunicationSegments(scope.relativeToProject, extracted, envelope);
  localWarnings.push(...segmentResult.warnings);

  const records = await buildCommunicationRecords(
    root,
    file,
    extracted.role,
    extracted.ticket,
    extracted.participant,
    extracted.identity,
    extracted.recipient,
    extracted.timestamp,
    extracted.explicitPaths,
    extracted.explicitSymbols,
    extracted.gitAuthors,
    extracted.displayName,
    segmentResult.segments,
    config,
    envelope.bodyStartLine,
    Boolean(identityRegistry),
    identityRegistry ? relativePosix(root, identityRegistry.path) : null,
  );

  return {
    records,
    warnings: localWarnings,
    communicationFiles: 1,
  };
}

function shouldSkipCommunicationFile(
  relativeToProject: string,
  ticket: string | null | undefined,
  pathTicket: string,
  envelope: ReturnType<typeof parseEnvelope>,
  inferred: ReturnType<typeof inferIdentity>,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): boolean {
  const explicitEnvelope = hasExplicitEnvelopeMetadata(envelope);
  if (!explicitEnvelope && isTicketEvidenceFile(relativeToProject)) return true;
  if (!ticket && !identityRegistry && !looksLikeTicket(pathTicket) && !inferred.role && !explicitEnvelope) return true;
  return false;
}

function hasExplicitEnvelopeMetadata(envelope: ReturnType<typeof parseEnvelope>): boolean {
  return Boolean(
    first(
      envelope.metadata.participant,
      envelope.metadata.participant_id,
      envelope.metadata['participant-id'],
      envelope.metadata.role,
      envelope.metadata.type,
      envelope.metadata.ticket,
    ),
  );
}

function buildCommunicationSegments(
  relativeToProject: string,
  metadata: CommunicationMetadata,
  envelope: ReturnType<typeof parseEnvelope>,
): { segments: ReturnType<typeof communicationSegments>; warnings: string[] } {
  const inferredRole = metadata.inferred.governanceParticipantFile && !metadata.explicitMessageType ? metadata.role : null;
  const segments = communicationSegments(envelope.body, metadata.messageType, inferredRole);
  if (segments.length === 0 && metadata.inferred.governanceParticipantFile && envelope.body.trim()) {
    return {
      segments,
      warnings: [
        `${relativeToProject}: no recognized intent sections for ${metadata.role}:${metadata.participant}; `
        + `${metadata.role} participant must classify the content under a supported heading or add explicit type front matter`,
      ],
    };
  }

  return { segments, warnings: [] };
}

interface CommunicationMetadata {
  declaredRole: CommunicationRole;
  role: CommunicationRole;
  participant: string;
  identity: { entry: ParticipantIdentityEntry | null };
  displayName: string;
  recipient: string | null;
  timestamp: string | null;
  explicitPaths: string[];
  explicitSymbols: string[];
  gitAuthors: string[];
  messageType: CommunicationType;
  explicitMessageType: string | null;
  ticket: string;
  inferred: ReturnType<typeof inferIdentity>;
}

function resolveFileScope(
  file: string,
  projectRoot: string,
  ticket?: string | null,
): { relativeToProject: string; pathTicket: string } | null {
  const relativeToProject = relativePosix(projectRoot, file);
  const segments = relativeToProject.split('/');
  const pathTicket = segments.length > 1 ? segments[0] ?? '' : '';
  if (!pathTicket) return null;
  if (ticket && pathTicket.toLowerCase() !== ticket.toLowerCase()) return null;
  return { relativeToProject, pathTicket };
}

async function readCommunicationBody(
  file: string,
  maxBytes: number,
  readText: (filePath: string, maxBytes: number) => Promise<string>,
): Promise<{ success: true; body: string } | { success: false; error: string }> {
  try {
    return { success: true, body: await readText(file, maxBytes) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function collectCommunicationMetadata(
  relativeToProject: string,
  pathTicket: string,
  inferred: ReturnType<typeof inferIdentity>,
  envelope: ReturnType<typeof parseEnvelope>,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): CommunicationMetadata {
  const declaredParticipant = first(
    envelope.metadata.participant,
    envelope.metadata.actor,
    inferred.participant,
  );
  const declaredRole = normalizeRole(first(envelope.metadata.role, inferred.role));
  const declaredParticipantId = first(envelope.metadata.participant_id, envelope.metadata['participant-id']);
  const identity = resolveIdentity(identityRegistry?.byId ?? null, declaredParticipantId);
  const participant = identity.entry?.id ?? declaredParticipantId ?? declaredParticipant ?? `unknown:${path.basename(relativeToProject)}`;
  const role = identity.entry?.role ?? declaredRole;
  const displayName = identity.entry?.displayName ?? declaredParticipant ?? participant;
  const explicitMessageType = first(envelope.metadata.type, envelope.metadata.kind);
  const messageType = normalizeType(first(explicitMessageType, inferred.type));
  const ticket = first(envelope.metadata.ticket, pathTicket) ?? pathTicket;
  const recipient = first(envelope.metadata.recipient, envelope.metadata.to);
  const rawTimestamp = first(
    envelope.metadata.timestamp,
    envelope.metadata.created_at,
    envelope.metadata.createdat,
  );
  const timestamp = validTimestamp(rawTimestamp);
  const declaredGitAuthors = listValue(first(
    envelope.metadata.git_authors,
    envelope.metadata['git-authors'],
    envelope.metadata.git_author,
  ));
  const gitAuthors = identity.entry ? [...identity.entry.gitAuthors] : declaredGitAuthors;
  const explicitPaths = listValue(first(
    envelope.metadata.paths,
    envelope.metadata.target_paths,
    envelope.metadata['target-paths'],
  ));
  const explicitSymbols = listValue(first(
    envelope.metadata.symbols,
    envelope.metadata.target_symbols,
    envelope.metadata['target-symbols'],
  ));

  return {
    declaredRole,
    role,
    participant,
    identity,
    displayName,
    recipient,
    timestamp,
    explicitPaths,
    explicitSymbols,
    gitAuthors,
    messageType,
    explicitMessageType,
    ticket,
    inferred,
  };
}

function buildLocalWarnings(
  relativeToProject: string,
  metadata: CommunicationMetadata,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
  envelope: ReturnType<typeof parseEnvelope>,
): string[] {
  const warnings: string[] = [];
  appendRoleAndParticipantWarnings(relativeToProject, metadata, warnings);

  if (identityRegistry && !metadata.identity.entry) {
    appendIdentityWarnings(relativeToProject, metadata, identityRegistry, envelope, warnings);
  }
  appendRegistryAlignmentWarnings(relativeToProject, metadata, warnings);
  appendA2aAgentWarnings(relativeToProject, metadata, envelope, warnings);
  appendTimestampWarnings(relativeToProject, metadata, envelope, warnings);

  return warnings;
}

function appendRoleAndParticipantWarnings(
  relativeToProject: string,
  metadata: CommunicationMetadata,
  warnings: string[],
): void {
  if (metadata.role === 'unknown') warnings.push(`${relativeToProject}: role must be human or agent`);
  if (metadata.participant.startsWith('unknown:')) warnings.push(`${relativeToProject}: participant is missing`);
}

function appendIdentityWarnings(
  relativeToProject: string,
  metadata: CommunicationMetadata,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
  envelope: ReturnType<typeof parseEnvelope>,
  warnings: string[],
): void {
  if (!identityRegistry) return;
  if (!first(envelope.metadata.participant_id, envelope.metadata['participant-id'])) {
    warnings.push(`${relativeToProject}: participant-id is required when project/participants.json exists`);
  } else {
    if (!metadata.identity.entry) {
      warnings.push(`${relativeToProject}: participant-id is not present in project/participants.json`);
    }
  }
}

function appendRegistryAlignmentWarnings(
  relativeToProject: string,
  metadata: CommunicationMetadata,
  warnings: string[],
): void {
  if (!metadata.identity.entry) return;
  if (metadata.declaredRole !== 'unknown' && metadata.declaredRole !== metadata.identity.entry.role) {
    warnings.push(`${relativeToProject}: declared role conflicts with participant registry`);
  }
  if (metadata.identity.entry && metadata.gitAuthors.length
    && !sameStrings(metadata.gitAuthors, metadata.identity.entry.gitAuthors)) {
    warnings.push(`${relativeToProject}: git-authors differ from participant registry and were ignored`);
  }
}

function appendA2aAgentWarnings(
  relativeToProject: string,
  metadata: CommunicationMetadata,
  envelope: ReturnType<typeof parseEnvelope>,
  warnings: string[],
): void {
  const declaredA2aAgentId = first(envelope.metadata.a2a_agent_id, envelope.metadata['a2a-agent-id']);
  if (!declaredA2aAgentId) return;
  const hasRegistryEntry = Boolean(metadata.identity.entry?.a2aAgentIds.includes(declaredA2aAgentId));
  if (!metadata.identity.entry || !hasRegistryEntry) {
    warnings.push(`${relativeToProject}: a2a-agent-id is not assigned to participant-id in the registry`);
  }
}

function appendTimestampWarnings(
  relativeToProject: string,
  metadata: CommunicationMetadata,
  envelope: ReturnType<typeof parseEnvelope>,
  warnings: string[],
): void {
  const rawTimestamp = first(
    envelope.metadata.timestamp,
    envelope.metadata.created_at,
    envelope.metadata.createdat,
  );
  if (!metadata.timestamp && rawTimestamp) {
    warnings.push(`${relativeToProject}: invalid timestamp`);
  }
}
