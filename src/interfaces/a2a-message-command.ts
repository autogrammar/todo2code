import { decodeIntakeEnvelope } from '../communication/intake-protobuf.js';
import {
  A2A_ACTIONS,
  A2ARequestError,
  isRecord,
  type A2AAction,
  type A2AMessage,
} from './a2a-types.js';

export function parseCommand(
  message: A2AMessage,
  params: Record<string, unknown>,
): { action: A2AAction; input: Record<string, unknown> } {
  const protobufCommand = parseCommandFromProtobuf(message);
  if (protobufCommand) return protobufCommand;

  const objectCommand = parseCommandFromObject(message, params);
  if (objectCommand) return objectCommand;

  return parseCommandFromText(message, params);
}

function parseCommandFromProtobuf(message: A2AMessage): { action: A2AAction; input: Record<string, unknown> } | null {
  const protobuf = message.parts.find((part) => typeof part.raw === 'string' && part.mediaType === 'application/x-protobuf');
  if (protobuf?.raw) {
    const bytes = Buffer.from(protobuf.raw, 'base64');
    try {
      decodeIntakeEnvelope(bytes, 'command');
      return { action: 'intake_command', input: { protobuf: protobuf.raw, outputFormat: 'protobuf' } };
    } catch {
      decodeIntakeEnvelope(bytes, 'query');
      return { action: 'intake_query', input: { protobuf: protobuf.raw, outputFormat: 'protobuf' } };
    }
  }
  return null;
}

function parseCommandFromObject(
  message: A2AMessage,
  params: Record<string, unknown>,
): { action: A2AAction; input: Record<string, unknown> } | null {
  const objectData = message.parts.find((part) => isRecord(part.data))?.data;
  if (isRecord(objectData)) return commandFromData(objectData, message, params);
  return null;
}

function parseCommandFromText(
  message: A2AMessage,
  params: Record<string, unknown>,
): { action: A2AAction; input: Record<string, unknown> } {
  const text = parseText(message);
  if (looksLikeJson(text)) return parseCommandFromJson(text, message, params);
  return parseCommandFromSentence(text);
}

function looksLikeJson(text: string): boolean {
  return text.startsWith('{');
}

function parseCommandFromJson(
  text: string,
  message: A2AMessage,
  params: Record<string, unknown>,
): { action: A2AAction; input: Record<string, unknown> } {
  return commandFromData(JSON.parse(text) as Record<string, unknown>, message, params);
}

function parseCommandFromSentence(text: string): { action: A2AAction; input: Record<string, unknown> } {
  return commandInputFromSentence(text);
}

function parseSentenceInput(text: string, start: number): Record<string, unknown> {
  return parseKeyValues(text.slice(start));
}

function defaultTextCommand(text: string): { action: A2AAction; input: Record<string, unknown> } {
  return { action: 'extract_nl', input: { text, file: 'a2a-message.md' } };
}

function isSupportedAction(value: string): value is A2AAction {
  return A2A_ACTIONS.includes(value as A2AAction);
}

function commandInputFromSentence(
  text: string,
): { action: A2AAction; input: Record<string, unknown> } {
  const first = firstToken(text);
  if (!first || !isSupportedAction(first)) return defaultTextCommand(text);
  return {
    action: first,
    input: parseSentenceInput(text, first.length),
  };
}

function parseText(message: A2AMessage): string {
  return message.parts.map((part) => part.text ?? '').join('\n').trim();
}

function firstToken(text: string): string {
  return text.split(/\s+/, 1)[0]?.toLowerCase() ?? '';
}

function commandFromData(
  data: Record<string, unknown>,
  message: A2AMessage,
  params: Record<string, unknown>,
): { action: A2AAction; input: Record<string, unknown> } {
  const action = normalizeAction(data.action ?? data.skill ?? message.metadata?.action ?? params.skillId);
  const nested = isRecord(data.input) ? data.input : data;
  return { action, input: { ...nested } };
}

function parseKeyValues(text: string): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const match of text.matchAll(/([A-Za-z][\w.-]*)=("[^"]*"|'[^']*'|\S+)/g)) {
    const key = match[1];
    const raw = match[2];
    if (!key || raw === undefined) continue;
    const stringValue = raw.replace(/^['"]|['"]$/g, '');
    output[key] = parseScalar(stringValue);
  }
  return output;
}

function parseScalar(value: string): string | boolean | number {
  if (value === 'true' || value === 'false') return value === 'true';
  return /^\d+$/.test(value) ? Number(value) : value;
}

function normalizeAction(value: unknown): A2AAction {
  if (typeof value !== 'string') return 'pipeline';
  const normalized = value.toLowerCase().replace(/[- ]/g, '_');
  const aliases: Record<string, A2AAction> = {
    analyze_repository: 'pipeline',
    extract_intent: 'extract_nl',
    summarize_team_state: 'summarize',
    diagnose_alignment: 'diagnose',
  };
  const action = aliases[normalized] ?? normalized;
  if (!A2A_ACTIONS.includes(action as A2AAction)) {
    throw new A2ARequestError(-32602, `Unknown todo2code action: ${value}`);
  }
  return action as A2AAction;
}
