import { compileOperationPlanArtifact } from './artifact.js';

function argumentsByName(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  const allowedArguments = new Set(['plan', 'bindings', 'out', 'correlation']);
  for (let index = 0; index < argv.length; index += 2) {
    parseArgumentPair(argv[index], argv[index + 1], parsed);
  }
  const unknown = collectUnknownArguments(parsed, allowedArguments);
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
  assertRequiredArguments(parsed, allowedArguments);
  return parsed;
}

function parseArgumentPair(key: string | undefined, value: string | undefined, parsed: Record<string, string>): void {
  if (!key?.startsWith('--') || !value || value.startsWith('--')) {
    throw new Error(`Invalid argument near ${key ?? '<end>'}`);
  }
  parsed[key.slice(2)] = value;
}

function collectUnknownArguments(parsed: Record<string, string>, allowed: Set<string>): string[] {
  return Object.keys(parsed).filter((key) => !allowed.has(key));
}

function assertRequiredArguments(parsed: Record<string, string>, required: Set<string>): void {
  for (const argument of required) {
    if (!parsed[argument]) throw new Error(`--${argument} is required`);
  }
}

function compilePlanInvocation(args: Record<string, string>) {
  return {
    planPath: args.plan!,
    bindingsPath: args.bindings!,
    outputPath: args.out!,
    correlationId: args.correlation!,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const args = argumentsByName(argv);
    const { receipt } = await compileOperationPlanArtifact(compilePlanInvocation(args));
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
