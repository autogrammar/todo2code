# todo2code TypeScript SDK

Klient A2A v1.0 bez zależności zewnętrznych (globalne `fetch` z Node 20+).

```bash
npx tsc -p sdk/typescript/tsconfig.json
```

```ts
import { T2CClient } from '@todo2code/sdk';

const client = new T2CClient({ baseUrl: 'http://localhost:8787', token: process.env.T2C_A2A_TOKEN ?? null });

const ast = await client.extractAst('examples/backend');
const graph = await client.link(ast.records);
const diagnostics = await client.diagnose(graph);

const reality = await client.reality(graph, diagnostics, { gapsOnly: true });
console.log(reality.markdown);
```

Przykład użycia: [`examples/basic.ts`](examples/basic.ts). Pełny opis akcji i
wspólnego modelu: [`../README.md`](../README.md).
