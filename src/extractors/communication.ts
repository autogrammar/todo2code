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
import type { EpistemicClass, ExtractionResult, JsonValue, LifecycleStatus } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';
import {
  loadParticipantIdentityRegistry,
  type LoadedParticipantIdentityRegistry,
  type ParticipantIdentityEntry,
} from '../communication/identity.js';

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
  malformed: boolean;
}

interface InferredCommunicationIdentity {
  role: string | null;
  participant: string | null;
  type: string | null;
  governanceParticipantFile: boolean;
}

interface CommunicationSegment {
  text: string;
  line: number;
  type: CommunicationType;
}

interface CommunicationCandidate {
  file: string;
  relativeToProject: string;
  pathTicket: string;
  envelope: CommunicationEnvelope;
  inferred: InferredCommunicationIdentity;
}

interface CommunicationAttribution {
  declaredParticipantId: string | null;
  entry: ParticipantIdentityEntry | null;
  participant: string;
  role: CommunicationRole;
  displayName: string;
  explicitMessageType: string | null;
  messageType: CommunicationType;
  ticket: string;
  recipient: string | null;
  rawTimestamp: string | null;
  timestamp: string | null;
  declaredGitAuthors: string[];
  gitAuthors: string[];
  declaredA2aAgentId: string | null;
  explicitPaths: string[];
  explicitSymbols: string[];
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
  inferred: InferredCommunicationIdentity,
  explicitEnvelope: boolean,
): boolean {
  if (explicitEnvelope) return false;
  if (isTicketEvidenceFile(relativeToProject)) return true;
  if (requestedTicket || hasIdentityRegistry || looksLikeTicket(pathTicket)) return false;
  return !inferred.role;
}

function hasExplicitCommunicationEnvelope(metadata: Record<string, string>): boolean {
  return Boolean(first(
    metadata.participant,
    metadata.participant_id,
    metadata['participant-id'],
    metadata.role,
    metadata.type,
    metadata.ticket,
  ));
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

function resolveAttribution(
  candidate: CommunicationCandidate,
  identityRegistry: LoadedParticipantIdentityRegistry | null,
): CommunicationAttribution {
  return {
    ...resolveParticipantAttribution(candidate, identityRegistry),
    ...resolveMessageAttribution(candidate),
    ...resolveTargetAttribution(candidate.envelope.metadata),
  };
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

function attributionWarnings(
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
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function parseEnvelope(value: string): CommunicationEnvelope {
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

function inferIdentity(relativePath: string): InferredCommunicationIdentity {
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

/**
 * Governance tickets contain specifications, raw logs and captured results
 * beside participant files. Those artifacts are evidence for the ticket, not
 * utterances by an anonymous participant. Explicit communication front matter
 * still wins, so a deliberately authored file with one of these names remains
 * available to callers.
 */
function isTicketEvidenceFile(relativePath: string): boolean {
  const basename = path.basename(relativePath).toLowerCase();
  return [
    'readme.md',
    'preprompt.md',
    'changelog.md',
    'audit.md',
    'baseline.md',
    'logs.txt',
  ].includes(basename)
    // Pipeline-selected task and TODO projections are already consumed by the
    // NL/Markdown extractors.  Treat conventional generated filenames as
    // evidence so they are not ingested a second time as an anonymous person.
    // Explicit communication front matter is checked before this classifier
    // and remains the deliberate opt-in for an evidence-like filename.
    || /(?:^|[._-])(?:task|todo)\.md$/.test(basename)
    || /^iteration-\d+(?:-[a-z0-9-]+)?\.md$/.test(basename)
    || /^(?:ai|agent)-.+-logs\.txt$/.test(basename);
}

/**
 * The governance-standard participant files are structured documents rather
 * than one homogeneous message. Heading ownership is deterministic:
 * instructions/decisions belong to the human, while an agent's plan and actual
 * changes remain different epistemic classes. Metadata and ownership boilerplate
 * are deliberately skipped.
 */
function communicationSegments(
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
  const jsonValues = jsonStringList(value);
  if (jsonValues) return [...new Set(jsonValues.map((item) => item.trim()).filter(Boolean))].sort();
  const stripped = value.replace(/^\[|\]$/g, '');
  return [...new Set(stripped.split(',').map((item) => unquote(item.trim())).filter(Boolean))].sort();
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

function validTimestamp(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}
