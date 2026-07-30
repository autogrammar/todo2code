import { compileOperationPlanArtifact } from './artifact.js';

function argumentsByName(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    parsed[key.slice(2)] = value;
  }
  const allowed = new Set(['plan', 'bindings', 'out', 'correlation']);
  const unknown = Object.keys(parsed).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
  for (const required of allowed) if (!parsed[required]) throw new Error(`--${required} is required`);
  return parsed;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const args = argumentsByName(argv);
    const { receipt } = await compileOperationPlanArtifact({
      planPath: args.plan!, bindingsPath: args.bindings!, outputPath: args.out!, correlationId: args.correlation!,
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...receipt })}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  process.exitCode = await main();
}
