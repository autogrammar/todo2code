import path from 'node:path';
import { pathExists, readText } from '../core/io.js';
import { assertPathWithinRoot } from '../core/security.js';

export interface ParticipantIdentityEntry {
  id: string;
  role: 'human' | 'agent';
  displayName: string;
  gitAuthors: string[];
  a2aAgentIds: string[];
  humanAliases: string[];
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
  const registryPath = await assertPathWithinRoot(
    root,
    path.resolve(projectRoot, 'participants.json'),
    allowOutsideRoot,
  );
  if (!(await pathExists(registryPath))) return null;
  let value: unknown;
  try {
    value = JSON.parse(await readText(registryPath, maxBytes)) as unknown;
  } catch (error) {
    throw new Error(`Invalid participant identity registry ${registryPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertParticipantIdentityRegistry(value);
  return {
    path: registryPath,
    registry: value,
    byId: new Map(value.participants.map((entry) => [entry.id, entry])),
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
        external.set(key, entry.id);
      }
    }
    if (entry.role === 'human' && (entry.a2aAgentIds as unknown[]).length) {
      throw new Error(`Human participant ${entry.id} cannot declare a2aAgentIds`);
    }
    if (entry.role === 'agent' && (entry.humanAliases as unknown[]).length) {
      throw new Error(`Agent participant ${entry.id} cannot declare humanAliases`);
    }
  }
}

function exactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
  const allowed = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length) throw new Error(`${label} is missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`${label} has unsupported fields: ${extra.join(', ')}`);
}
