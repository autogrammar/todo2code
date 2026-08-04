import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
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
import type { EpistemicClass, IntentRecord, LifecycleStatus } from '../core/types.js';
import { buildRecord } from '../core/record.js';
import type { ParticipantIdentityEntry } from '../communication/identity.js';
import { classifyAction } from '../tf/classifier.js';
import { relativePosix } from '../core/io.js';

export type CommunicationRole = 'human' | 'agent' | 'unknown';
export type CommunicationType = 'request' | 'plan' | 'decision' | 'message' | 'report' | 'result' | 'claim';

export interface CommunicationEnvelope {
  body: string;
  bodyStartLine: number;
  metadata: Record<string, string>;
}

export interface InferredCommunicationIdentity {
  role: string | null;
  participant: string | null;
  type: string | null;
  governanceParticipantFile: boolean;
}

export interface CommunicationSegment {
  text: string;
  line: number;
  type: CommunicationType;
}

export async function buildCommunicationRecords(
  root: string,
  file: string,
  role: CommunicationRole,
  ticket: string,
  participant: string,
  identity: { entry: ParticipantIdentityEntry | null },
  recipient: string | null,
  timestamp: string | null,
  explicitPaths: string[],
  explicitSymbols: string[],
  gitAuthors: string[],
  displayName: string,
  segments: CommunicationSegment[],
  config: T2CConfig,
  bodyStartLine: number,
  hasIdentityRegistry: boolean,
  participantRegistryPath: string | null,
): Promise<IntentRecord[]> {
  const records: IntentRecord[] = [];
  for (const segment of segments) {
    const segmentType = segment.type;
    const semantics = semanticsFor(segmentType, role);
    const classified = await classifyAction(segment.text, config);
    const action = segmentType === 'decision' && classified.action === 'unknown' ? 'approve' : classified.action;
    const line = bodyStartLine + segment.line - 1;
    const segmentTickets = [...new Set([ticket.toUpperCase(), ...extractTickets(segment.text)])];
    const symbols = [...new Set([...explicitSymbols, ...extractSymbols(segment.text)])]
      .filter((symbol) => !segmentTickets.some((item) => item === symbol.toUpperCase() || item.startsWith(`${symbol.toUpperCase()}-`)));

    records.push(buildRecord({
      kind: `communication_${segmentType}`,
      actor: participant,
      action,
      subject: recipient ? `to:${recipient}` : `ticket:${ticket}`,
      object: inferObject(segment.text, action),
      target: {
        paths: [...new Set([...explicitPaths, ...extractPaths(segment.text)])],
        symbols,
        tickets: segmentTickets,
        versions: extractVersions(segment.text),
      },
      modality: segmentType === 'report' || segmentType === 'result' || segmentType === 'claim'
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
        messageType: segmentType,
        ticket,
        recipient,
        gitAuthors,
        a2aAgentIds: identity.entry?.a2aAgentIds ?? [],
        humanAliases: identity.entry?.humanAliases ?? [],
        identityResolved: hasIdentityRegistry ? Boolean(identity.entry) : role !== 'unknown' && !participant.startsWith('unknown:'),
        identitySource: identity.entry ? 'registry' : hasIdentityRegistry ? 'unresolved' : 'legacy',
        participantRegistry: participantRegistryPath,
        llmUsed: false,
      },
    }));
  }
  return records;
}

export function parseEnvelope(value: string): CommunicationEnvelope {
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

export function inferIdentity(relativePath: string): InferredCommunicationIdentity {
  const parts = relativePath.split('/');
  const basename = path.basename(relativePath, path.extname(relativePath));
  const governanceIdentity = inferGovernanceIdentityFromFilename(basename);
  if (governanceIdentity) return governanceIdentity;

  return inferIdentityFromPathAndFilename(parts, basename);
}

function inferGovernanceIdentityFromFilename(basename: string): InferredCommunicationIdentity | null {
  const governance = basename.match(/^(user|human|ai|agent)-(.+)$/i);
  if (!governance?.[1] || !governance[2] || /-logs$/i.test(governance[2])) return null;
  const role = /^(user|human)$/i.test(governance[1]) ? 'human' : 'agent';
  return {
    role,
    participant: governance[2].toLowerCase(),
    type: role === 'human' ? 'request' : 'plan',
    governanceParticipantFile: true,
  };
}

function inferIdentityFromPathAndFilename(parts: string[], basename: string): InferredCommunicationIdentity {
  const fileParts = basename.split('.');
  const nestedRoleIndex = parts.findIndex((part) => /^(agents?|humans?|users?)$/i.test(part));
  const nestedRole = nestedRoleIndex >= 0 ? parts[nestedRoleIndex] ?? null : null;
  const nestedParticipant = nestedRoleIndex >= 0 ? parts[nestedRoleIndex + 1] ?? null : null;
  const filenameRole = /^(agent|human|user)$/i.test(fileParts[0] ?? '') ? fileParts[0] ?? null : null;
  return {
    role: filenameRole ?? nestedRole,
    participant: filenameRole ? fileParts[1] ?? null : nestedParticipant,
    type: filenameRole ? fileParts[2] ?? null : fileParts.find((part) => isCommunicationType(part)) ?? null,
    governanceParticipantFile: false,
  };
}

export function isTicketEvidenceFile(relativePath: string): boolean {
  const basename = path.basename(relativePath).toLowerCase();
  return [
    'readme.md',
    'preprompt.md',
    'changelog.md',
    'audit.md',
    'baseline.md',
    'logs.txt',
  ].includes(basename)
    || /^iteration-\d+(?:-[a-z0-9-]+)?\.md$/.test(basename)
    || /^(?:ai|agent)-.+-logs\.txt$/.test(basename);
}

export function communicationSegments(
  body: string,
  defaultType: CommunicationType,
  governanceRole: CommunicationRole | null,
): CommunicationSegment[] {
  if (!governanceRole || governanceRole === 'unknown') {
    return splitIntentLines(body)
      .filter((segment) => !isCommunicationNoise(segment.text))
      .map((segment) => ({ ...segment, type: defaultType }));
  }
  const output: CommunicationSegment[] = [];
  const lines = body.split(/\r?\n/);
  let sectionType: CommunicationType | null = null;
  let pending: { text: string; line: number; type: CommunicationType } | null = null;
  const flush = (): void => {
    if (!pending) return;
    const item = pending;
    pending = null;
    if (/^(?:none|brak)[.!]?$/i.test(item.text.trim())) return;
    for (const segment of splitIntentLines(item.text)) {
      if (isCommunicationNoise(segment.text)) continue;
      output.push({ text: segment.text, line: item.line + segment.line - 1, type: item.type });
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const heading = raw.match(/^\s{0,3}#{2,6}\s+(.+?)\s*$/)?.[1];
    if (heading) {
      flush();
      sectionType = governanceSectionType(heading, governanceRole);
      continue;
    }
    if (!sectionType) {
      flush();
      continue;
    }
    if (!raw.trim()) {
      flush();
      continue;
    }
    const startsListItem = /^\s*(?:[-*+]|\d+[.)]|\[[ xX]\])\s+/.test(raw);
    if (startsListItem) flush();
    const cleaned = raw
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/^\s*\[[ xX]\]\s+/, '')
      .trim();
    if (!cleaned) continue;
    if (pending) pending.text = `${pending.text} ${cleaned}`;
    else pending = { text: cleaned, line: index + 1, type: sectionType };
  }
  flush();
  return output;
}

export function looksLikeTicket(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*-\d+(?:[-_][A-Za-z0-9]+)*$/.test(value);
}

export function normalizeRole(value: string | null): CommunicationRole {
  if (/^agents?$/i.test(value ?? '')) return 'agent';
  if (/^(human|humans|user|users|person)$/i.test(value ?? '')) return 'human';
  return 'unknown';
}

export function normalizeType(value: string | null): CommunicationType {
  const normalized = value?.toLowerCase();
  return isCommunicationType(normalized ?? '') ? normalized as CommunicationType : 'message';
}

export function isCommunicationType(value: string): boolean {
  return ['request', 'plan', 'decision', 'message', 'report', 'result', 'claim'].includes(value.toLowerCase());
}

export function first(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? null;
}

export function listValue(value: string | null): string[] {
  if (!value) return [];
  const stripped = value.replace(/^\[|\]$/g, '');
  return [...new Set(stripped.split(',').map((item) => unquote(item.trim())).filter(Boolean))].sort();
}

export function validTimestamp(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

export function resolveIdentity(
  byId: Map<string, ParticipantIdentityEntry> | null,
  participantId: string | null,
): { entry: ParticipantIdentityEntry | null } {
  if (!byId || !participantId) return { entry: null };
  // Stable IDs are canonical and exact. Display names and aliases are never
  // searched here, so a similar-looking name cannot acquire another identity.
  return { entry: byId.get(participantId) ?? null };
}

export function sameStrings(left: string[], right: string[]): boolean {
  const normalize = (values: string[]): string[] => values.map((value) => value.trim().toLowerCase()).sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function isCommunicationNoise(value: string): boolean {
  const normalized = value.trim();
  return /^#{1,6}\s*\d+(?:[.):_-]\d+)*[.):_-]?\s*$/.test(normalized)
    || /^(?:-{3,}|_{3,}|\*{3,})$/.test(normalized);
}

function governanceSectionType(heading: string, role: Exclude<CommunicationRole, 'unknown'>): CommunicationType | null {
  const normalized = heading.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, ' ').trim();
  if (role === 'human') {
    if (/\b(decision|decisions|decyzj|approval|zatwierdzen)/i.test(normalized)) return 'decision';
    if (/\b(instruction|instructions|request|requirements?|goal|scope|polecen|wymagan|zakres|cel)\b/i.test(normalized)) {
      return 'request';
    }
    return null;
  }
  if (/\b(actual changes?|result|results|report|unfinished|blockers?|wykonan|zmian|wynik|raport|blokad)\b/i.test(normalized)) {
    return 'report';
  }
  if (/\b(understanding|execution plan|plan|scope|guardrails?|risks?|hypotheses|code locations?|rozumien|zakres|ryzyk)\b/i.test(normalized)) {
    return 'plan';
  }
  if (/\b(approval|zatwierdzen)\b/i.test(normalized)) return 'claim';
  return null;
}

function semanticsFor(type: CommunicationType, role: CommunicationRole): { lifecycle: LifecycleStatus; epistemicClass: EpistemicClass } {
  if (type === 'plan') return { lifecycle: 'planned', epistemicClass: 'plan' };
  if (type === 'report' || type === 'result' || type === 'claim') return { lifecycle: 'implemented', epistemicClass: 'claim' };
  if (type === 'decision') return { lifecycle: 'completed', epistemicClass: 'declaration' };
  return { lifecycle: 'proposed', epistemicClass: role === 'agent' ? 'claim' : 'declaration' };
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}
