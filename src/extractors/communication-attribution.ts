import path from 'node:path';

import type { EpistemicClass, LifecycleStatus } from '../core/types.js';
import type {
  LoadedParticipantIdentityRegistry,
  ParticipantIdentityEntry,
} from '../communication/identity.js';
import type {
  CommunicationAttribution,
  CommunicationCandidate,
  CommunicationRole,
  CommunicationType,
} from './communication-types.js';
import {
  first,
  listValue,
  normalizeRole,
  normalizeType,
  validTimestamp,
} from './communication-envelope.js';

export function resolveAttribution(
  candidate: CommunicationCandidate,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): CommunicationAttribution {
  return {
    ...resolveParticipantAttribution(candidate, identityRegistry),
    ...resolveMessageAttribution(candidate),
    ...resolveTargetAttribution(candidate.envelope.metadata),
  };
}

export function attributionWarnings(
  candidate: CommunicationCandidate,
  attribution: CommunicationAttribution,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): string[] {
  return [
    ...basicAttributionWarnings(candidate.relativeToProject, attribution, identityRegistry),
    ...registryAttributionWarnings(candidate, attribution, identityRegistry),
    ...timestampAttributionWarnings(candidate.relativeToProject, attribution),
  ];
}

export function semanticsFor(
  type: CommunicationType,
  role: CommunicationRole,
): { lifecycle: LifecycleStatus; epistemicClass: EpistemicClass } {
  if (type === 'plan') return { lifecycle: 'planned', epistemicClass: 'plan' };
  if (type === 'report' || type === 'result' || type === 'claim') return { lifecycle: 'implemented', epistemicClass: 'claim' };
  if (type === 'decision') return { lifecycle: 'completed', epistemicClass: 'declaration' };
  return { lifecycle: 'proposed', epistemicClass: role === 'agent' ? 'claim' : 'declaration' };
}

export function resolveIdentity(
  byId: Map<string, ParticipantIdentityEntry> | null,
  participantId: string | null,
): { entry: ParticipantIdentityEntry | null } {
  if (!byId || !participantId) return { entry: null };
  return { entry: byId.get(participantId) ?? null };
}

function resolveParticipantAttribution(
  candidate: CommunicationCandidate,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): Pick<CommunicationAttribution,
  'declaredParticipantId' | 'entry' | 'participant' | 'role' | 'displayName'
  | 'declaredGitAuthors' | 'gitAuthors' | 'declaredA2aAgentId'> {
  const { envelope, inferred, file } = candidate;
  const declaredParticipant = first(envelope.metadata.participant, envelope.metadata.actor, inferred.participant);
  const declaredRole = normalizeRole(first(envelope.metadata.role, inferred.role));
  const declaredParticipantId = first(envelope.metadata.participant_id, envelope.metadata['participant-id']);
  const entry = resolveIdentity(identityRegistry?.byId ?? null, declaredParticipantId).entry;
  const participant = resolvedParticipant(entry, declaredParticipantId, declaredParticipant, file);
  const declaredGitAuthors = listValue(first(
    envelope.metadata.git_authors, envelope.metadata['git-authors'], envelope.metadata.git_author,
  ));
  return {
    declaredParticipantId,
    entry,
    participant,
    role: entry?.role ?? declaredRole,
    displayName: resolvedDisplayName(entry, declaredParticipant, participant),
    declaredGitAuthors,
    gitAuthors: entry ? [...entry.gitAuthors] : declaredGitAuthors,
    declaredA2aAgentId: first(envelope.metadata.a2a_agent_id, envelope.metadata['a2a-agent-id']),
  };
}

function resolvedParticipant(
  entry: ParticipantIdentityEntry | null,
  declaredParticipantId: string | null,
  declaredParticipant: string | null,
  file: string,
): string {
  return entry?.id ?? declaredParticipantId ?? declaredParticipant ?? `unknown:${path.basename(file)}`;
}

function resolvedDisplayName(
  entry: ParticipantIdentityEntry | null,
  declaredParticipant: string | null,
  participant: string,
): string {
  return entry?.displayName ?? declaredParticipant ?? participant;
}

function resolveMessageAttribution(
  candidate: CommunicationCandidate,
): Pick<CommunicationAttribution,
  'explicitMessageType' | 'messageType' | 'ticket' | 'recipient' | 'rawTimestamp' | 'timestamp'> {
  const { envelope, inferred, pathTicket } = candidate;
  const explicitMessageType = first(envelope.metadata.type, envelope.metadata.kind);
  const rawTimestamp = first(envelope.metadata.timestamp, envelope.metadata.created_at, envelope.metadata.createdat);
  return {
    explicitMessageType,
    messageType: normalizeType(first(explicitMessageType, inferred.type)),
    ticket: first(envelope.metadata.ticket, pathTicket) ?? pathTicket,
    recipient: first(envelope.metadata.recipient, envelope.metadata.to),
    rawTimestamp,
    timestamp: validTimestamp(rawTimestamp),
  };
}

function resolveTargetAttribution(
  metadata: Record<string, string>,
): Pick<CommunicationAttribution, 'explicitPaths' | 'explicitSymbols'> {
  return {
    explicitPaths: listValue(first(
      metadata.paths, metadata.target_paths, metadata['target-paths'],
    )),
    explicitSymbols: listValue(first(
      metadata.symbols, metadata.target_symbols, metadata['target-symbols'],
    )),
  };
}

function basicAttributionWarnings(
  source: string,
  attribution: CommunicationAttribution,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): string[] {
  const warnings: string[] = [];
  if (attribution.role === 'unknown') warnings.push(`${source}: role must be human or agent`);
  if (attribution.participant.startsWith('unknown:')) warnings.push(`${source}: participant is missing`);
  if (identityRegistry && !attribution.declaredParticipantId) {
    warnings.push(`${source}: participant-id is required when project/participants.json exists`);
  } else if (identityRegistry && !attribution.entry) {
    warnings.push(`${source}: participant-id is not present in project/participants.json`);
  }
  return warnings;
}

function registryAttributionWarnings(
  candidate: CommunicationCandidate,
  attribution: CommunicationAttribution,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): string[] {
  const warnings: string[] = [];
  const source = candidate.relativeToProject;
  const declaredRole = normalizeRole(first(candidate.envelope.metadata.role, candidate.inferred.role));
  if (attribution.entry && declaredRole !== 'unknown' && declaredRole !== attribution.entry.role) {
    warnings.push(`${source}: declared role conflicts with participant registry`);
  }
  if (attribution.entry && attribution.declaredGitAuthors.length
    && !sameStrings(attribution.declaredGitAuthors, attribution.entry.gitAuthors)) {
    warnings.push(`${source}: git-authors differ from participant registry and were ignored`);
  }
  if (attribution.declaredA2aAgentId
    && (!attribution.entry || !attribution.entry.a2aAgentIds.includes(attribution.declaredA2aAgentId))) {
    warnings.push(`${source}: a2a-agent-id is not assigned to participant-id in the registry`);
  }
  return warnings;
}

function timestampAttributionWarnings(
  source: string,
  attribution: CommunicationAttribution,
): string[] {
  return attribution.rawTimestamp && !attribution.timestamp ? [`${source}: invalid timestamp`] : [];
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalize = (values: string[]): string[] => values.map((value) => value.trim().toLowerCase()).sort();
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}
