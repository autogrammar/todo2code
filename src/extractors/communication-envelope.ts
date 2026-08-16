import path from 'node:path';

import { splitIntentLines } from '../core/text.js';
import type {
  CommunicationRole,
  CommunicationSegment,
  CommunicationType,
  InferredCommunicationIdentity,
} from './communication-types.js';

export function parseEnvelope(value: string): import('./communication-types.js').CommunicationEnvelope {
  const lines = value.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { body: value, bodyStartLine: 1, metadata: {}, malformed: false };
  }
  const end = lines.slice(1).findIndex((line) => line.trim() === '---');
  if (end < 0) return { body: '', bodyStartLine: 1, metadata: {}, malformed: true };
  const metadata: Record<string, string> = {};
  for (const line of lines.slice(1, end + 1)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/);
    if (!match?.[1]) continue;
    metadata[match[1].toLowerCase()] = unquote(match[2] ?? '');
  }
  return {
    body: lines.slice(end + 2).join('\n'),
    bodyStartLine: end + 3,
    metadata,
    malformed: false,
  };
}

export function inferIdentity(relativePath: string): InferredCommunicationIdentity {
  const parts = relativePath.split('/');
  const basename = path.basename(relativePath, path.extname(relativePath));
  const governance = basename.match(/^(user|human|ai|agent)-(.+)$/i);
  if (governance?.[1] && governance[2] && !/-logs$/i.test(governance[2])) {
    const role = /^(user|human)$/i.test(governance[1]) ? 'human' : 'agent';
    return {
      role,
      participant: governance[2].toLowerCase(),
      type: role === 'human' ? 'request' : 'plan',
      governanceParticipantFile: true,
    };
  }
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
    || /(?:^|[._-])(?:task|todo)\.md$/.test(basename)
    || /^iteration-\d+(?:-[a-z0-9-]+)?\.md$/.test(basename)
    || /^(?:ai|agent)-.+-logs\.txt$/.test(basename);
}

export function hasExplicitCommunicationEnvelope(metadata: Record<string, string>): boolean {
  return Boolean(first(
    metadata.participant,
    metadata.participant_id,
    metadata['participant-id'],
    metadata.role,
    metadata.type,
    metadata.ticket,
  ));
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
  const jsonValues = jsonStringList(value);
  if (jsonValues) return [...new Set(jsonValues.map((item) => item.trim()).filter(Boolean))].sort();
  const stripped = value.replace(/^\[|\]$/g, '');
  return [...new Set(stripped.split(',').map((item) => unquote(item.trim())).filter(Boolean))].sort();
}

export function validTimestamp(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
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

function jsonStringList(value: string): string[] | null {
  if (!value.startsWith('[') || !value.endsWith(']')) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? parsed : null;
  } catch {
    return null;
  }
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}
