import { IntakeError, assertIntakeEnvelope, type IntakeEnvelope, type IntakeCommand, type IntakeQuery, type IntakeResult } from './intake-contract.js';

// Canonical wire envelope: 1=schema, 2=message, 3=correlation, 4=causation,
// 5=idempotency, 6=principal, 7=expected version, 8=timestamp,
// 9=payload hash, 10=canonical JSON payload. Only varint and bytes are used.
export function encodeIntakeEnvelope(envelope: IntakeEnvelope): Uint8Array {
  const operation = envelope.payload.schemaVersion === 't2c.intake-command/v1' ? 'command' : 'query';
  assertIntakeEnvelope(envelope, operation);
  const fields: Uint8Array[] = [
    bytesField(1, envelope.schemaVersion), bytesField(2, envelope.messageId), bytesField(3, envelope.correlationId),
    ...(envelope.causationId === null ? [] : [bytesField(4, envelope.causationId)]),
    bytesField(5, envelope.idempotencyKey), bytesField(6, envelope.authenticatedPrincipal),
    ...(envelope.expectedVersion === null ? [] : [varintField(7, envelope.expectedVersion)]),
    bytesField(8, envelope.timestamp), bytesField(9, envelope.payloadHash),
    bytesField(10, JSON.stringify(envelope.payload)),
    ...(envelope.unknownFields ?? []).map((raw) => Buffer.from(raw, 'base64')),
  ];
  return Buffer.concat(fields);
}

export function decodeIntakeEnvelope(bytes: Uint8Array, operation: 'command' | 'query'): IntakeEnvelope {
  try {
    const values = new Map<number, string | number>();
    const unknownFields: string[] = [];
    let offset = 0;
    while (offset < bytes.length) {
      const fieldStart = offset;
      const [tag, afterTag] = readVarint(bytes, offset); offset = afterTag;
      const number = tag >>> 3;
      const wire = tag & 7;
      if (wire === 0) {
        const [value, after] = readVarint(bytes, offset); offset = after;
        if (number === 7) values.set(number, value);
        else unknownFields.push(Buffer.from(bytes.slice(fieldStart, offset)).toString('base64'));
      } else if (wire === 2) {
        const [length, afterLength] = readVarint(bytes, offset); offset = afterLength;
        if (offset + length > bytes.length) throw new Error('Truncated length-delimited field');
        const raw = bytes.slice(offset, offset + length); offset += length;
        if (number >= 1 && number <= 10 && number !== 7) values.set(number, Buffer.from(raw).toString('utf8'));
        else unknownFields.push(Buffer.from(bytes.slice(fieldStart, offset)).toString('base64'));
      } else {
        throw new Error(`Unsupported wire type ${wire}`);
      }
    }
    const required = [1, 2, 3, 5, 6, 8, 9, 10];
    if (required.some((field) => !values.has(field))) throw new Error('Missing required envelope field');
    const payload = JSON.parse(String(values.get(10))) as IntakeCommand | IntakeQuery;
    const envelope: IntakeEnvelope = {
      schemaVersion: String(values.get(1)) as IntakeEnvelope['schemaVersion'], messageId: String(values.get(2)),
      correlationId: String(values.get(3)), causationId: values.has(4) ? String(values.get(4)) : null,
      idempotencyKey: String(values.get(5)), authenticatedPrincipal: String(values.get(6)),
      expectedVersion: values.has(7) ? Number(values.get(7)) : null, timestamp: String(values.get(8)),
      payloadHash: String(values.get(9)), payload, ...(unknownFields.length ? { unknownFields } : {}),
    };
    assertIntakeEnvelope(envelope, operation);
    return envelope;
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    throw new IntakeError('T2C-INTAKE-INVALID-WIRE', error instanceof Error ? error.message : String(error), 'Send a valid t2c.intake-envelope/v1 Protobuf payload.');
  }
}

export function encodeIntakeResult(result: IntakeResult): Uint8Array {
  return Buffer.concat([
    bytesField(1, result.schemaVersion), varintField(2, result.accepted ? 1 : 0), bytesField(3, result.messageId),
    bytesField(4, result.correlationId), ...(result.causationId === null ? [] : [bytesField(5, result.causationId)]),
    bytesField(6, result.authenticatedPrincipal), bytesField(7, result.aggregateId),
    ...(result.expectedVersion === null ? [] : [varintField(8, result.expectedVersion)]), varintField(9, result.actualVersion),
    bytesField(10, result.idempotencyKey), bytesField(11, result.timestamp), bytesField(12, result.payloadHash),
    ...(result.diagnostic === null ? [] : [bytesField(13, JSON.stringify(result.diagnostic))]),
    bytesField(14, JSON.stringify(result.data)),
  ]);
}

export function decodeIntakeResult(bytes: Uint8Array): IntakeResult {
  try {
    const fields = decodeResultFields(bytes);
    return intakeResultFromFields(fields.strings, fields.numbers);
  } catch (error) {
    throw new IntakeError('T2C-INTAKE-INVALID-WIRE', error instanceof Error ? error.message : String(error), 'Send a valid t2c.intake-result/v1 Protobuf payload.');
  }
}

function decodeResultFields(bytes: Uint8Array): {
  strings: Map<number, string>;
  numbers: Map<number, number>;
} {
  const strings = new Map<number, string>();
  const numbers = new Map<number, number>();
  let offset = 0;
  while (offset < bytes.length) {
    const [tag, afterTag] = readVarint(bytes, offset); offset = afterTag;
    const field = tag >>> 3; const wire = tag & 7;
    if (wire === 0) {
      const [value, after] = readVarint(bytes, offset); offset = after; numbers.set(field, value);
      continue;
    }
    if (wire !== 2) throw new Error(`Unsupported result wire type ${wire}`);
    const [length, afterLength] = readVarint(bytes, offset); offset = afterLength;
    if (offset + length > bytes.length) throw new Error('Truncated result field');
    strings.set(field, Buffer.from(bytes.slice(offset, offset + length)).toString('utf8'));
    offset += length;
  }
  return { strings, numbers };
}

function resultMessageFields(strings: Map<number, string>): {
  messageId: string;
  correlationId: string;
  causationId: string | null;
  authenticatedPrincipal: string;
} {
  return {
    messageId: strings.get(3) ?? '',
    correlationId: strings.get(4) ?? '',
    causationId: strings.get(5) ?? null,
    authenticatedPrincipal: strings.get(6) ?? '',
  };
}

function resultVersionFields(strings: Map<number, string>, numbers: Map<number, number>): {
  expectedVersion: number | null;
  actualVersion: number;
  idempotencyKey: string;
  timestamp: string;
  payloadHash: string;
} {
  return {
    expectedVersion: numbers.get(8) ?? null,
    actualVersion: numbers.get(9) ?? 0,
    idempotencyKey: strings.get(10) ?? '',
    timestamp: strings.get(11) ?? '',
    payloadHash: strings.get(12) ?? '',
  };
}

function intakeResultFromFields(strings: Map<number, string>, numbers: Map<number, number>): IntakeResult {
  return {
    schemaVersion: strings.get(1) as IntakeResult['schemaVersion'],
    accepted: numbers.get(2) === 1,
    ...resultMessageFields(strings),
    ...resultVersionFields(strings, numbers),
    aggregateId: 'intake',
    diagnostic: strings.has(13) ? JSON.parse(strings.get(13) as string) : null,
    data: strings.has(14) ? JSON.parse(strings.get(14) as string) : null,
  };
}

function bytesField(field: number, value: string): Uint8Array {
  const data = Buffer.from(value, 'utf8');
  return Buffer.concat([writeVarint((field << 3) | 2), writeVarint(data.length), data]);
}
function varintField(field: number, value: number): Uint8Array {
  return Buffer.concat([writeVarint(field << 3), writeVarint(value)]);
}
function writeVarint(value: number): Buffer {
  const output: number[] = [];
  let remaining = value;
  do { const byte = remaining % 128; remaining = Math.floor(remaining / 128); output.push(byte | (remaining ? 128 : 0)); } while (remaining);
  return Buffer.from(output);
}
function readVarint(bytes: Uint8Array, start: number): [number, number] {
  let value = 0; let multiplier = 1; let offset = start;
  for (let count = 0; count < 10; count += 1) {
    const byte = bytes[offset]; if (byte === undefined) throw new Error('Truncated varint');
    offset += 1; value += (byte & 127) * multiplier;
    if ((byte & 128) === 0) return [value, offset];
    multiplier *= 128;
  }
  throw new Error('Varint exceeds supported range');
}
