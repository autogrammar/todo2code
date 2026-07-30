import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'examples');
const output = process.argv[3] ?? '.intent-demo-llm';
const latestPath = path.join(root, output, 'latest.json');
const latest = JSON.parse(await readFile(latestPath, 'utf8'));
const manifestPath = path.join(root, latest.runDirectory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const requiredStages = [
  'naturalLanguageExtraction',
  'markdownExtraction',
  'documentationExtraction',
  'communicationAnalysis',
  'taskSynthesis',
  'summary',
];

const failures = [];
if (manifest.status !== 'succeeded') failures.push(`manifest status is ${manifest.status}`);
for (const name of requiredStages) {
  const stage = manifest.stages?.[name];
  if (!stage) {
    failures.push(`${name}: missing audit`);
    continue;
  }
  if (stage.status !== 'succeeded') failures.push(`${name}: status=${stage.status}`);
  if (stage.effectiveMode !== 'llm') failures.push(`${name}: effectiveMode=${stage.effectiveMode}`);
  if (stage.degraded) failures.push(`${name}: degraded=true`);
  if (!Array.isArray(stage.responses) || stage.responses.length === 0) failures.push(`${name}: no LLM response metadata`);
}

if (failures.length > 0) {
  throw new Error(`demollm did not complete entirely with LLM:\n- ${failures.join('\n- ')}\nManifest: ${manifestPath}`);
}

process.stdout.write(`demollm PASS: ${manifest.runId}\n`);
for (const name of requiredStages) {
  const stage = manifest.stages[name];
  const models = [...new Set(stage.responses.map((response) => response.model).filter(Boolean))];
  const tokens = stage.responses.reduce((sum, response) => sum + (response.usage?.totalTokens ?? 0), 0);
  const cost = stage.responses.reduce((sum, response) => sum + (response.usage?.cost ?? 0), 0);
  process.stdout.write(`${name}: ${models.join(', ')} · ${stage.durationMs} ms · ${tokens} tokens · $${cost.toFixed(6)}\n`);
}
process.stdout.write(`manifest: ${manifestPath}\n`);
