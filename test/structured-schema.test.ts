import assert from 'node:assert/strict';
import test from 'node:test';
import { structuredSchema as s } from '../src/llm/structured-schema.js';

const contract = s.object({
  name: s.string({ minLength: 2, maxLength: 8, pattern: '^[a-z]+$' }),
  state: s.enum(['ready', 'blocked']),
  score: s.number({ minimum: 0, maximum: 1 }),
  count: s.integer({ minimum: 1 }),
  owner: s.nullableString(),
  tags: s.array(s.string(), { minItems: 1, maxItems: 2, uniqueItems: true }),
});

const valid = {
  name: 'alpha', state: 'ready', score: 0.8, count: 2, owner: null, tags: ['one', 'two'],
} as const;

test('one structured contract emits the provider schema and parses the same value', () => {
  assert.deepEqual(contract.parse(valid), valid);
  assert.deepEqual(contract.jsonSchema, {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'state', 'score', 'count', 'owner', 'tags'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 8, pattern: '^[a-z]+$' },
      state: { type: 'string', enum: ['ready', 'blocked'] },
      score: { type: 'number', minimum: 0, maximum: 1 },
      count: { type: 'integer', minimum: 1 },
      owner: { type: ['string', 'null'] },
      tags: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { type: 'string' } },
    },
  });
});

test('structured parsing fails closed with the exact response path', () => {
  assert.throws(() => contract.parse({ ...valid, extra: true }), /response contains unknown properties: extra/);
  const { owner: _owner, ...missingOwner } = valid;
  assert.throws(() => contract.parse(missingOwner), /response is missing required properties: owner/);
  assert.throws(() => contract.parse({ ...valid, state: 'done' }), /response\.state must be one of: ready, blocked/);
  assert.throws(() => contract.parse({ ...valid, score: '80%' }), /response\.score must be a finite JSON number/);
  assert.throws(() => contract.parse({ ...valid, count: 1.5 }), /response\.count must be an integer/);
  assert.throws(() => contract.parse({ ...valid, tags: ['same', 'same'] }), /response\.tags must contain unique items/);
  assert.throws(() => contract.parse({ ...valid, name: 'A' }), /response\.name must contain at least 2 characters/);
});

test('object uniqueness uses canonical JSON identity rather than property order', () => {
  const pair = s.object({ key: s.string(), value: s.integer() });
  const pairs = s.array(pair, { uniqueItems: true });
  assert.throws(
    () => pairs.parse([{ key: 'x', value: 1 }, { value: 1, key: 'x' }]),
    /response must contain unique items/,
  );
});
