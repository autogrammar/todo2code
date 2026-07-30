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
  splitIntentLines,
} from '../core/text.js';
import type { EpistemicClass, ExtractionResult, LifecycleStatus } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';
import { loadParticipantIdentityRegistry, type ParticipantIdentityEntry } from '../communication/identity.js';

export type CommunicationRole = 'human' | 'agent' | 'unknown';
export type CommunicationType = 'request' | 'plan' | 'decision' | 'message' | 'report' | 'result' | 'claim';

export interface CommunicationExtractionOptions {
  root: string;
  projectDir?: string;
  ticket?: string | null;
}

interface CommunicationEnvelope {
  body: string;
  bodyStartLine: number;
  metadata: Record<string, string>;
}

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
    const relativeToProject = relativePosix(projectRoot, file);
    const parts = relativeToProject.split('/');
    const pathTicket = parts.length > 1 ? parts[0] ?? '' : '';
    if (!pathTicket) continue;
    if (options.ticket && pathTicket.toLowerCase() !== options.ticket.toLowerCase()) continue;

    let body: string;
    try {
      body = await readText(file, config.maxFileBytes);
    } catch (error) {
      warnings.push(`${relativeToProject}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const envelope = parseEnvelope(body);
    const inferred = inferIdentity(relativeToProject);
    const explicitEnvelope = Boolean(first(
      envelope.metadata.participant,
      envelope.metadata.participant_id,
      envelope.metadata['participant-id'],
      envelope.metadata.role,
      envelope.metadata.type,
      envelope.metadata.ticket,
    ));
    if (!options.ticket && !identityRegistry && !looksLikeTicket(pathTicket)
      && !inferred.role && !explicitEnvelope) continue;
    communicationFiles += 1;
    const declaredParticipant = first(envelope.metadata.participant, envelope.metadata.actor, inferred.participant);
    const declaredRole = normalizeRole(first(envelope.metadata.role, inferred.role));
    const declaredParticipantId = first(envelope.metadata.participant_id, envelope.metadata['participant-id']);
    const identity = resolveIdentity(identityRegistry?.byId ?? null, declaredParticipantId);
    const participant = identity.entry?.id ?? declaredParticipantId ?? declaredParticipant ?? `unknown:${path.basename(file)}`;
    const role = identity.entry?.role ?? declaredRole;
    const displayName = identity.entry?.displayName ?? declaredParticipant ?? participant;
    const messageType = normalizeType(first(envelope.metadata.type, envelope.metadata.kind, inferred.type));
    const ticket = first(envelope.metadata.ticket, pathTicket) ?? pathTicket;
    const recipient = first(envelope.metadata.recipient, envelope.metadata.to);
    const timestamp = validTimestamp(first(envelope.metadata.timestamp, envelope.metadata.created_at, envelope.metadata.createdat));
    const declaredGitAuthors = listValue(first(envelope.metadata.git_authors, envelope.metadata['git-authors'], envelope.metadata.git_author));
    const gitAuthors = identity.entry ? [...identity.entry.gitAuthors] : declaredGitAuthors;
    const declaredA2aAgentId = first(envelope.metadata.a2a_agent_id, envelope.metadata['a2a-agent-id']);
    const explicitPaths = listValue(first(envelope.metadata.paths, envelope.metadata.target_paths, envelope.metadata['target-paths']));
    const explicitSymbols = listValue(first(envelope.metadata.symbols, envelope.metadata.target_symbols, envelope.metadata['target-symbols']));

    if (role === 'unknown') warnings.push(`${relativeToProject}: role must be human or agent`);
    if (participant.startsWith('unknown:')) warnings.push(`${relativeToProject}: participant is missing`);
    if (identityRegistry && !declaredParticipantId) {
      warnings.push(`${relativeToProject}: participant-id is required when project/participants.json exists`);
    } else if (identityRegistry && !identity.entry) {
      warnings.push(`${relativeToProject}: participant-id is not present in project/participants.json`);
    }
    if (identity.entry && declaredRole !== 'unknown' && declaredRole !== identity.entry.role) {
      warnings.push(`${relativeToProject}: declared role conflicts with participant registry`);
    }
    if (identity.entry && declaredGitAuthors.length
      && !sameStrings(declaredGitAuthors, identity.entry.gitAuthors)) {
      warnings.push(`${relativeToProject}: git-authors differ from participant registry and were ignored`);
    }
    if (declaredA2aAgentId && (!identity.entry || !identity.entry.a2aAgentIds.includes(declaredA2aAgentId))) {
      warnings.push(`${relativeToProject}: a2a-agent-id is not assigned to participant-id in the registry`);
    }
    if (!timestamp && first(envelope.metadata.timestamp, envelope.metadata.created_at, envelope.metadata.createdat)) {
      warnings.push(`${relativeToProject}: invalid timestamp`);
    }

    const semantics = semanticsFor(messageType, role);
    for (const segment of splitIntentLines(envelope.body)) {
      const classified = await classifyAction(segment.text, config);
      const action = messageType === 'decision' && classified.action === 'unknown' ? 'approve' : classified.action;
      const line = envelope.bodyStartLine + segment.line - 1;
      const tickets = [...new Set([ticket.toUpperCase(), ...extractTickets(segment.text)])];
      const symbols = [...new Set([...explicitSymbols, ...extractSymbols(segment.text)])]
        .filter((symbol) => !tickets.some((item) => item === symbol.toUpperCase() || item.startsWith(`${symbol.toUpperCase()}-`)));
      records.push(buildRecord({
        kind: `communication_${messageType}`,
        actor: participant,
        action,
        subject: recipient ? `to:${recipient}` : `ticket:${ticket}`,
        object: inferObject(segment.text, action),
        target: {
          paths: [...new Set([...explicitPaths, ...extractPaths(segment.text)])],
          symbols,
          tickets,
          versions: extractVersions(segment.text),
        },
        modality: messageType === 'report' || messageType === 'result' || messageType === 'claim'
          ? 'claimed'
          : detectModality(segment.text),
        polarity: detectPolarity(segment.text),
        text: segment.text,
        lifecycle: semantics.lifecycle,
        sourceKind: 'agent_log',
        sourcePath: relativePosix(root, file),
        sourceLines: { start: line, end: line },
        extractor: 't2c/project-communication@1',
        epistemicClass: semantics.epistemicClass,
        confidence: role === 'unknown' || participant.startsWith('unknown:') ? 0.55 : 0.88,
        basis: ['project_ticket_path', 'communication_front_matter', classified.basis],
        observedAt: timestamp,
        metadata: {
          participant,
          participantId: identity.entry?.id ?? null,
          displayName,
          participantRole: role,
          messageType,
          ticket,
          recipient,
          gitAuthors,
          a2aAgentIds: identity.entry?.a2aAgentIds ?? [],
          humanAliases: identity.entry?.humanAliases ?? [],
          identityResolved: identityRegistry ? Boolean(identity.entry) : role !== 'unknown' && !participant.startsWith('unknown:'),
          identitySource: identity.entry ? 'registry' : identityRegistry ? 'unresolved' : 'legacy',
          participantRegistry: identityRegistry ? relativePosix(root, identityRegistry.path) : null,
          llmUsed: false,
        },
      }));
    }
  }

  if (records.length === 0 && communicationFiles > 0) warnings.push('No intent-like communication statements were found');
  return { records, warnings: [...new Set(warnings)].sort() };
}

function resolveIdentity(
  byId: Map<string, ParticipantIdentityEntry> | null,
  participantId: string | null,
): { entry: ParticipantIdentityEntry | null } {
  if (!byId || !participantId) return { entry: null };
  // Stable IDs are canonical and exact. Display names and aliases are never
  // searched here, so a similar-looking name cannot acquire another identity.
  return { entry: byId.get(participantId) ?? null };
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalize = (values: string[]): string[] => values.map((value) => value.trim().toLowerCase()).sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function parseEnvelope(value: string): CommunicationEnvelope {
  const lines = value.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { body: value, bodyStartLine: 1, metadata: {} };
  const end = lines.slice(1).findIndex((line) => line.trim() === '---');
  if (end < 0) return { body: value, bodyStartLine: 1, metadata: {} };
  const metadata: Record<string, string> = {};
  for (const line of lines.slice(1, end + 1)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/);
    if (!match?.[1]) continue;
    metadata[match[1].toLowerCase()] = unquote(match[2] ?? '');
  }
  return { body: lines.slice(end + 2).join('\n'), bodyStartLine: end + 3, metadata };
}

function inferIdentity(relativePath: string): { role: string | null; participant: string | null; type: string | null } {
  const parts = relativePath.split('/');
  const fileParts = path.basename(relativePath, path.extname(relativePath)).split('.');
  const nestedRoleIndex = parts.findIndex((part) => /^(agents?|humans?|users?)$/i.test(part));
  const nestedRole = nestedRoleIndex >= 0 ? parts[nestedRoleIndex] ?? null : null;
  const nestedParticipant = nestedRoleIndex >= 0 ? parts[nestedRoleIndex + 1] ?? null : null;
  const filenameRole = /^(agent|human|user)$/i.test(fileParts[0] ?? '') ? fileParts[0] ?? null : null;
  return {
    role: filenameRole ?? nestedRole,
    participant: filenameRole ? fileParts[1] ?? null : nestedParticipant,
    type: filenameRole ? fileParts[2] ?? null : fileParts.find((part) => isCommunicationType(part)) ?? null,
  };
}

function looksLikeTicket(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*-\d+(?:[-_][A-Za-z0-9]+)*$/.test(value);
}

function normalizeRole(value: string | null): CommunicationRole {
  if (/^agents?$/i.test(value ?? '')) return 'agent';
  if (/^(human|humans|user|users|person)$/i.test(value ?? '')) return 'human';
  return 'unknown';
}

function normalizeType(value: string | null): CommunicationType {
  const normalized = value?.toLowerCase();
  return isCommunicationType(normalized ?? '') ? normalized as CommunicationType : 'message';
}

function isCommunicationType(value: string): boolean {
  return ['request', 'plan', 'decision', 'message', 'report', 'result', 'claim'].includes(value.toLowerCase());
}

function semanticsFor(type: CommunicationType, role: CommunicationRole): { lifecycle: LifecycleStatus; epistemicClass: EpistemicClass } {
  if (type === 'plan') return { lifecycle: 'planned', epistemicClass: 'plan' };
  if (type === 'report' || type === 'result' || type === 'claim') return { lifecycle: 'implemented', epistemicClass: 'claim' };
  if (type === 'decision') return { lifecycle: 'completed', epistemicClass: 'declaration' };
  return { lifecycle: 'proposed', epistemicClass: role === 'agent' ? 'claim' : 'declaration' };
}

function first(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? null;
}

function listValue(value: string | null): string[] {
  if (!value) return [];
  const stripped = value.replace(/^\[|\]$/g, '');
  return [...new Set(stripped.split(',').map((item) => unquote(item.trim())).filter(Boolean))].sort();
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function validTimestamp(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}
