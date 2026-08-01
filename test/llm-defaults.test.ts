import assert from 'node:assert/strict';
import test from 'node:test';
import { getConfig } from '../src/config/env.js';

test('semantic LLM modes default to require-llm', () => {
  const names = ['T2C_NL_MODE', 'T2C_MARKDOWN_MODE', 'T2C_COMMUNICATION_MODE'] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    const config = getConfig(process.cwd());
    assert.equal(config.nlMode, 'require-llm');
    assert.equal(config.markdownMode, 'require-llm');
    assert.equal(config.communicationMode, 'require-llm');
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
