// Go AST adapter. Skipped automatically when the Go toolchain is absent, so the
// suite stays green on machines that only carry Node and Python.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { extractAstIntent } from '../src/extractors/ast.js';
import { makeConfig } from './helpers.js';

const execFileAsync = promisify(execFile);

async function goAvailable(): Promise<boolean> {
  try {
    await execFileAsync('go', ['version'], { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

const SAMPLE = `package store

import (
	"errors"
	"fmt"
)

// ErrMissing reports an absent entry.
var ErrMissing = errors.New("missing")

const MaxEntries = 128

type Entry struct {
	ID    string
	Value int
}

type Reader interface {
	Read(id string) (Entry, error)
}

func NewEntry(id string, value int) Entry {
	return Entry{ID: id, Value: value}
}

func (e Entry) Describe() string {
	return fmt.Sprintf("%s=%d", e.ID, e.Value)
}

func unexportedHelper() int {
	return MaxEntries
}
`;

async function extractSample(): Promise<Awaited<ReturnType<typeof extractAstIntent>>> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-go-ast-'));
  await fs.writeFile(path.join(root, 'store.go'), SAMPLE, 'utf8');
  const config = makeConfig(root);
  config.enableGoAst = true;
  config.enablePythonAst = false;
  return extractAstIntent({ root }, config);
}

test('Go adapter records package, imports, types, functions and methods', async (t) => {
  if (!await goAvailable()) return t.skip('Go toolchain not installed');
  const result = await extractSample();
  const objects = new Set(result.records.map((record) => record.statement.object));

  assert.ok(objects.has('store'), 'package declaration');
  assert.ok(objects.has('errors') && objects.has('fmt'), 'imports');
  assert.ok(objects.has('Entry') && objects.has('Reader'), 'type declarations');
  assert.ok(objects.has('NewEntry'), 'function declaration');
  assert.ok(objects.has('ErrMissing') && objects.has('MaxEntries'), 'package-level var and const');

  // A method is addressable through its receiver, which is how a TODO naming
  // `Entry.Describe` links to the implementation.
  assert.ok(objects.has('Entry.Describe'), 'method carries its receiver');
  const method = result.records.find((record) => record.statement.object === 'Entry.Describe');
  assert.equal(method?.statement.subject, 'Entry');
  assert.equal(method?.metadata.receiver, 'Entry');
  assert.equal(method?.metadata.kind, 'method');
});

test('Go facts are deterministic observations, not inferences', async (t) => {
  if (!await goAvailable()) return t.skip('Go toolchain not installed');
  const result = await extractSample();
  const goRecords = result.records.filter((record) => record.metadata.language === 'go');
  assert.ok(goRecords.length > 0);

  for (const record of goRecords) {
    assert.equal(record.epistemic.class, 'fact');
    assert.equal(record.epistemic.confidence, 1);
    assert.deepEqual(record.epistemic.basis, ['go_stdlib_ast']);
    assert.equal(record.source.kind, 'ast');
    assert.equal(record.source.extractor, 't2c/go-ast@1');
    assert.equal(record.metadata.llmUsed, false);
    assert.equal(record.source.path, 'store.go');
    assert.ok((record.source.lines?.start ?? 0) >= 1, 'every fact carries a source line');
  }
});

test('Go adapter marks exported symbols and reports calls in scope', async (t) => {
  if (!await goAvailable()) return t.skip('Go toolchain not installed');
  const result = await extractSample();

  const exported = result.records.find((record) => record.statement.object === 'NewEntry');
  assert.equal(exported?.metadata.exported, true);
  const unexported = result.records.find((record) => record.statement.object === 'unexportedHelper');
  assert.equal(unexported?.metadata.exported, false);

  const call = result.records.find((record) => record.statement.kind === 'go_call_fact' && record.statement.object === 'fmt.Sprintf');
  assert.ok(call, 'qualified call is recorded');
  assert.equal(call?.source.symbol, 'Entry.Describe', 'call is attributed to its enclosing function');
});

test('Go extraction is skipped without cost when a tree holds no Go sources', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-go-empty-'));
  await fs.writeFile(path.join(root, 'runtime.ts'), 'export function noop(): void {}\n', 'utf8');
  const config = makeConfig(root);
  config.enableGoAst = true;
  config.enablePythonAst = false;
  // Deliberately unusable binary: it must never be spawned for a Go-free tree.
  config.goExecutable = 'definitely-not-a-real-go-binary';

  const result = await extractAstIntent({ root }, config);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.records.some((record) => record.source.path === 'runtime.ts'));
});

test('A missing Go toolchain degrades to a warning instead of failing the run', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-go-missing-'));
  await fs.writeFile(path.join(root, 'main.go'), 'package main\n\nfunc main() {}\n', 'utf8');
  const config = makeConfig(root);
  config.enableGoAst = true;
  config.enablePythonAst = false;
  config.goExecutable = 'definitely-not-a-real-go-binary';

  const result = await extractAstIntent({ root }, config);
  assert.equal(result.records.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? '', /Go AST extraction failed/);
});
