import { createHash } from 'node:crypto';

export const INTAKE_SCHEMA_VERSION = 't2c.intake-envelope/v1' as const;
export const COMMAND_SCHEMA_VERSION = 't2c.intake-command/v1' as const;
export const QUERY_SCHEMA_VERSION = 't2c.intake-query/v1' as const;
export const RESULT_SCHEMA_VERSION = 't2c.intake-result/v1' as const;
export const REGISTRY_SCHEMA_VERSION = 't2c.participant-registry/v2' as const;

export type GovernanceRole = 'manager' | 'user' | 'dev';
export type ParticipantKind = 'human' | 'agent';
export type IntakeCapability =
  | 'assign_participant'
  | 'assign_role'
  | 'capture_own_message'
  | 'rebuild_projection'
  | 'verify_event_stream';

export interface VerifiedPrincipal {
  provider: string;
  subject: string;
  verifiedAt: string;
}

export interface ParticipantV2 {
  id: string;
  kind: ParticipantKind;
  displayName: string;
  governanceRole: GovernanceRole | null;
  capabilities: IntakeCapability[];
  principals: VerifiedPrincipal[];
  ticketIds: string[];
}

export interface ParticipantRegistryV2 {
  schemaVersion: typeof REGISTRY_SCHEMA_VERSION;
  version: number;
  participants: ParticipantV2[];
}

export type IntakeCommand =
  | { schemaVersion: typeof COMMAND_SCHEMA_VERSION; type: 'RegisterParticipant'; participant: ParticipantV2 }
  | { schemaVersion: typeof COMMAND_SCHEMA_VERSION; type: 'BindExternalIdentity'; participantId: string; principal: VerifiedPrincipal }
  | { schemaVersion: typeof COMMAND_SCHEMA_VERSION; type: 'AssignRole'; participantId: string; governanceRole: GovernanceRole; ticketIds: string[]; capabilities: IntakeCapability[] }
  | { schemaVersion: typeof COMMAND_SCHEMA_VERSION; type: 'CaptureMessage'; participantId: string; governanceRole: GovernanceRole; ticketId: string; message: string }
  | { schemaVersion: typeof COMMAND_SCHEMA_VERSION; type: 'RebuildProjection'; participantId: string; ticketId: string }
  | { schemaVersion: typeof COMMAND_SCHEMA_VERSION; type: 'VerifyEventStream' };

export type IntakeQuery =
  | { schemaVersion: typeof QUERY_SCHEMA_VERSION; type: 'ResolveParticipant'; principal: string }
  | { schemaVersion: typeof QUERY_SCHEMA_VERSION; type: 'GetRole'; participantId: string }
  | { schemaVersion: typeof QUERY_SCHEMA_VERSION; type: 'GetTicketConversation'; ticketId: string }
  | { schemaVersion: typeof QUERY_SCHEMA_VERSION; type: 'GetCommandStatus'; idempotencyKey: string }
  | { schemaVersion: typeof QUERY_SCHEMA_VERSION; type: 'ValidateProjection'; participantId: string; ticketId: string };

export interface IntakeEnvelope<T extends IntakeCommand | IntakeQuery = IntakeCommand | IntakeQuery> {
  schemaVersion: typeof INTAKE_SCHEMA_VERSION;
  messageId: string;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  authenticatedPrincipal: string;
  expectedVersion: number | null;
  timestamp: string;
  payloadHash: string;
  payload: T;
  unknownFields?: string[];
}

export type IntakeDiagnosticCode =
  | 'T2C-INTAKE-UNKNOWN-ACTOR'
  | 'T2C-INTAKE-UNVERIFIED-ACTOR'
  | 'T2C-INTAKE-ROLE-MISMATCH'
  | 'T2C-INTAKE-UNAUTHORIZED'
  | 'T2C-INTAKE-FILENAME-MISMATCH'
  | 'T2C-INTAKE-VERSION-CONFLICT'
  | 'T2C-INTAKE-DUPLICATE'
  | 'T2C-INTAKE-BROKEN-CHAIN'
  | 'T2C-INTAKE-INVALID-SCHEMA'
  | 'T2C-INTAKE-INVALID-WIRE'
  | 'T2C-INTAKE-SECRET-INPUT'
  | 'T2C-INTAKE-UNSAFE-PATH'
  | 'T2C-INTAKE-PROJECTION-DRIFT'
  | 'T2C-INTAKE-STORAGE-FAILURE';

export interface IntakeDiagnostic {
  schemaVersion: 't2c.intake-diagnostic/v1';
  code: IntakeDiagnosticCode;
  message: string;
  remediation: string;
  retryable: boolean;
}

export interface IntakeResult {
  schemaVersion: typeof RESULT_SCHEMA_VERSION;
  accepted: boolean;
  messageId: string;
  correlationId: string;
  causationId: string | null;
  authenticatedPrincipal: string;
  aggregateId: 'intake';
  expectedVersion: number | null;
  actualVersion: number;
  idempotencyKey: string;
  timestamp: string;
  payloadHash: string;
  diagnostic: IntakeDiagnostic | null;
  data: unknown;
}

export class IntakeError extends Error {
  constructor(
    readonly code: IntakeDiagnosticCode,
    message: string,
    readonly remediation: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export function payloadHash(payload: IntakeCommand | IntakeQuery): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function assertIntakeEnvelope(value: unknown, operation: 'command' | 'query'): asserts value is IntakeEnvelope {
  const envelope = strictObject(value, [
    'schemaVersion', 'messageId', 'correlationId', 'causationId', 'idempotencyKey',
    'authenticatedPrincipal', 'expectedVersion', 'timestamp', 'payloadHash', 'payload', 'unknownFields',
  ], 'Envelope', ['unknownFields']);
  validateIntakeEnvelopeHeader(envelope);
  validateIntakeEnvelopeTimestamp(envelope.timestamp);
  if (operation === 'command') {
    assertCommand(envelope.payload);
  } else {
    assertQuery(envelope.payload);
  }
  if (payloadHash(envelope.payload as IntakeCommand | IntakeQuery) !== envelope.payloadHash) {
    invalid('Envelope payloadHash does not match payload');
  }
}

function validateIntakeEnvelopeHeader(envelope: Record<string, unknown>): void {
  if (envelope.schemaVersion !== INTAKE_SCHEMA_VERSION) invalid('Unsupported envelope schemaVersion');
  for (const key of ['messageId', 'correlationId', 'idempotencyKey', 'authenticatedPrincipal', 'payloadHash'] as const) {
    if (typeof envelope[key] !== 'string' || !envelope[key].trim()) invalid(`Envelope ${key} must be a non-blank string`);
  }
  if (envelope.causationId !== null && typeof envelope.causationId !== 'string') invalid('Envelope causationId must be a string or null');
  if (envelope.expectedVersion !== null
    && (!Number.isSafeInteger(envelope.expectedVersion) || (envelope.expectedVersion as number) < 0)) {
    invalid('Envelope expectedVersion must be a non-negative integer or null');
  }
  if (!/^[a-f0-9]{64}$/.test(envelope.payloadHash as string)) invalid('Envelope payloadHash must be lowercase SHA-256');
  if (envelope.unknownFields !== undefined
    && (!Array.isArray(envelope.unknownFields) || !envelope.unknownFields.every((item) => typeof item === 'string'))) {
    invalid('Envelope unknownFields must contain base64 strings');
  }
}

function validateIntakeEnvelopeTimestamp(timestamp: unknown): void {
  if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) {
    invalid('Envelope timestamp must be ISO 8601');
  }
}

export function assertCommand(value: unknown): asserts value is IntakeCommand {
  const base = strictObject(value, ['schemaVersion', 'type', ...commandFields(value)], 'Command');
  if (base.schemaVersion !== COMMAND_SCHEMA_VERSION) invalid('Unsupported command schemaVersion');
  validateCommandPayload(base as Record<string, unknown> & { schemaVersion: string; type: string });
}

function validateCommandPayload(
  base: Record<string, unknown> & { schemaVersion: string; type: string },
): void {
  switch (base.type) {
    case 'RegisterParticipant':
      assertParticipant(base.participant);
      break;
    case 'BindExternalIdentity':
      participantId(base.participantId);
      assertPrincipal(base.principal);
      break;
    case 'AssignRole':
      participantId(base.participantId);
      role(base.governanceRole);
      stringArray(base.ticketIds, 'ticketIds');
      capabilities(base.capabilities);
      break;
    case 'CaptureMessage':
      participantId(base.participantId);
      role(base.governanceRole);
      ticketId(base.ticketId);
      if (typeof base.message !== 'string' || !base.message.trim()) {
        invalid('CaptureMessage message must be non-blank');
      }
      if (Buffer.byteLength(base.message) > 256 * 1024) {
        invalid('CaptureMessage message exceeds 262144 bytes');
      }
      break;
    case 'RebuildProjection':
      participantId(base.participantId);
      ticketId(base.ticketId);
      break;
    case 'VerifyEventStream':
      break;
    default:
      invalid('Unsupported command type');
  }
}

export function assertQuery(value: unknown): asserts value is IntakeQuery {
  const base = strictObject(value, ['schemaVersion', 'type', ...queryFields(value)], 'Query');
  if (base.schemaVersion !== QUERY_SCHEMA_VERSION) invalid('Unsupported query schemaVersion');
  validateQueryPayload(base as Record<string, unknown> & { schemaVersion: string; type: string });
}

function validateQueryPayload(
  base: Record<string, unknown> & { schemaVersion: string; type: string },
): void {
  switch (base.type) {
    case 'ResolveParticipant':
      nonBlank(base.principal, 'principal');
      break;
    case 'GetRole':
      participantId(base.participantId);
      break;
    case 'GetTicketConversation':
      ticketId(base.ticketId);
      break;
    case 'GetCommandStatus':
      nonBlank(base.idempotencyKey, 'idempotencyKey');
      break;
    case 'ValidateProjection':
      participantId(base.participantId);
      ticketId(base.ticketId);
      break;
    default:
      invalid('Unsupported query type');
  }
}

export function assertParticipant(value: unknown): asserts value is ParticipantV2 {
  const entry = strictObject(value, ['id', 'kind', 'displayName', 'governanceRole', 'capabilities', 'principals', 'ticketIds'], 'Participant');
  participantId(entry.id);
  if (entry.kind !== 'human' && entry.kind !== 'agent') invalid('Participant kind must be human or agent');
  if (!(entry.id as string).startsWith(`${entry.kind}:`)) invalid('Participant kind must match ID prefix');
  nonBlank(entry.displayName, 'displayName');
  if (entry.kind === 'human') role(entry.governanceRole);
  else if (entry.governanceRole !== null) invalid('Agent governanceRole must be null');
  capabilities(entry.capabilities);
  if (!Array.isArray(entry.principals)) invalid('Participant principals must be an array');
  entry.principals.forEach(assertPrincipal);
  stringArray(entry.ticketIds, 'ticketIds');
  (entry.ticketIds as unknown[]).forEach(ticketId);
  if (entry.kind === 'agent' && (entry.capabilities as unknown[]).includes('capture_own_message')) invalid('Agent cannot capture a human projection');
}

export function principalKey(principal: VerifiedPrincipal): string {
  return `${principal.provider.trim().toLowerCase()}:${principal.subject.trim()}`;
}

function assertPrincipal(value: unknown): asserts value is VerifiedPrincipal {
  const principal = strictObject(value, ['provider', 'subject', 'verifiedAt'], 'Principal');
  nonBlank(principal.provider, 'principal.provider');
  nonBlank(principal.subject, 'principal.subject');
  if (typeof principal.verifiedAt !== 'string' || !Number.isFinite(Date.parse(principal.verifiedAt))) invalid('principal.verifiedAt must be ISO 8601');
}

function commandFields(value: unknown): string[] {
  const type = value && typeof value === 'object' ? (value as Record<string, unknown>).type : null;
  const fields: Record<string, string[]> = {
    RegisterParticipant: ['participant'], BindExternalIdentity: ['participantId', 'principal'],
    AssignRole: ['participantId', 'governanceRole', 'ticketIds', 'capabilities'],
    CaptureMessage: ['participantId', 'governanceRole', 'ticketId', 'message'],
    RebuildProjection: ['participantId', 'ticketId'], VerifyEventStream: [],
  };
  return typeof type === 'string' ? fields[type] ?? [] : [];
}

function queryFields(value: unknown): string[] {
  const type = value && typeof value === 'object' ? (value as Record<string, unknown>).type : null;
  const fields: Record<string, string[]> = {
    ResolveParticipant: ['principal'], GetRole: ['participantId'], GetTicketConversation: ['ticketId'],
    GetCommandStatus: ['idempotencyKey'], ValidateProjection: ['participantId', 'ticketId'],
  };
  return typeof type === 'string' ? fields[type] ?? [] : [];
}

function strictObject(value: unknown, keys: string[], label: string, optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} must be an object`);
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  const extra = Object.keys(record).filter((key) => !allowed.has(key));
  const missing = keys.filter((key) => !optional.includes(key) && !(key in record));
  if (missing.length) invalid(`${label} is missing: ${missing.join(', ')}`);
  if (extra.length) invalid(`${label} has unsupported fields: ${extra.join(', ')}`);
  return record;
}

function participantId(value: unknown): void {
  if (typeof value !== 'string' || !/^(human|agent):[a-z0-9][a-z0-9._-]*$/.test(value)) invalid('participantId must be canonical');
}
function ticketId(value: unknown): void {
  if (typeof value !== 'string' || !/^ticket-[0-9]{3,}$/.test(value)) invalid('ticketId must match ticket-NNN');
}
function role(value: unknown): void {
  if (value !== 'manager' && value !== 'user' && value !== 'dev') invalid('governanceRole must be manager, user or dev');
}
function nonBlank(value: unknown, name: string): void {
  if (typeof value !== 'string' || !value.trim()) invalid(`${name} must be a non-blank string`);
}
function stringArray(value: unknown, name: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim()) || new Set(value).size !== value.length) invalid(`${name} must contain unique non-blank strings`);
}
function capabilities(value: unknown): void {
  const allowed = new Set<IntakeCapability>(['assign_participant', 'assign_role', 'capture_own_message', 'rebuild_projection', 'verify_event_stream']);
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !allowed.has(item as IntakeCapability)) || new Set(value).size !== value.length) invalid('capabilities contains an unsupported or duplicate value');
}
function invalid(message: string): never {
  throw new IntakeError('T2C-INTAKE-INVALID-SCHEMA', message, 'Use the published strict v1 schema and remove unknown fields.');
}

export function diagnostic(error: unknown): IntakeDiagnostic {
  const known = error instanceof IntakeError
    ? error
    : new IntakeError('T2C-INTAKE-STORAGE-FAILURE', error instanceof Error ? error.message : String(error), 'Inspect storage permissions and retry.', true);
  return { schemaVersion: 't2c.intake-diagnostic/v1', code: known.code, message: known.message, remediation: known.remediation, retryable: known.retryable };
}
