import path from 'node:path';
import { pathExists, readText } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';
import { assertParticipant, principalKey, type ParticipantV2 } from './intake-contract.js';

export interface ParticipantIdentityEntry {
  id: string;
  role: 'human' | 'agent';
  displayName: string;
  gitAuthors: string[];
  a2aAgentIds: string[];
  humanAliases: string[];
  governanceRole?: 'manager' | 'user' | 'dev' | null;
  capabilities?: string[];
  ticketIds?: string[];
}

export interface ParticipantIdentityRegistry {
  schemaVersion: 't2c.participant-registry/v1';
  participants: ParticipantIdentityEntry[];
}

export interface LoadedParticipantIdentityRegistry {
  path: string;
  registry: ParticipantIdentityRegistry;
  byId: Map<string, ParticipantIdentityEntry>;
}

export async function loadParticipantIdentityRegistry(
  root: string,
  projectRoot: string,
  maxBytes: number,
  allowOutsideRoot = false,
): Promise<LoadedParticipantIdentityRegistry | null> {
  const v2Path = await assertPathWithinRoot(root, path.resolve(projectRoot, 'participants.v2.json'), allowOutsideRoot);
  const v1Path = await assertPathWithinRoot(root, path.resolve(projectRoot, 'participants.json'), allowOutsideRoot);
  const registryPath = await pathExists(v2Path) ? v2Path : v1Path;
  if (!(await pathExists(registryPath))) return null;
  let value: unknown;
  try {
    value = JSON.parse(await readText(registryPath, maxBytes)) as unknown;
  } catch (error) {
    throw new Error(`Invalid participant identity registry ${registryPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const normalized = normalizeParticipantIdentityRegistry(value);
  return {
    path: registryPath,
    registry: normalized,
    byId: new Map(normalized.participants.map((entry) => [entry.id, entry])),
  };
}

function normalizeParticipantIdentityRegistry(value: unknown): ParticipantIdentityRegistry {
  if (value && typeof value === 'object' && !Array.isArray(value)
    && (value as Record<string, unknown>).schemaVersion === 't2c.participant-registry/v2') {
    const registry = value as Record<string, unknown>;
    exactKeys(registry, ['schemaVersion', 'version', 'participants'], 'Participant registry v2');
    if (!Number.isSafeInteger(registry.version) || (registry.version as number) < 0 || !Array.isArray(registry.participants)) {
      throw new Error('Participant registry v2 version/participants are invalid');
    }
    const participants = registry.participants.map((raw) => normalizeV2Entry(raw));
    const normalized: ParticipantIdentityRegistry = { schemaVersion: 't2c.participant-registry/v1', participants };
    const ids = new Set<string>();
    const principals = new Set<string>();
    for (const [index, raw] of registry.participants.entries()) {
      assertParticipant(raw);
      if (ids.has(raw.id)) throw new Error(`Duplicate participant registry id: ${raw.id}`);
      ids.add(raw.id);
      for (const principal of raw.principals) {
        const key = principalKey(principal);
        if (principals.has(key)) throw new Error(`Duplicate verified principal at participant index ${index}: ${key}`);
        principals.add(key);
      }
    }
    return normalized;
  }
  assertParticipantIdentityRegistry(value);
  return value;
}

function normalizeV2Entry(raw: unknown): ParticipantIdentityEntry {
  assertParticipant(raw);
  const entry: ParticipantV2 = raw;
  const principals = entry.principals.map((principal) => ({ provider: principal.provider.toLowerCase(), subject: principal.subject }));
  const kind = entry.kind;
  return {
    id: entry.id, role: kind, displayName: entry.displayName,
    gitAuthors: principals.filter((item) => item.provider === 'git').map((item) => item.subject),
    a2aAgentIds: kind === 'agent' ? principals.filter((item) => item.provider === 'a2a').map((item) => item.subject) : [],
    humanAliases: kind === 'human' ? principals.filter((item) => item.provider !== 'git').map((item) => item.subject) : [],
    governanceRole: entry.governanceRole,
    capabilities: [...entry.capabilities],
    ticketIds: [...entry.ticketIds],
  };
}

export function assertParticipantIdentityRegistry(value: unknown): asserts value is ParticipantIdentityRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Participant registry must be an object');
  const registry = value as Record<string, unknown>;
  exactKeys(registry, ['schemaVersion', 'participants'], 'Participant registry');
  if (registry.schemaVersion !== 't2c.participant-registry/v1') throw new Error('Unsupported participant registry schemaVersion');
  if (!Array.isArray(registry.participants)) throw new Error('Participant registry participants must be an array');
  const ids = new Set<string>();
  const external = new Map<string, string>();
  for (const raw of registry.participants) {
    validateIdentityEntry(raw, ids, external);
  }
}

function validateIdentityEntry(
  raw: unknown,
  ids: Set<string>,
  external: Map<string, string>,
): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Participant registry entry must be an object');
  const entry = raw as Record<string, unknown>;
  exactKeys(entry, ['id', 'role', 'displayName', 'gitAuthors', 'a2aAgentIds', 'humanAliases'], 'Participant registry entry');
  if (typeof entry.id !== 'string' || !/^(human|agent):[a-z0-9][a-z0-9._-]*$/.test(entry.id)) {
    throw new Error('Participant registry id must be canonical human:<id> or agent:<id>');
  }
  if (entry.role !== 'human' && entry.role !== 'agent') throw new Error(`Participant ${entry.id} role must be human or agent`);
  if (!entry.id.startsWith(`${entry.role}:`)) throw new Error(`Participant ${entry.id} role does not match its stable ID prefix`);
  if (typeof entry.displayName !== 'string' || !entry.displayName.trim()) throw new Error(`Participant ${entry.id} displayName must be non-blank`);
  if (ids.has(entry.id)) throw new Error(`Duplicate participant registry id: ${entry.id}`);
  ids.add(entry.id);
  validateExternalIdentifiers(entry, external);
  validateRoleIdentifiers(entry);
}

function validateExternalIdentifiers(entry: Record<string, unknown>, external: Map<string, string>): void {
  for (const field of ['gitAuthors', 'a2aAgentIds', 'humanAliases'] as const) {
    const values = entry[field];
    if (!Array.isArray(values) || values.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error(`Participant ${entry.id} ${field} must contain non-blank strings`);
    }
    const normalized = values.map((item) => (item as string).trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) throw new Error(`Participant ${entry.id} ${field} must be unique`);
    for (const identifier of normalized) {
      const key = `${field}:${identifier}`;
      const owner = external.get(key);
      if (owner && owner !== entry.id) throw new Error(`${field} identifier ${identifier} is assigned to both ${owner} and ${entry.id}`);
      external.set(key, entry.id as string);
    }
  }
}

function validateRoleIdentifiers(entry: Record<string, unknown>): void {
  if (entry.role === 'human' && (entry.a2aAgentIds as unknown[]).length) {
    throw new Error(`Human participant ${entry.id} cannot declare a2aAgentIds`);
  }
  if (entry.role === 'agent' && (entry.humanAliases as unknown[]).length) {
    throw new Error(`Agent participant ${entry.id} cannot declare humanAliases`);
  }
}

function exactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
  const allowed = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length) throw new Error(`${label} is missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`${label} has unsupported fields: ${extra.join(', ')}`);
}
