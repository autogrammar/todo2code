import { readFile } from 'node:fs/promises';
import { Todo2CodeClient } from '../../dist/src/sdk/typescript.js';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error('Usage: node examples/sdk/typescript.mjs before.graph.json after.graph.json');
  process.exit(2);
}

const [beforeGraph, afterGraph] = await Promise.all([
  readFile(beforePath, 'utf8').then(JSON.parse),
  readFile(afterPath, 'utf8').then(JSON.parse),
]);
const client = new Todo2CodeClient({ baseUrl: process.env.T2C_URL });
const { diff } = await client.diffGraphs(beforeGraph, afterGraph, false);
console.log(JSON.stringify(diff.summary, null, 2));
