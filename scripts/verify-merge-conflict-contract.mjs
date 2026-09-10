#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractMergeConflicts } from '../dist/src/extractors/merge-conflicts.js';
import { assertIntentRecord } from '../dist/src/core/schema.js';

// Check the actual wire projection, independently of the compile-only public
// type. No LLM, network, repository state or merge operation is involved.
const root = await fs.mkdtemp(path.join(os.tmpdir(), 't2c-conflict-contract-'));
try {
  let checked = 0;
  for (const style of ['merge', 'diff3']) {
    for (const eol of ['\n', '\r\n']) {
      const lines = ['<<<<<<< ours', 'x'.repeat(2100),
        ...(style === 'diff3' ? ['||||||| base', 'base'] : []),
        '=======', 'theirs', '>>>>>>> theirs'];
      const body = lines.join(eol);
      await fs.writeFile(path.join(root, 'conflict.toml'), body);
      const result = await extractMergeConflicts(root, { maxFileBytes: 10_000 });
      assert.equal(result.warnings.length, 0);
      assert.equal(result.records.length, 1);
      const record = JSON.parse(JSON.stringify(result.records[0]));
      assertIntentRecord(record);
      assert.equal(record.schemaVersion, 't2c.intent/v1');
      assert.equal(record.statement.kind, 'merge_conflict_fact');
      assert.equal(record.statement.action, 'block');
      assert.equal(record.statement.modality, 'observed');
      assert.equal(record.lifecycle.status, 'blocked');
      assert.equal(record.epistemic.class, 'fact');
      assert.equal(record.source.kind, 'git');
      assert.equal(record.source.path, 'conflict.toml');
      assert.equal(record.source.extractor, 't2c/merge-conflict-markers@1');
      assert.deepEqual(record.source.lines, { start: 1, end: lines.length });
      assert.deepEqual(record.statement.target.paths, ['conflict.toml']);
      assert.equal(record.metadata.llmUsed, false);
      assert.equal(record.metadata.gitIndexVerified, false);
      assert.equal(record.metadata.conflictStyle, style);
      assert.equal(record.metadata.markerWidth, 7);
      assert.equal(record.source.rawExcerpt, body.slice(0, 2000));
      assert.equal(record.metadata.blockSha256, createHash('sha256').update(body).digest('hex'));
      checked++;
    }
  }
  console.log(`merge conflict data contract: PASS (${checked} real wire projections)`);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
