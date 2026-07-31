import type { LlmResponseMetadata } from '../core/types.js';

/**
 * The supported, deliberately small JSON Schema subset for provider responses.
 *
 * Each node owns both its provider-facing JSON Schema and its runtime parser.
 * Adding a constraint to one side without implementing it on the other is
 * therefore impossible through this API. Grounding and cross-field semantic
 * rules belong after `parse`, because JSON Schema cannot prove repository-local
 * identity or evidence ownership.
 */
export interface StructuredSchema<T> {
  readonly jsonSchema: Record<string, unknown>;
  parse(value: unknown, location?: string): T;
}

export class StructuredResponseError extends Error {
  constructor(message: string, readonly responseMetadata?: LlmResponseMetadata) {
    super(message);
    this.name = 'StructuredResponseError';
  }
}

export type InferStructuredSchema<TSchema extends StructuredSchema<unknown>> =
  TSchema extends StructuredSchema<infer TValue> ? TValue : never;

interface StringOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
}

interface NumberOptions {
  minimum?: number;
  maximum?: number;
  description?: string;
}

interface ArrayOptions {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  description?: string;
}

type Shape = Record<string, StructuredSchema<unknown>>;
type ShapeValue<TShape extends Shape> = {
  [TKey in keyof TShape]: InferStructuredSchema<TShape[TKey]>;
};

function schema<T>(
  jsonSchema: Record<string, unknown>,
  validate: (value: unknown, location: string) => T,
): StructuredSchema<T> {
  return {
    jsonSchema,
    parse(value: unknown, location = 'response'): T {
      return validate(value, location);
    },
  };
}

function string(options: StringOptions = {}): StructuredSchema<string> {
  const { description, ...constraints } = options;
  const pattern = options.pattern === undefined ? null : new RegExp(options.pattern);
  return schema(
    { type: 'string', ...constraints, ...(description === undefined ? {} : { description }) },
    (value, location) => {
      if (typeof value !== 'string') fail(location, `must be a string (received ${describe(value)})`);
      if (options.minLength !== undefined && value.length < options.minLength) {
        fail(location, `must contain at least ${options.minLength} characters`);
      }
      if (options.maxLength !== undefined && value.length > options.maxLength) {
        fail(location, `must contain at most ${options.maxLength} characters`);
      }
      if (pattern && !pattern.test(value)) fail(location, `must match /${options.pattern}/`);
      return value;
    },
  );
}

function nullableString(options: StringOptions = {}): StructuredSchema<string | null> {
  const base = string(options);
  return schema(
    { ...base.jsonSchema, type: ['string', 'null'] },
    (value, location) => value === null ? null : base.parse(value, location),
  );
}

function number(options: NumberOptions = {}): StructuredSchema<number> {
  const { description, ...constraints } = options;
  return schema(
    { type: 'number', ...constraints, ...(description === undefined ? {} : { description }) },
    (value, location) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(location, `must be a finite JSON number (received ${describe(value)})`);
      }
      checkNumberBounds(value, options, location);
      return value;
    },
  );
}

function integer(options: NumberOptions = {}): StructuredSchema<number> {
  const numeric = number(options);
  return schema(
    { ...numeric.jsonSchema, type: 'integer' },
    (value, location) => {
      const parsed = numeric.parse(value, location);
      if (!Number.isInteger(parsed)) fail(location, 'must be an integer');
      return parsed;
    },
  );
}

function enumValue<const TValues extends readonly [string, ...string[]]>(
  values: TValues,
  options: { description?: string } = {},
): StructuredSchema<TValues[number]> {
  const allowed = new Set<string>(values);
  return schema(
    { type: 'string', enum: [...values], ...options },
    (value, location) => {
      if (typeof value !== 'string' || !allowed.has(value)) {
        fail(location, `must be one of: ${values.join(', ')} (received ${describe(value)})`);
      }
      return value as TValues[number];
    },
  );
}

function array<T>(items: StructuredSchema<T>, options: ArrayOptions = {}): StructuredSchema<T[]> {
  const { description, ...constraints } = options;
  return schema(
    { type: 'array', ...constraints, items: items.jsonSchema, ...(description === undefined ? {} : { description }) },
    (value, location) => {
      if (!Array.isArray(value)) fail(location, `must be an array (received ${describe(value)})`);
      if (options.minItems !== undefined && value.length < options.minItems) {
        fail(location, `must contain at least ${options.minItems} items`);
      }
      if (options.maxItems !== undefined && value.length > options.maxItems) {
        fail(location, `must contain at most ${options.maxItems} items`);
      }
      const parsed = value.map((item, index) => items.parse(item, `${location}[${index}]`));
      if (options.uniqueItems) {
        const identities = parsed.map(jsonIdentity);
        if (new Set(identities).size !== identities.length) fail(location, 'must contain unique items');
      }
      return parsed;
    },
  );
}

function object<const TShape extends Shape>(shape: TShape): StructuredSchema<ShapeValue<TShape>> {
  const keys = Object.keys(shape);
  const allowed = new Set(keys);
  return schema(
    {
      type: 'object',
      additionalProperties: false,
      required: keys,
      properties: Object.fromEntries(keys.map((key) => [key, shape[key]!.jsonSchema])),
    },
    (value, location) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        fail(location, `must be an object (received ${describe(value)})`);
      }
      const candidate = value as Record<string, unknown>;
      const unknown = Object.keys(candidate).filter((key) => !allowed.has(key)).sort();
      const missing = keys.filter((key) => !Object.hasOwn(candidate, key));
      if (unknown.length) fail(location, `contains unknown properties: ${unknown.join(', ')}`);
      if (missing.length) fail(location, `is missing required properties: ${missing.join(', ')}`);
      const output: Record<string, unknown> = {};
      for (const key of keys) output[key] = shape[key]!.parse(candidate[key], `${location}.${key}`);
      return output as ShapeValue<TShape>;
    },
  );
}

function checkNumberBounds(value: number, options: NumberOptions, location: string): void {
  if (options.minimum !== undefined && value < options.minimum) {
    fail(location, `must be at least ${options.minimum}`);
  }
  if (options.maximum !== undefined && value > options.maximum) {
    fail(location, `must be at most ${options.maximum}`);
  }
}

function jsonIdentity(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jsonIdentity).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${jsonIdentity(record[key])}`).join(',')}}`;
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object') return 'object';
  return String(value);
}

function fail(location: string, detail: string): never {
  throw new StructuredResponseError(`${location} ${detail}`);
}

export const structuredSchema = {
  string,
  nullableString,
  number,
  integer,
  enum: enumValue,
  array,
  object,
};
