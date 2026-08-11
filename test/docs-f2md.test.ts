import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDocumentationBaseline } from '../src/extractors/docs-deterministic.js';
import { makeConfig } from './helpers.js';

const SOURCE_HASH = 'a'.repeat(64);
const ARTIFACT_HASH = 'b'.repeat(64);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function structure(body: string): Record<string, unknown> {
  return {
    schema: 'bioxfoundry.document-structure/v1',
    source: '/source/study.pdf',
    sourceSha256: SOURCE_HASH,
    rawMarkdownSha256: sha256(body),
    canonicalMarkdownSha256: sha256(body),
    sourceModel: 'f2md.document-ast/v1',
    documentAstSha256: 'c'.repeat(64),
    pages: [{ number: 1, width: 612, height: 792 }, { number: 2, width: 612, height: 792 }],
    blocks: [
      {
        id: 'block-1111111111111111',
        type: 'heading',
        page: 1,
        pages: [1],
        bbox: [10, 20, 300, 50],
        semantic: true,
        confidence: 0.96,
        normalizedText: 'Runtime architecture',
        artifactUrn: `urn:subactor:artifact:sha256:${ARTIFACT_HASH}`,
        artifactId: 'artifact-heading-bbbbbbbbbbbb',
        level: 1,
      },
      {
        id: 'block-2222222222222222',
        type: 'paragraph',
        page: 2,
        bbox: [12.5, 70, 410, 112.25],
        semantic: true,
        confidence: null,
        normalizedText: 'The validator calls `validateContract` in `src/runtime.ts` for T2C-14.',
      },
      {
        id: 'block-3333333333333333',
        type: 'list',
        page: 1,
        bbox: null,
        semantic: false,
        confidence: null,
        normalizedText: '- [Runtime architecture](#runtime-architecture)',
        reason: 'table-of-contents',
      },
      {
        id: 'block-4444444444444444',
        type: 'navigation',
        page: 1,
        bbox: null,
        semantic: true,
        confidence: null,
        normalizedText: 'Previous | Next',
      },
    ],
  };
}

async function writeDocument(root: string, sidecar: Record<string, unknown>): Promise<string> {
  const docs = path.join(root, 'docs');
  await fs.mkdir(docs, { recursive: true });
  const body = [
    '<!-- source-page:1 -->',
    '# Runtime architecture',
    '',
    '<!-- source-page:2 -->',
    'The validator calls `validateContract` in `src/runtime.ts` for T2C-14.',
    '',
  ].join('\n');
  const markdown = ['---', 'source: "/source/study.pdf"', 'structureArtifact: "study.structure.json"', '---', '', body].join('\n');
  const file = path.join(docs, 'study.md');
  await fs.writeFile(file, markdown);
  await fs.writeFile(path.join(docs, 'study.structure.json'), `${JSON.stringify(sidecar, null, 2)}\n`);
  return file;
}

test('valid f2md structure emits deterministic canonical records with exact document anchors', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-f2md-'));
  const body = [
    '<!-- source-page:1 -->',
    '# Runtime architecture',
    '',
    '<!-- source-page:2 -->',
    'The validator calls `validateContract` in `src/runtime.ts` for T2C-14.',
    '',
  ].join('\n');
  const file = await writeDocument(root, structure(body));

  const first = await extractDocumentationBaseline({ root, files: [file] }, makeConfig(root));
  const second = await extractDocumentationBaseline({ root, files: [file] }, makeConfig(root));

  assert.equal(first.warnings.length, 0);
  assert.deepEqual(first.records, second.records);
  assert.equal(first.records.length, 2);
  assert.ok(first.records.every((record) => record.schemaVersion === 't2c.intent/v1'));
  assert.ok(first.records.every((record) => record.source.extractor === 't2c/f2md-document-structure@1'));
  assert.ok(first.records.every((record) => record.metadata.documentationOrigin === 'f2md_structure'));
  assert.deepEqual(first.records.map((record) => record.source.symbol), [
    'block-1111111111111111', 'block-2222222222222222',
  ]);

  const headingAnchor = first.records[0]?.metadata.documentAnchor;
  assert.deepEqual(headingAnchor, {
    structureSchema: 'bioxfoundry.document-structure/v1',
    sidecarPath: 'docs/study.structure.json',
    source: '/source/study.pdf',
    sourceSha256: SOURCE_HASH,
    rawMarkdownSha256: sha256(body),
    canonicalMarkdownSha256: sha256(body),
    blockId: 'block-1111111111111111',
    blockType: 'heading',
    page: 1,
    pages: [1],
    bbox: [10, 20, 300, 50],
    confidence: 0.96,
    sourceModel: 'f2md.document-ast/v1',
    documentAstSha256: 'c'.repeat(64),
    artifactUrn: `urn:subactor:artifact:sha256:${ARTIFACT_HASH}`,
    artifactId: 'artifact-heading-bbbbbbbbbbbb',
    level: 1,
  });
  assert.deepEqual(first.records[1]?.statement.target.paths, ['src/runtime.ts']);
  assert.deepEqual(first.records[1]?.statement.target.symbols, ['validateContract']);
  assert.deepEqual(first.records[1]?.statement.target.tickets, ['T2C-14']);
});

test('missing f2md sidecar preserves the existing Markdown baseline', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-no-f2md-'));
  const file = path.join(root, 'README.md');
  await fs.writeFile(file, '# Runtime architecture\n\nUse `src/runtime.ts` to validate the runtime contract.\n');

  const result = await extractDocumentationBaseline({ root, files: [file] }, makeConfig(root));

  assert.equal(result.warnings.length, 0);
  assert.equal(result.records.length, 2);
  assert.ok(result.records.every((record) => record.source.extractor === 't2c/markdown-documentation@2'));
});

test('mismatched or invalid f2md sidecars warn and contribute no records', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-docs-bad-f2md-'));
  const body = [
    '<!-- source-page:1 -->',
    '# Runtime architecture',
    '',
    '<!-- source-page:2 -->',
    'The validator calls `validateContract` in `src/runtime.ts` for T2C-14.',
    '',
  ].join('\n');
  const mismatched = structure(body);
  mismatched.canonicalMarkdownSha256 = 'd'.repeat(64);
  const file = await writeDocument(root, mismatched);

  const mismatch = await extractDocumentationBaseline({ root, files: [file] }, makeConfig(root));
  assert.equal(mismatch.records.length, 0);
  assert.equal(mismatch.warnings.length, 1);
  assert.match(mismatch.warnings[0] ?? '', /canonical Markdown hash mismatch/);

  const invalid = structure(body);
  invalid.schema = 'bioxfoundry.document-structure/v2';
  await fs.writeFile(path.join(root, 'docs', 'study.structure.json'), `${JSON.stringify(invalid)}\n`);
  const wrongSchema = await extractDocumentationBaseline({ root, files: [file] }, makeConfig(root));
  assert.equal(wrongSchema.records.length, 0);
  assert.equal(wrongSchema.warnings.length, 1);
  assert.match(wrongSchema.warnings[0] ?? '', /unsupported f2md structure schema/);
});
